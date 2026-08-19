/**
 * pipeline.ts — Orchestrates the full news ingestion pipeline.
 *
 * Flow:
 *   fetchFromProviders
 *     → applyQualityGate
 *       → normalizeArticles
 *       → deduplicateArticles
 *         → resolveCategoryIds
 *           → saveToDatabase
 *             → queueForAiProcessing
 *
 * All errors are collected and returned rather than thrown, so the cron
 * handler can report partial success and the caller decides on alerting.
 */

import { fetchFromProviders }   from "./providers"
import { applyQualityGate }     from "./quality"
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

  // ── 1b. Quality gate ──────────────────────────────────────────────────────
  // Runs before normalize so nothing off-scope is ever given an id, a category
  // or an AI-enrichment slot. See quality.ts for what each gate rejects.
  const quality = applyQualityGate(raw)
  const { source: bySource, shape: byShape, relevance: byRelevance } = quality.rejected
  console.log(
    `[pipeline] Quality gate kept ${quality.kept.length}/${raw.length} ` +
    `(dropped ${bySource} by source, ${byShape} by shape, ${byRelevance} as off-topic)`,
  )
  if (quality.rejectedSources.length > 0) {
    // Logged so an outlet wrongly missing from the allowlist is visible as a
    // name rather than as an unexplained drop in volume.
    console.log(`[pipeline] Sources not in allowlist: ${quality.rejectedSources.join(", ")}`)
  }

  if (quality.kept.length === 0) {
    return {
      fetched: raw.length, normalized: 0, skipped: 0,
      saved: 0, aiQueued: 0, errors, durationMs: Date.now() - startMs,
    }
  }

  // ── 2. Normalize ──────────────────────────────────────────────────────────
  const normalized = normalizeArticles(quality.kept)
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
