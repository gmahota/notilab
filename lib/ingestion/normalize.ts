/**
 * normalize.ts — Clean, validate, and enrich raw articles from providers.
 *
 * Drops any article that is:
 *   - missing title or sourceUrl
 *   - has an invalid publishedAt date
 *   - is a NewsAPI "[Removed]" placeholder
 */

import type { RawArticle, NormalizedArticle } from "./types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim()
}

/**
 * Recency-based importance score (0–100).
 * Used as an initial signal before AI re-scoring.
 */
function computeImportanceScore(publishedAt: Date): number {
  const ageHours = (Date.now() - publishedAt.getTime()) / 3_600_000
  if (ageHours < 1)    return 95
  if (ageHours < 6)    return 85
  if (ageHours < 24)   return 72
  if (ageHours < 72)   return 55
  if (ageHours < 168)  return 35
  return 15
}

/** Estimate read time in minutes at ~200 wpm. */
function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

const STOP_WORDS = new Set([
  "the", "a", "an", "in", "on", "at", "to", "for", "of", "and", "or",
  "but", "is", "are", "was", "were", "be", "been", "has", "have", "had",
  "will", "would", "could", "should", "its", "this", "that", "with", "from",
  "says", "said", "after", "about", "into", "over", "more", "also", "than",
])

/** Extract up to 4 keywords from the title plus the category slug as tags. */
function extractTags(title: string, categorySlug: string): string[] {
  const words = title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
  return [...new Set([...words.slice(0, 4), categorySlug])]
}

// ─── Category detection ───────────────────────────────────────────────────────

/**
 * Maps keyword patterns to category slugs (matches Prisma seed data).
 * Scope per the 2026-11-12 maintainer decision: US celebrities, club football in
 * England / Portugal / Spain / Italy plus PSG, and financial markets. Order
 * matters (first match wins) and keywords are deliberately multiword — bare
 * single words like "goal", "porto", or "inter" previously caused unrelated
 * content to be silently mislabeled via the "general" fallback.
 *
 * `mocambique`, `africa-do-sul` and `filmes` stay listed below: no sync query
 * feeds them any more, so they are inert for new ingestion, but keeping them
 * means a stray article that genuinely is about those topics still lands
 * somewhere truthful instead of in "general".
 *
 * Note this matcher lowercases but does NOT strip accents (unlike the relevance
 * gate in quality.ts), so accented spellings are listed explicitly.
 */
const CATEGORY_RULES: [string, string[]][] = [
  ["desporto",      ["real madrid", "barcelona", "atletico madrid", "atlético madrid",
                      "benfica", "fc porto", "sporting cp", "sporting clube",
                      "manchester city", "manchester united", "liverpool fc",
                      "chelsea fc", "arsenal fc", "tottenham",
                      "juventus", "inter milan", "internazionale", "ac milan",
                      "napoli", "as roma", "lazio",
                      "paris saint-germain", "psg", "ligue 1", "serie a",
                      "premier league", "la liga", "laliga", "liga portugal",
                      "champions league", "europa league", "world cup", "copa do mundo",
                      "fifa", "uefa",
                      "football", "futebol", "soccer", "transfer window", "bastidores"]],
  ["celebridades",  ["taylor swift", "beyoncé", "beyonce", "rihanna",
                      // Bare "kardashian" on purpose: the query's mustMatch admits
                      // it bare (providers.ts), so a Khloé or Kourtney story clears
                      // the relevance gate. With only "kim kardashian" here it then
                      // fell through to the fallback — the gate and the categoriser
                      // have to admit the same people.
                      "kardashian", "kylie jenner", "dwayne johnson", "zendaya",
                      "selena gomez", "ariana grande", "travis kelce",
                      "jennifer lopez", "timothée chalamet", "timothee chalamet",
                      "red carpet", "tapete vermelho", "hollywood star",
                      "celebrity news", "celebridade"]],
  ["economia",      ["wall street", "s&p 500", "nasdaq", "dow jones",
                      "federal reserve", "stock market", "stock markets",
                      "treasury yields", "earnings report",
                      "bolsa de valores", "mercados financeiros", "euronext",
                      "taxas de juro", "inflação", "inflacao",
                      "banco central europeu", "bce"]],
  ["mocambique",    ["moçambique", "mocambique", "mozambique", "maputo",
                      "frelimo", "renamo", "daniel chapo", "nyusi"]],
  ["africa-do-sul", ["xenophobia", "xenofobia", "afrophobia", "operation dudula",
                      "south africa migrant", "south africa migrants", "south africa immigrant",
                      "south africa foreigners", "áfrica do sul imigrantes", "áfrica do sul xenofobia"]],
  ["filmes",        ["netflix", "prime video", "amazon prime video",
                      "marvel studios", "marvel cinematic", "mcu",
                      "movie review", "film review", "series review",
                      "crítica de cinema", "crítica do filme", "crítica de série", "crítica da série",
                      "box office", "streaming series", "estreia netflix", "nova série",
                      "dorama", "doramas", "k-drama", "korean drama",
                      "action movie", "action film", "filme de ação",
                      "comedy movie", "comedy series", "filme de comédia", "série de comédia"]],
]

/**
 * Where an article goes when no rule matches. Not a category in the editorial
 * sense — an admission that the categoriser could not tell.
 */
export const FALLBACK_CATEGORY_SLUG = "general"

/**
 * Every slug `detectCategorySlug` can return, fallback included.
 *
 * `scripts/db/ensure-categories.ts` requires a `Category` row for each one. A
 * slug the categoriser emits but the database lacks does not fail loudly: the
 * article is silently demoted to the fallback, which is exactly the bug roadmap
 * #15 fixed once already. Deriving the list here rather than restating it in the
 * script is what keeps the two from drifting apart again.
 */
export const CATEGORY_SLUGS: readonly string[] = [
  ...CATEGORY_RULES.map(([slug]) => slug),
  FALLBACK_CATEGORY_SLUG,
]

export function detectCategorySlug(title: string, content: string): string {
  const text = ` ${title} ${content} `.toLowerCase()
  for (const [slug, keywords] of CATEGORY_RULES) {
    if (keywords.some((kw) => text.includes(kw))) return slug
  }
  return FALLBACK_CATEGORY_SLUG
}

// ─── Public ───────────────────────────────────────────────────────────────────

/**
 * Transforms a batch of raw provider articles into normalized, validated articles
 * ready for deduplication and database insertion.
 */
export function normalizeArticles(raw: RawArticle[]): NormalizedArticle[] {
  const out: NormalizedArticle[] = []

  for (const a of raw) {
    // Required fields
    if (!a.title?.trim() || !a.sourceUrl?.trim()) continue
    if (isNaN(a.publishedAt?.getTime())) continue

    // NewsAPI deleted-article placeholders
    if (a.title === "[Removed]") continue
    if (a.sourceUrl === "https://removed.com") continue

    const title      = stripHtml(a.title).trim()
    const rawContent = stripHtml(a.content || a.description || "").trim()
    const content    = rawContent || title
    const summary    = stripHtml(a.description || "").trim() || content.substring(0, 200)

    const categorySlug = detectCategorySlug(title, content)

    out.push({
      title,
      content,
      summary,
      imageUrl:        a.imageUrl,
      sourceUrl:       a.sourceUrl.trim(),
      sourceName:      a.sourceName,
      publishedAt:     a.publishedAt,
      categorySlug,
      tags:            extractTags(title, categorySlug),
      importanceScore: computeImportanceScore(a.publishedAt),
      readTime:        estimateReadTime(content),
    })
  }

  return out
}
