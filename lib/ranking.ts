/**
 * NotiLab Article Ranking Engine
 *
 * Scoring formula:
 *   finalScore = recency×w₁ + trendBoost×w₂ + sourceTrust×w₃ + aiImportance×w₄ + userAffinity×w₅
 *
 * All dimension scores are 0–100. Weights are feed-mode-specific and sum to 1.0.
 * finalScore is therefore also 0–100.
 *
 * Feed mode weight profiles:
 *   homepage  — balanced; recency + AI importance lead
 *   category  — recency and user affinity boosted
 *   trending  — trend overlap dominates
 *   global    — AI importance leads; most stable; used for stored rankingScore
 *
 * Decay:
 *   Exponential with 24h half-life:  recency = 100 × e^(−ln2/24 × hoursAgo)
 *   Smoother than linear; no hard cutoff — old articles converge to ~0 naturally.
 *
 * Trend overlap:
 *   Count of article tags that fuzzy-match active TrendingTopic keywords.
 *   trendBoost = min(100, matches/3 × 100)
 *   "Still trending" bonus: if article >72h old and trendBoost >60 → multiply by 1.5.
 *   This prevents relevant-but-aging stories from disappearing.
 *
 * Source trust cap:
 *   If sourcePriority < 20 (LOW_TRUST_THRESHOLD), the final score is discounted by 30%.
 *   Prevents low-credibility sources from dominating feeds even with strong other signals.
 *
 * User affinity (future-ready):
 *   When no user context is provided, returns 50 (neutral — no advantage or penalty).
 *   Plug in userCategoryIds from user preferences to activate personalization.
 *
 * Editorial prominence ('destaque'):
 *   News.priority is the newsroom's own lever over the feed, set in the CMS.
 *   It is applied as a multiplier on the composite score, not as a weighted
 *   dimension, so the five weights keep summing to 1.0 and a pinned story wins
 *   by a margin rather than by overriding the signals outright. A HIGH story
 *   leads the feed for roughly a day and an URGENT one for roughly two before
 *   recency decay hands the lead back — which is what stops a forgotten
 *   'destaque' from freezing the front page.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Controls which weight profile to apply. */
export type FeedMode = "homepage" | "category" | "trending" | "global"

/** News.priority — the CMS prominence flag an editor sets on a story. */
export type EditorialPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT"

export interface WeightProfile {
  recency: number
  trendBoost: number
  sourceTrust: number
  aiImportance: number
  userAffinity: number
}

/** Raw inputs required to score one article. */
export interface ScoringInput {
  publishedAt: Date
  /** Article tag strings (e.g. ["AI", "OpenAI", "regulation"]) */
  tags: string[]
  /** NewsSource.priority field (0-100). Pass null when no source is linked. */
  sourcePriority: number | null
  /** ArticleAI.importanceScore (0-100). Pass null when AI enrichment is pending. */
  aiImportanceScore: number | null
  /** News.importanceScore — used as fallback when aiImportanceScore is null. */
  newsImportanceScore: number
  /** Keywords loaded from TrendingTopic table. Pre-load once per batch for efficiency. */
  trendingKeywords: string[]
  /** News.categoryId — for future user affinity matching. */
  articleCategoryId?: string
  /** User's preferred category IDs. Leave undefined for anonymous / no-personalization. */
  userCategoryIds?: string[]
  /** News.priority — the editor's 'destaque' flag. Omit to treat the article as NORMAL. */
  editorialPriority?: EditorialPriority | string | null
}

export interface ScoreBreakdown {
  recency: number
  trendBoost: number
  sourceTrust: number
  aiImportance: number
  userAffinity: number
}

export interface ScoredArticle {
  /** Composite 0–100 score. Stored in News.rankingScore for feed ordering. */
  finalScore: number
  breakdown: ScoreBreakdown
  /** The News.priority multiplier that was applied. 1.0 means no editorial nudge. */
  editorialMultiplier: number
}

// ---------------------------------------------------------------------------
// Weight profiles
// ---------------------------------------------------------------------------

