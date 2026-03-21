/**
 * NotiLab Ranking System
 * 
 * Score formula (from PRD):
 * score = recency * 0.3 + trend * 0.25 + source * 0.15 + aiImportance * 0.2 + userAffinity * 0.1
 */

interface RankingInput {
  publishedAt: Date
  trending: boolean
  sourcePriority: number  // 0-100
  aiImportanceScore: number  // 0-100
  userCategories?: string[]
  articleCategory?: string
}

interface RankedArticle {
  score: number
  breakdown: {
    recency: number
    trend: number
    source: number
    aiImportance: number
    userAffinity: number
  }
}

const WEIGHTS = {
  recency: 0.3,
  trend: 0.25,
  source: 0.15,
  aiImportance: 0.2,
  userAffinity: 0.1,
} as const

/**
 * Calculate recency score (0-100).
 * Articles < 1h old = 100, decays over 48h to 0.
 */
function calculateRecencyScore(publishedAt: Date): number {
  const hoursAgo = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60)
  if (hoursAgo < 1) return 100
  if (hoursAgo > 48) return 0
  return Math.max(0, 100 - (hoursAgo / 48) * 100)
}

/**
 * Calculate trend score (0 or 100).
 */
function calculateTrendScore(trending: boolean): number {
  return trending ? 100 : 0
}

/**
 * Calculate user affinity score based on category match.
 */
function calculateUserAffinityScore(
  userCategories: string[],
  articleCategory?: string
): number {
  if (!articleCategory || userCategories.length === 0) return 50
  return userCategories.includes(articleCategory) ? 100 : 20
}

/**
 * Calculate the composite ranking score for an article.
 */
export function calculateRankingScore(input: RankingInput): RankedArticle {
  const recency = calculateRecencyScore(input.publishedAt)
  const trend = calculateTrendScore(input.trending)
  const source = Math.min(100, Math.max(0, input.sourcePriority))
  const aiImportance = Math.min(100, Math.max(0, input.aiImportanceScore))
  const userAffinity = calculateUserAffinityScore(
    input.userCategories || [],
    input.articleCategory
  )

  const score =
    recency * WEIGHTS.recency +
    trend * WEIGHTS.trend +
    source * WEIGHTS.source +
    aiImportance * WEIGHTS.aiImportance +
    userAffinity * WEIGHTS.userAffinity

  return {
    score: Math.round(score * 100) / 100,
    breakdown: { recency, trend, source, aiImportance, userAffinity },
  }
}

/**
 * Rank an array of articles by composite score (descending).
 */
export function rankArticles<T extends { publishedAt: Date; trending: boolean; importanceScore?: number; sourceName?: string; categorySlug?: string }>(
  articles: T[],
  userCategories: string[] = [],
  sourceScores: Record<string, number> = {}
): (T & { rankScore: number })[] {
  return articles
    .map((article) => {
      const { score } = calculateRankingScore({
        publishedAt: article.publishedAt,
        trending: article.trending,
        sourcePriority: sourceScores[article.sourceName || ""] || 50,
        aiImportanceScore: article.importanceScore || 50,
        userCategories,
        articleCategory: article.categorySlug,
      })
      return { ...article, rankScore: score }
    })
    .sort((a, b) => b.rankScore - a.rankScore)
}
