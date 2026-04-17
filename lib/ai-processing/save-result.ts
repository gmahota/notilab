import prisma from "../prisma"
import { AIEnrichmentResult } from "./types"

// The real Prisma client exposes models not present in the mock.
// We cast to access `articleAI` safely until `prisma generate` is run.
type PrismaWithAI = typeof prisma & {
  articleAI: {
    update: (args: {
      where: { id: string }
      data: Record<string, unknown>
    }) => Promise<unknown>
  }
}

/**
 * Persists a successful enrichment result to ArticleAI and updates the
 * parent News record with summary, sentiment, readTime and importanceScore.
 */
export async function saveEnrichmentResult(
  articleAIId: string,
  newsId: string,
  result: AIEnrichmentResult,
): Promise<void> {
  const db = prisma as unknown as PrismaWithAI

  await (db.articleAI as PrismaWithAI["articleAI"]).update({
    where: { id: articleAIId },
    data: {
      summary: result.summary,
      tldr: result.tldr,
      whyItMatters: result.whyItMatters,
      explainLikeIm10: result.explainLikeIm10,
      importanceScore: result.importanceScore,
      processedAt: new Date(),
      attempts: { increment: 1 },
      lastError: null,
    },
  })

  await (prisma as unknown as {
    news: {
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>
    }
  }).news.update({
    where: { id: newsId },
    data: {
      aiSummary: result.summary,
      sentiment: result.sentiment,
      readTime: result.readTime,
      importanceScore: result.importanceScore,
    },
  })
}

/**
 * Records a failed attempt on the ArticleAI stub so we can skip it
 * after MAX_ATTEMPTS retries.
 */
export async function recordFailedAttempt(
  articleAIId: string,
  error: string,
): Promise<void> {
  const db = prisma as unknown as PrismaWithAI

  await (db.articleAI as PrismaWithAI["articleAI"]).update({
    where: { id: articleAIId },
    data: {
      attempts: { increment: 1 },
      lastError: error.slice(0, 500),
    },
  })
}
