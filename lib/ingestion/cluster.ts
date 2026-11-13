/**
 * cluster.ts — Groups articles that cover the same story, across outlets.
 *
 * The inverse of `deduplicate.ts`, and deliberately separate from it. Dedup
 * answers "have we already got this?" and throws the rest away. Clustering
 * answers "who else covered this?" and keeps them — because three outlets on
 * one match is three angles to write from, not two wasted rows. A writing step
 * that sees one source can only translate it; one that sees three can produce
 * an article none of them has, which is the difference between replication and
 * curation.
 *
 * NOTHING CALLS THIS YET, AND INGESTION IS UNCHANGED. `deduplicate.ts` still
 * drops near-identical titles exactly as before. This is the shadow-mode half:
 * the grouping can be inspected against real provider output (`pnpm
 * ingest:dry-run --clusters`) and tuned before anything depends on it.
 *
 * Why not reuse `titleFingerprint`: that function is an *identity* — it sorts
 * the significant words and joins them, so two titles match only if their word
 * sets are equal. "FC Porto bate Benfica no Dragão Arena" and "Benfica perde
 * no Dragão" are the same story and share no fingerprint. Grouping needs a
 * *similarity*, so this module measures overlap instead (Jaccard), which
 * degrades gracefully where equality simply fails.
 *
 * This module groups. It does not choose. Which article in a cluster gets
 * written from, and whether a cluster is worth covering at all, is an editorial
 * decision owned by `02-editorial-content` — see
 * docs/editor/ingestion-editorial-workflow.md.
 */

import type { NormalizedArticle } from "./types"

/**
 * Words that carry no story identity. Kept deliberately short: an aggressive
 * list starts deciding what a story is about, which is editorial. These are
 * only the connectives frequent enough to inflate the overlap between two
 * unrelated headlines. Portuguese first, then Spanish and English, because
 * ingestion keeps foreign-language sources on purpose.
 */
const STOPWORDS = new Set([
  "para", "como", "mais", "pelo", "pela", "sobre", "entre", "depois", "antes",
  "ainda", "apos", "suas", "seus", "esta", "este", "isso", "aquele", "aquela",
  "porque", "quando", "onde", "todos", "todas", "cada", "contra",
  "para", "pero", "este", "esta", "entre", "sobre", "desde", "hasta", "donde",
  "that", "this", "with", "from", "have", "has", "will", "they", "their",
  "about", "after", "before", "says", "said", "into", "over", "than", "them",
])

/**
 * Measured, not guessed — and measured low, because Jaccard is harsh on
 * headlines: every word one outlet adds enlarges the denominator.
 *
 * A run against a real batch of 25 on 2026-11-12 (`pnpm ingest:dry-run
 * --clusters`) scored every pair. The genuine same-story pairs landed between
 * 0.23 and 0.27 — two outlets on the Ukraine talks at 0.27 and 0.23, the two
 * on the Macron lawsuit at 0.25 — and the first pair that is arguably *not*
 * one story sat at 0.17. 0.22 is placed in that gap: it takes every pair the
 * run confirmed and leaves the ambiguous ones out.
 *
 * Known limit, and the reason this stays in shadow mode. The gap only exists
 * for international news, where outlets repeat the same proper nouns. Sports
 * coverage of one match scored 0.15–0.17 ("FC Porto bate Benfica no Dragão
 * Arena" against "Benfica sem depressão na Luz") because match reports share
 * almost no vocabulary — they are angles, not retellings. No single Jaccard
 * threshold separates those from unrelated articles, so sports clustering
 * needs a different signal (team entities, or the fixture itself) rather than
 * a lower number here. Lowering this to catch them would merge things that
 * are not one story.
 */
export const DEFAULT_THRESHOLD = 0.22

/** The same headline a week apart is a different story. */
export const DEFAULT_WINDOW_HOURS = 48

export interface StoryCluster {
  /**
   * The article the cluster was seeded from — the first one seen in the sorted
   * order, not an editorial judgement. `anchor` rather than `lead` on purpose:
   * choosing what to write from is the editor's call, not this module's.
   */
  anchor: NormalizedArticle
  /** Every article in the cluster, anchor included, in the order encountered. */
  members: NormalizedArticle[]
  /** Distinct outlet names, in first-seen order. Length 1 means nobody else covered it. */
  sources: string[]
}