export const FEED_WEIGHTS: Record<FeedMode, WeightProfile> = {
  homepage: {
    recency: 0.30,
    trendBoost: 0.25,
    sourceTrust: 0.15,
    aiImportance: 0.20,
    userAffinity: 0.10,
  },
  category: {
    recency: 0.35,
    trendBoost: 0.15,
    sourceTrust: 0.15,
    aiImportance: 0.20,
    userAffinity: 0.15,
  },
  trending: {
    recency: 0.15,
    trendBoost: 0.50,
    sourceTrust: 0.10,
    aiImportance: 0.15,
    userAffinity: 0.10,
  },
  global: {
    recency: 0.25,
    trendBoost: 0.25,
    sourceTrust: 0.15,
    aiImportance: 0.25,
    userAffinity: 0.10,
  },
} as const

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Decay half-life in hours. Score halves every 24 h. */
const HALF_LIFE_HOURS = 24
const DECAY_LAMBDA = Math.LN2 / HALF_LIFE_HOURS

/** Sources with priority below this threshold get a score discount. */
const LOW_TRUST_THRESHOLD = 20
const LOW_TRUST_MULTIPLIER = 0.70

/** Number of matching tags needed to reach trendBoost = 100. */
const TREND_MATCH_TARGET = 3

/**
 * News.priority → multiplier on the composite score.
 *
 * Sized against the recency curve rather than picked for roundness: 24 h of
 * decay costs a typical story ~15 points of composite score, so HIGH (×1.35)
 * buys a pinned story about a day at the top and URGENT (×1.8) about two. LOW
 * demotes without hiding — the article still appears, just below the fold.
 */
const EDITORIAL_MULTIPLIER: Record<EditorialPriority, number> = {
  LOW: 0.75,
  NORMAL: 1.0,
  HIGH: 1.35,
  URGENT: 1.8,
}

/** Hours after which still-trending articles get a longevity bonus. */
const TREND_ALIVE_HOURS = 72
const TREND_ALIVE_MIN_BOOST = 60
const TREND_ALIVE_MULTIPLIER = 1.5

// ---------------------------------------------------------------------------
// Dimension scoring functions (each returns 0–100)
// ---------------------------------------------------------------------------

function dimRecency(publishedAt: Date): number {
  const hoursAgo = Math.max(0, (Date.now() - publishedAt.getTime()) / 3_600_000)
  return 100 * Math.exp(-DECAY_LAMBDA * hoursAgo)
}

function dimTrendBoost(tags: string[], keywords: string[], publishedAt: Date): number {
  if (tags.length === 0 || keywords.length === 0) return 0

  const normTags = tags.map((t) => t.toLowerCase().trim())
  const normKw = keywords.map((k) => k.toLowerCase().trim())

  const matches = normTags.filter((tag) =>
    normKw.some((kw) => kw.includes(tag) || tag.includes(kw)),
  ).length

  const base = Math.min(100, (matches / TREND_MATCH_TARGET) * 100)

  // Keep strongly-trending older articles alive in the feed
  const hoursOld = (Date.now() - publishedAt.getTime()) / 3_600_000
  if (hoursOld > TREND_ALIVE_HOURS && base >= TREND_ALIVE_MIN_BOOST) {
    return Math.min(100, base * TREND_ALIVE_MULTIPLIER)
  }

  return base
}

function dimSourceTrust(priority: number | null): number {
  return Math.min(100, Math.max(0, priority ?? 50))
}

function dimAIImportance(aiScore: number | null, fallback: number): number {
  return Math.min(100, Math.max(0, aiScore ?? fallback))
}

/**
 * Editorial multiplier for a News.priority value.
 * Unknown or missing values fall back to NORMAL (1.0) so a priority added to
 * the Prisma enum later cannot silently zero a story out of the feed.
 */
function editorialMultiplier(priority: EditorialPriority | string | null | undefined): number {
  if (!priority) return EDITORIAL_MULTIPLIER.NORMAL
  return EDITORIAL_MULTIPLIER[priority as EditorialPriority] ?? EDITORIAL_MULTIPLIER.NORMAL
}

