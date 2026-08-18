/**
 * NotiLab trending topics.
 *
 * Derived from our own ingested articles — there is no external trends API in
 * play. This replaced a hardcoded list that was being persisted into
 * `trending_topics` and served for months (see DEPLOYMENT.md § Cron Jobs and
 * the route's TTL comment).
 *
 * Why engagement and not mention count
 * ------------------------------------
 * `lib/ranking-recalculate.ts` feeds these keywords back into the ranking: an
 * article gets a trend boost for each tag matching a trending keyword. If
 * "trending" meant "the tag we published most", that loop would amplify
 * whatever the ingestion happens to over-cover — and `SYNC_QUERIES` in
 * lib/ingestion/providers.ts is deliberately football-heavy, so football would
 * pin itself to the top of the feed forever and never let go.
 *
 * Scoring by reader engagement breaks that: what we choose to publish does not
 * create a trend, what readers actually open does. The ranking feedback then
 * becomes an ordinary popularity signal rather than a self-fulfilling one.
 *
 * Coverage fallback
 * -----------------
 * A database with articles but no traffic yet would produce nothing at all, so
 * when the window holds zero engagement we fall back to recency-weighted
 * mention counts and report `mode: "coverage"`. That mode *is* subject to the
 * circularity above — it exists so a fresh deployment isn't blank, and should
 * give way to "engagement" as soon as there are readers.
 */

import { prisma } from "./prisma"

export interface TrendItem {
  keyword: string
  volume: number
  description: string
  category: string
  region: string
}

/**
 * What `volume` counts, so callers can label it truthfully instead of calling
 * everything "searches" like the old external-API shape did.
 *
 * - `engagement`: reads + reactions + saves across articles carrying the tag
 * - `coverage`: recency-weighted article mentions (no reader signal yet)
 */
export type TrendMode = "engagement" | "coverage"

export interface TrendingResult {
  mode: TrendMode
  topics: TrendItem[]
}

/**
 * How far back to look for trending signal.
 *
 * Wide enough that one missed ingestion run doesn't blank the section, narrow
 * enough that "trending" still means recent. If ingestion stops for longer than
 * this, trending legitimately goes empty — we genuinely don't know what is
 * trending, and the UI hides the section rather than inventing topics.
 */
const DEFAULT_WINDOW_DAYS = 7

/** Articles newer than this get their mentions counted double in coverage mode. */
const RECENT_HOURS = 24

/** Tags shorter than this are too generic to be a topic. */
const MIN_KEYWORD_LENGTH = 3

/**
 * Gate: is `News.tags` good enough to derive public-facing topics from?
 *
 * Currently no. `extractTags` in lib/ingestion/normalize.ts takes the first four
 * words of the title over three characters plus the category slug:
 *
 *   "Is the AI Bubble About to Burst?"  →  ["bubble", "burst", "tecnologia"]
 *
 * Those are positional title fragments, not topics. Measured against the 142
 * articles currently stored, the highest-frequency tags are "general", "news",
 * "today", "world", "live"; after excluding category slugs, generic news words,
 * single-occurrence tags and anything appearing in >10% of articles, what
 * survives is still "announces", "creates", "launches", "three", "global", plus
 * three separate spellings of Portugal. No stopword list fixes verbs and
 * morphological variants.
 *
 * So the aggregation below runs and is unit-testable, but the public list stays
 * empty on purpose — the UI hides the section rather than showing word salad.
 * Flip this to `true` once tags carry real entities (extract capitalised
 * multi-word phrases from the original-case title, or add a topics field to the
 * AI enrichment now that an AI provider is configured). Nothing else needs to
 * change: the section reappears by itself.
 */
const TAGS_ARE_TOPIC_QUALITY = false

interface TagAggregate {
  /** Original casing of the first occurrence, used for display. */
  keyword: string
  engagement: number
  mentions: number
  /** Best article for this tag — highest engagement, newest as tiebreak. */
  bestTitle: string
  bestEngagement: number
  bestPublishedAt: Date
  category: string
}

/**
 * Builds the trending list from articles published in the last WINDOW_DAYS.
 * Returns an empty array when there is nothing to derive from — callers should
 * treat that as "no trending data", not as an error.
 */
export async function fetchTrendingTopics(
  region = "PT",
  limit = 10,
  windowDays = DEFAULT_WINDOW_DAYS,
): Promise<TrendingResult> {
  const since = new Date(Date.now() - windowDays * 24 * 3_600_000)

  const articles = await prisma.news.findMany({
    where: { status: "PUBLISHED", publishedAt: { gte: since } },
    select: {
      title: true,
      tags: true,
      publishedAt: true,
      category: { select: { name: true } },
      _count: { select: { readHistory: true, reactions: true, savedBy: true } },
    },
  })

  if (articles.length === 0) return { mode: "coverage", topics: [] }

  const recentCutoff = Date.now() - RECENT_HOURS * 3_600_000
  const byTag = new Map<string, TagAggregate>()

  for (const article of articles) {
    const engagement =
      article._count.readHistory + article._count.reactions + article._count.savedBy
    const categoryName = article.category?.name ?? "News"
    const isRecent = article.publishedAt.getTime() >= recentCutoff

    for (const rawTag of article.tags) {
      const keyword = rawTag.trim()
      if (keyword.length < MIN_KEYWORD_LENGTH) continue
      // A tag that just restates the category is not a topic.
      if (keyword.toLowerCase() === categoryName.toLowerCase()) continue

      const key = keyword.toLowerCase()
      const existing = byTag.get(key)

      if (!existing) {
        byTag.set(key, {
          keyword,
          engagement,
          mentions: isRecent ? 2 : 1,
          bestTitle: article.title,
          bestEngagement: engagement,
          bestPublishedAt: article.publishedAt,
          category: categoryName,
        })
        continue
      }

      existing.engagement += engagement
      existing.mentions += isRecent ? 2 : 1

      const beatsOnEngagement = engagement > existing.bestEngagement
      const tiesAndNewer =
        engagement === existing.bestEngagement &&
        article.publishedAt > existing.bestPublishedAt

      if (beatsOnEngagement || tiesAndNewer) {
        existing.bestTitle = article.title
        existing.bestEngagement = engagement
        existing.bestPublishedAt = article.publishedAt
        existing.category = categoryName
      }
    }
  }

  const aggregates = [...byTag.values()]
  if (aggregates.length === 0) return { mode: "coverage", topics: [] }

  // Prefer engagement; fall back to coverage only when nobody has engaged yet.
  const totalEngagement = aggregates.reduce((sum, a) => sum + a.engagement, 0)
  const mode: TrendMode = totalEngagement > 0 ? "engagement" : "coverage"

  if (!TAGS_ARE_TOPIC_QUALITY) {
    return { mode, topics: [] }
  }

  const topics = aggregates
    .map((a) => ({
      keyword: a.keyword,
      volume: mode === "engagement" ? a.engagement : a.mentions,
      description: a.bestTitle,
      category: a.category,
      region,
    }))
    .filter((t) => t.volume > 0)
    .sort((a, b) => b.volume - a.volume || a.keyword.localeCompare(b.keyword))
    .slice(0, limit)

  return { mode, topics }
}