export interface ClusterOptions {
  threshold?: number
  windowHours?: number
}

/**
 * The significant words of an article's headline, as a set. Mirrors
 * `titleFingerprint`'s normalisation — lowercase, strip accents, strip
 * punctuation, drop words of three characters or fewer — so the two modules
 * agree on what a word is, then diverges by keeping a set rather than a sorted
 * string. Only the title is read: summaries vary wildly in length between
 * providers, and a long one would swamp the overlap.
 */
export function storyTokens(article: Pick<NormalizedArticle, "title">): Set<string> {
  const words = article.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOPWORDS.has(word))
    .map(stem)

  return new Set(words)
}

/**
 * The first five characters of a word.
 *
 * Crude on purpose, and added because the first run against real provider
 * output found zero clusters in a batch that plainly contained the same
 * stories. Two outlets on the Ukraine talks wrote "Ukraine-Russia war latest"
 * and "peace talks involving Russian, Ukrainian and US officials": the stories
 * match, the words do not — `ukraine` is not `ukrainian`, and `russia` is not
 * `russian`. Exact token equality fails on exactly the words that identify a
 * story, because those are the ones that get inflected.
 *
 * Truncation beats a real stemmer here: the batch is multilingual by design
 * (pt, es, en), one stemmer per language is a dependency and a language-
 * detection problem, and the words that carry story identity are usually
 * proper nouns, which survive truncation intact. It over-merges on short
 * shared prefixes — `trump` and `trumpet` both become `trump` — which is
 * acceptable for a grouping a human reviews and would not be for a filter that
 * silently discards.
 */
function stem(word: string): string {
  return word.slice(0, 5)
}

/**
 * Jaccard overlap of two headlines' significant words: shared words over total
 * distinct words. 1 means the same word set, 0 means nothing in common. Two
 * empty headlines score 0, not 1 — an article whose title reduces to nothing
 * carries no evidence that it matches anything, and scoring it 1 would collapse
 * every such article into one cluster.
 */
export function storySimilarity(
  a: Pick<NormalizedArticle, "title">,
  b: Pick<NormalizedArticle, "title">,
): number {
  const left = storyTokens(a)
  const right = storyTokens(b)
  if (left.size === 0 || right.size === 0) return 0

  let shared = 0
  for (const token of left) {
    if (right.has(token)) shared += 1
  }

  return shared / (left.size + right.size - shared)
}

/**
 * Groups articles into stories. Single-member clusters are returned too — a
 * story covered by one outlet is still a story, and the caller needs to see
 * how many there are to judge whether the threshold is sane.
 *
 * Greedy and deterministic: articles are sorted newest first, with `sourceUrl`
 * breaking ties so the same input always yields the same clusters, and each is
 * placed in the first existing cluster whose anchor it matches. Greedy rather
 * than exhaustive because the batch is tens of articles, not thousands, and a
 * reviewer can see at a glance whether a grouping is wrong — which matters more
 * here than squeezing out the last few percent of accuracy.
 */
export function clusterByStory(
  articles: NormalizedArticle[],
  options: ClusterOptions = {},
): StoryCluster[] {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD
  const windowMs = (options.windowHours ?? DEFAULT_WINDOW_HOURS) * 3_600_000

  const sorted = [...articles].sort((a, b) => {
    const byDate = b.publishedAt.getTime() - a.publishedAt.getTime()
    return byDate !== 0 ? byDate : a.sourceUrl.localeCompare(b.sourceUrl)
  })

  const clusters: StoryCluster[] = []

  for (const article of sorted) {
    const match = clusters.find((cluster) => {
      const apart = Math.abs(
        cluster.anchor.publishedAt.getTime() - article.publishedAt.getTime(),
      )
      if (apart > windowMs) return false
      return storySimilarity(cluster.anchor, article) >= threshold
    })

    if (match) {
      match.members.push(article)
      if (!match.sources.includes(article.sourceName)) {
        match.sources.push(article.sourceName)
      }
    } else {
      clusters.push({ anchor: article, members: [article], sources: [article.sourceName] })
    }
  }

  return clusters
}

/** Clusters with more than one outlet — the ones worth writing from. */
export function multiSourceClusters(clusters: StoryCluster[]): StoryCluster[] {
  return clusters.filter((cluster) => cluster.sources.length > 1)
}
