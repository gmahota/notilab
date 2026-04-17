/**
 * ai-queue.ts — Create empty ArticleAI stubs for newly ingested articles.
 *
 * This decouples ingestion from AI processing: the pipeline writes stubs
 * immediately after saving, and a separate background job (or the next
 * call to /api/ai/process) fills in summary, tldr, whyItMatters, etc.
 *
 * Plug-in point for AI enrichment:
 *
 *   1. Query: SELECT id FROM article_ai WHERE summary IS NULL LIMIT 20
 *   2. For each, call AIService.generateSummary(news.content)
 *   3. Update ArticleAI with { summary, tldr, whyItMatters, explainLikeIm10, importanceScore }
 *   4. Update News.importanceScore with the AI-recalculated value
 */

import { prisma } from "@/lib/prisma"

/**
 * Creates ArticleAI stubs for the given news IDs.
 * skipDuplicates-equivalent: records that already exist are silently ignored.
 * Returns the number of stubs created.
 */
export async function queueForAiProcessing(newsIds: string[]): Promise<number> {
  if (newsIds.length === 0) return 0

  let queued = 0
  for (const articleId of newsIds) {
    try {
      await (prisma as unknown as {
        articleAI: { create: (args: { data: { articleId: string } }) => Promise<unknown> }
      }).articleAI.create({
        data: { articleId },
      })
      queued++
    } catch {
      // Unique constraint: stub already exists — skip silently
    }
  }

  if (queued > 0) {
    console.log(`[ai-queue] Created ${queued} AI processing stub(s)`)
  }
  return queued
}