/**
 * User affinity score.
 * Returns 50 (neutral) when no user context is provided so articles are
 * neither boosted nor penalised — the feed is fair for anonymous visitors.
 * Returns 100 for a preferred category, 20 for non-preferred.
 */
function dimUserAffinity(userCategoryIds?: string[], articleCategoryId?: string): number {
  if (!userCategoryIds || userCategoryIds.length === 0) return 50
  if (!articleCategoryId) return 40
  return userCategoryIds.includes(articleCategoryId) ? 100 : 20
}

// ---------------------------------------------------------------------------
// Main scoring API
// ---------------------------------------------------------------------------

/**
 * Computes the composite ranking score for a single article.
 *
 * @param input   — article data plus pre-loaded trending keywords
 * @param mode    — feed context (adjusts weight profile), defaults to "homepage"
 */
export function scoreArticle(
  input: ScoringInput,
  mode: FeedMode = "homepage",
): ScoredArticle {
  const w = FEED_WEIGHTS[mode]

  const breakdown: ScoreBreakdown = {
    recency: dimRecency(input.publishedAt),
    trendBoost: dimTrendBoost(input.tags, input.trendingKeywords, input.publishedAt),
    sourceTrust: dimSourceTrust(input.sourcePriority),
    aiImportance: dimAIImportance(input.aiImportanceScore, input.newsImportanceScore),
    userAffinity: dimUserAffinity(input.userCategoryIds, input.articleCategoryId),
  }

  const raw =
    breakdown.recency * w.recency +
    breakdown.trendBoost * w.trendBoost +
    breakdown.sourceTrust * w.sourceTrust +
    breakdown.aiImportance * w.aiImportance +
    breakdown.userAffinity * w.userAffinity

  // Apply source trust cap: discount articles from low-credibility sources
  const trustMultiplier =
    (input.sourcePriority ?? 50) < LOW_TRUST_THRESHOLD ? LOW_TRUST_MULTIPLIER : 1.0

  // Apply the newsroom's own lever last, so 'destaque' moves a story relative
  // to whatever the signals already said about it.
  const editorial = editorialMultiplier(input.editorialPriority)

  const finalScore =
    Math.round(Math.min(100, raw * trustMultiplier * editorial) * 100) / 100

  return { finalScore, breakdown, editorialMultiplier: editorial }
}

// ---------------------------------------------------------------------------
// Convenience: in-memory ranking (no DB required)
// ---------------------------------------------------------------------------

export interface ArticleForRanking {
  publishedAt: Date
  tags?: string[]
  importanceScore?: number
  sourceName?: string
  categoryId?: string
  /** News.priority, passed straight through from the row. */
  priority?: EditorialPriority | string | null
  [key: string]: unknown
}

export interface RankingOptions {
  mode?: FeedMode
  trendingKeywords?: string[]
  /** Map of sourceName → trust score (0-100) */
  sourceScores?: Record<string, number>
  userCategoryIds?: string[]
}

/**
 * Ranks an array of articles in memory — useful for small sets or SSR pages
 * where you already have the article data and just need an ordered list.
 *
 * For large feeds, prefer the DB-stored rankingScore field updated by the cron job.
 */
export function rankArticles<T extends ArticleForRanking>(
  articles: T[],
  options: RankingOptions = {},
): (T & { rankScore: number })[] {
  const {
    mode = "homepage",
    trendingKeywords = [],
    sourceScores = {},
    userCategoryIds,
  } = options

  return articles
    .map((article) => {
      const { finalScore } = scoreArticle(
        {
          publishedAt: article.publishedAt,
          tags: article.tags ?? [],
          sourcePriority: article.sourceName ? (sourceScores[article.sourceName] ?? null) : null,
          aiImportanceScore: null,
          newsImportanceScore: article.importanceScore ?? 0,
          trendingKeywords,
          articleCategoryId: article.categoryId,
          userCategoryIds,
          editorialPriority: article.priority,
        },
        mode,
      )
      return { ...article, rankScore: finalScore }
    })
    .sort((a, b) => b.rankScore - a.rankScore)
}
