/**
 * deduplicate.ts — Two-pass deduplication by sourceUrl.
 *
 * Pass 1 (in-memory): removes duplicates within the current batch.
 * Pass 2 (database):  queries existing sourceUrls in one DB round-trip,
 *                     filters out any already stored articles.
 *
 * Race condition note: under very high concurrency two identical articles could
 * slip through this check simultaneously. The @unique constraint on News.sourceUrl
 * acts as the final safety net at the DB level.
 */

import type { NormalizedArticle } from "./types"
import { prisma } from "@/lib/prisma"

export interface DeduplicationResult {
  toSave: NormalizedArticle[]
  skippedCount: number
}

export async function deduplicateArticles(
  articles: NormalizedArticle[]
): Promise<DeduplicationResult> {
  if (articles.length === 0) return { toSave: [], skippedCount: 0 }

  // ── Pass 1: in-batch deduplication ────────────────────────────────────────
  const seenUrls = new Set<string>()
  const batchUnique = articles.filter((a) => {
    if (seenUrls.has(a.sourceUrl)) return false
    seenUrls.add(a.sourceUrl)
    return true
  })

  const batchDuplicates = articles.length - batchUnique.length
  if (batchDuplicates > 0) {
    console.log(`[deduplicate] Removed ${batchDuplicates} in-batch duplicate(s)`)
  }

  // ── Pass 2: DB deduplication ──────────────────────────────────────────────
  const urls = batchUnique.map((a) => a.sourceUrl)

  const existing = await prisma.news.findMany({
    where:  { sourceUrl: { in: urls } },
    select: { sourceUrl: true },
  }) as { sourceUrl: string }[]

  const existingUrls = new Set(existing.map((n) => n.sourceUrl))

  const toSave   = batchUnique.filter((a) => !existingUrls.has(a.sourceUrl))
  const dbSkipped = batchUnique.length - toSave.length

  if (dbSkipped > 0) {
    console.log(`[deduplicate] Skipped ${dbSkipped} article(s) already in DB`)
  }

  return {
    toSave,
    skippedCount: batchDuplicates + dbSkipped,
  }
}
