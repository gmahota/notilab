import { prisma } from "../prisma"
import { ArticleAIStub, ProcessorResult } from "./types"
import { buildEnrichmentPrompt } from "./prompt"
import { callAI } from "./call-ai"
import { parseAIOutput } from "./parse-output"
import { generateFallback } from "./fallback"
import { saveEnrichmentResult, recordFailedAttempt } from "./save-result"

const MAX_ATTEMPTS = 3
const MIN_CONTENT_LENGTH = 100

// Cast for models not present in mock Prisma client
type PrismaWithAI = typeof prisma & {
  articleAI: {
    findMany: (args: Record<string, unknown>) => Promise<ArticleAIStub[]>
  }
}

/**
 * Selects unprocessed ArticleAI stubs from the database and enriches them
 * with AI-generated summaries, sentiment, and importance scores.
 *
 * An article is "pending" when it is missing either its summary or its
 * Portuguese headline, and has not exceeded the maximum retry attempts.
 *
 * Including `titleTranslated IS NULL` is what backfills articles enriched
 * before translation existed: they already have a summary, so a `summary IS
 * NULL` filter alone would leave their foreign-language headlines in the feed
 * forever. It also covers the case where a run produced a summary but no title.
 * Bounded by MAX_ATTEMPTS, so a persistently untranslatable article stops
 * consuming batch slots rather than looping.
 *
 * Falls back to heuristic enrichment if the AI call fails or produces
 * unparseable output, so every article ends up with some summary.
 */
export async function runAiBatch(batchSize = 15): Promise<ProcessorResult> {
  const result: ProcessorResult = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  const db = prisma as unknown as PrismaWithAI

  const stubs: ArticleAIStub[] = await (
    db.articleAI as PrismaWithAI["articleAI"]
  ).findMany({
    where: {
      OR: [{ summary: null }, { titleTranslated: null }],
      attempts: { lt: MAX_ATTEMPTS },
    },
    take: batchSize,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      articleId: true,
      attempts: true,
      titleTranslated: true,
      article: {
        select: {
          id: true,
          title: true,
          content: true,
          summary: true,
          sourceName: true,
        },
      },
    },
  })

  result.total = stubs.length

  for (const stub of stubs) {
    const { article } = stub
    const contentLength = (article.content ?? article.summary ?? "").length

    // Skip articles with insufficient content
    if (contentLength < MIN_CONTENT_LENGTH) {
      result.skipped++
      result.errors.push({
        articleId: stub.articleId,
        reason: `Content too short (${contentLength} chars)`,
      })
      continue
    }

    try {
      const prompt = buildEnrichmentPrompt(
        article.title,
        article.content,
        article.summary,
      )

      let enriched = null

      try {
        const rawResponse = await callAI(prompt)
        enriched = parseAIOutput(rawResponse)
      } catch (aiError) {
        const message = aiError instanceof Error ? aiError.message : String(aiError)
        console.warn(`[ai-batch] AI call failed for ${stub.articleId}: ${message}`)
      }

      if (!enriched) {
        // Use heuristic fallback so the article still gets a summary
        enriched = generateFallback(article.title, article.content, article.summary)
      }

      await saveEnrichmentResult(stub.id, stub.articleId, enriched)
      result.succeeded++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[ai-batch] Failed to process ${stub.articleId}: ${message}`)

      try {
        await recordFailedAttempt(stub.id, message)
      } catch {
        // Non-critical — best effort
      }

      result.failed++
      result.errors.push({ articleId: stub.articleId, reason: message })
    }
  }

  return result
}
