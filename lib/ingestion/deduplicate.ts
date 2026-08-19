/**
 * deduplicate.ts — Removes articles we already have, by URL and by title.
 *
 * Pass 1 (in-memory): duplicates within the current batch.
 * Pass 2 (in-memory): near-identical titles within the batch, across outlets.
 * Pass 3 (database):  URLs and titles already stored.
 *
 * The title passes exist because URL-only matching let the same story in once
 * per aggregator: "Is the AI Bubble About to Burst?" was stored three times,
 * from Biztoc, Crypto Briefing and OilPrice, as three different URLs.
 *
 * Race condition note: under very high concurrency two identical articles could
 * slip through this check simultaneously. The @unique constraint on
 * News.sourceUrl acts as the final safety net at the DB level.
 */

import type { NormalizedArticle } from "./types"
import { prisma } from "@/lib/prisma"

export interface DeduplicationResult {
  toSave: NormalizedArticle[]
  skippedCount: number
}

/** Only compare against titles stored recently — the same headline a year apart is a different story. */
const TITLE_WINDOW_DAYS = 7

/**
 * A comparable form of a title: lowercased, unaccented, punctuation removed,
 * short words dropped. "Is the AI Bubble About to Burst?" and
 * "Is the AI bubble about to burst" both reduce to "bubble about burst".
 */
export function titleFingerprint(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .sort()
    .join(" ")
}

export async function deduplicateArticles(
  articles: NormalizedArticle[]
): Promise<DeduplicationResult> {
  if (articles.length === 0) return { toSave: [], skippedCount: 0 }

  // ── Pass 1: in-batch deduplication by URL ─────────────────────────────────
  const seenUrls = new Set<string>()
  const urlUnique = articles.filter((a) => {
    if (seenUrls.has(a.sourceUrl)) return false
    seenUrls.add(a.sourceUrl)
    return true
  })

  const batchUrlDuplicates = articles.length - urlUnique.length
  if (batchUrlDuplicates > 0) {
    console.log(`[deduplicate] Removed ${batchUrlDuplicates} in-batch URL duplicate(s)`)
  }

  // ── Pass 2: in-batch deduplication by title ───────────────────────────────
  const seenTitles = new Set<string>()
  const batchUnique = urlUnique.filter((a) => {
    const fp = titleFingerprint(a.title)
    if (!fp) return true // nothing comparable left; let the URL passes decide
    if (seenTitles.has(fp)) return false
    seenTitles.add(fp)
    return true
  })

  const batchTitleDuplicates = urlUnique.length - batchUnique.length
  if (batchTitleDuplicates > 0) {
    console.log(`[deduplicate] Removed ${batchTitleDuplicates} in-batch title duplicate(s)`)
  }

  // ── Pass 3: DB deduplication ──────────────────────────────────────────────
  const urls = batchUnique.map((a) => a.sourceUrl)
  const since = new Date(Date.now() - TITLE_WINDOW_DAYS * 86_400_000)

  const [existingByUrl, recent] = await Promise.all([
    prisma.news.findMany({
      where: { sourceUrl: { in: urls } },
      select: { sourceUrl: true },
    }) as Promise<{ sourceUrl: string }[]>,
    prisma.news.findMany({
      where: { publishedAt: { gte: since } },
      select: { title: true },
    }) as Promise<{ title: string }[]>,
  ])

  const existingUrls = new Set(existingByUrl.map((n) => n.sourceUrl))
  const existingTitles = new Set(recent.map((n) => titleFingerprint(n.title)))

  const toSave = batchUnique.filter((a) => {
    if (existingUrls.has(a.sourceUrl)) return false
    const fp = titleFingerprint(a.title)
    return !(fp && existingTitles.has(fp))
  })

  const dbSkipped = batchUnique.length - toSave.length
  if (dbSkipped > 0) {
    console.log(`[deduplicate] Skipped ${dbSkipped} article(s) already in DB (URL or title)`)
  }

  return {
    toSave,
    skippedCount: batchUrlDuplicates + batchTitleDuplicates + dbSkipped,
  }
}
