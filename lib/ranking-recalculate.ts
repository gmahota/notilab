import { prisma } from "./prisma"
import { scoreArticle, FeedMode } from "./ranking"

// ---------------------------------------------------------------------------
// Types for DB rows loaded during recalculation
// ---------------------------------------------------------------------------

interface ArticleRow {
  id: string
  publishedAt: Date
  tags: string[]
  importanceScore: number
  categoryId: string | null
  source: { priority: number } | null
  articleAI: { importanceScore: number } | null
}

// Cast to access models and methods not in the mock Prisma client
type PrismaExt = typeof prisma & {
  trendingTopic: {
    findMany: (args: Record<string, unknown>) => Promise<Array<{ keyword: string }>>
  }
  news: {
    findMany: (args: Record<string, unknown>) => Promise<ArticleRow[]>
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>
  }
  $transaction: (ops: unknown[]) => Promise<unknown[]>
}

export interface RecalculateResult {
  total: number
  updated: number
  errors: number
  durationMs: number
}

/** Number of DB updates wrapped in one Prisma transaction. */
const BATCH_SIZE = 50

/**
 * Recalculates and persists `rankingScore` for every News article.
 *
 * Uses the "global" weight profile — a balanced composite that produces a
 * stable, general-purpose score suitable for all feeds. Individual feed modes
 * (homepage, category, trending) can re-rank in memory using `rankArticles()`
 * when serving requests, using the stored score only as a fast DB index.
 *
 * Strategy:
 *  1. Load active TrendingTopic keywords once (top 50 by volume).
 *  2. Load all News rows with source priority and ArticleAI score.
 *  3. Score every article with `scoreArticle()`.
 *  4. Persist in batched Prisma transactions (BATCH_SIZE updates each).
 */
export async function recalculateAllRankings(): Promise<RecalculateResult> {
  const start = Date.now()
  const db = prisma as unknown as PrismaExt

  // 1. Load trending keywords
  const trendRows = await db.trendingTopic.findMany({
    select: { keyword: true },
    orderBy: { searchVolume: "desc" },
    take: 50,
  })
  const trendingKeywords = trendRows.map((t: { keyword: string }) => t.keyword)

  // 2. Load all articles with the fields needed for scoring
  const articles = await db.news.findMany({
    select: {
      id: true,
      publishedAt: true,
      tags: true,
      importanceScore: true,
      categoryId: true,
      source: { select: { priority: true } },
      articleAI: { select: { importanceScore: true } },
    },
  })

  // 3. Score every article
  const scored = articles.map((article: ArticleRow) => {
    const { finalScore } = scoreArticle(
      {
        publishedAt: article.publishedAt,
        tags: article.tags ?? [],
        sourcePriority: article.source?.priority ?? null,
        aiImportanceScore: article.articleAI?.importanceScore ?? null,
        newsImportanceScore: article.importanceScore ?? 0,
        trendingKeywords,
        articleCategoryId: article.categoryId ?? undefined,
      },
      "global" satisfies FeedMode,
    )
    return { id: article.id, rankingScore: finalScore }
  })

  // 4. Persist in batches
  let updated = 0
  let errors = 0

  for (let i = 0; i < scored.length; i += BATCH_SIZE) {
    const batch = scored.slice(i, i + BATCH_SIZE)

    try {
      await db.$transaction(
        batch.map(({ id, rankingScore }: { id: string; rankingScore: number }) =>
          db.news.update({ where: { id }, data: { rankingScore } }),
        ),
      )
      updated += batch.length
    } catch (err) {
      console.error(
        `[recalculate-ranking] Batch ${i}–${i + batch.length - 1} failed:`,
        err instanceof Error ? err.message : err,
      )
      errors += batch.length
    }
  }

  return { total: articles.length, updated, errors, durationMs: Date.now() - start }
}
