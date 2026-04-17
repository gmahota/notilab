/**
 * pipeline.ts — Orchestrates the full news ingestion pipeline.
 *
 * Flow:
 *   fetchFromProviders
 *     → normalizeArticles
 *       → deduplicateArticles
 *         → resolveCategoryIds
 *           → saveToDatabase
 *             → queueForAiProcessing
 *
 * All errors are collected and returned rather than thrown, so the cron
 * handler can report partial success and the caller decides on alerting.
 */

import { fetchFromProviders }   from "./providers"
import { normalizeArticles }    from "./normalize"
import { deduplicateArticles }  from "./deduplicate"
import { resolveCategoryIds }   from "./categorize"
import { saveToDatabase }       from "./persist"
import { queueForAiProcessing } from "./ai-queue"
import type { IngestionResult } from "./types"

export async function runIngestionPipeline(): Promise<IngestionResult> {
  const startMs  = Date.now()
  const errors: string[] = []

  // ── 1. Fetch ──────────────────────────────────────────────────────────────
  console.log("[pipeline] Starting ingestion run")
  const raw = await fetchFromProviders(errors)
  console.log(`[pipeline] Fetched ${raw.length} raw article(s)`)

  if (raw.length === 0) {
    return {
      fetched: 0, normalized: 0, skipped: 0,
      saved: 0, aiQueued: 0, errors, durationMs: Date.now() - startMs,
    }
  }

  // ── 2. Normalize ──────────────────────────────────────────────────────────
  const normalized = normalizeArticles(raw)
  console.log(`[pipeline] Normalized ${normalized.length} valid article(s) (dropped ${raw.length - normalized.length})`)

  if (normalized.length === 0) {
    return {
      fetched: raw.length, normalized: 0, skipped: 0,
      saved: 0, aiQueued: 0, errors, durationMs: Date.now() - startMs,
    }
  }

  // ── 3. Deduplicate ────────────────────────────────────────────────────────
  const { toSave, skippedCount } = await deduplicateArticles(normalized)
  console.log(`[pipeline] ${toSave.length} new article(s) to save, ${skippedCount} duplicate(s) skipped`)

  if (toSave.length === 0) {
    return {
      fetched: raw.length, normalized: normalized.length, skipped: skippedCount,
      saved: 0, aiQueued: 0, errors, durationMs: Date.now() - startMs,
    }
  }

  // ── 4. Resolve category IDs ───────────────────────────────────────────────
  const slugs       = toSave.map((a) => a.categorySlug)
  const categoryMap = await resolveCategoryIds(slugs)

  // ── 5. Persist ────────────────────────────────────────────────────────────
  const { saved, savedIds } = await saveToDatabase(toSave, categoryMap, errors)
  console.log(`[pipeline] Saved ${saved} article(s)`)

  // ── 6. Queue AI processing ────────────────────────────────────────────────
  const aiQueued = await queueForAiProcessing(savedIds)

  // ── Done ──────────────────────────────────────────────────────────────────
  const result: IngestionResult = {
    fetched:    raw.length,
    normalized: normalized.length,
    skipped:    skippedCount,
    saved,
    aiQueued,
    errors,
    durationMs: Date.now() - startMs,
  }

  if (errors.length > 0) {
    console.warn(`[pipeline] Completed with ${errors.length} error(s) in ${result.durationMs}ms`)
  } else {
    console.log(`[pipeline] Completed successfully in ${result.durationMs}ms`)
  }

  return result
}
