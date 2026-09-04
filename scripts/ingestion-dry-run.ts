/**
 * scripts/ingestion-dry-run.ts — `pnpm ingest:dry-run`
 *
 * Fetches from the providers exactly as the cron does, applies the quality gate
 * and prints what would be stored. Writes nothing to the database.
 *
 * Use it to tune lib/ingestion/quality.ts: the report lists every domain the
 * allowlist rejected, so a legitimate outlet being dropped shows up as a name
 * to add rather than as an unexplained fall in volume.
 *
 * Costs one provider request per query in SYNC_QUERIES, against the same
 * free-tier quota the cron uses — so don't run it in a loop.
 */
import { fetchFromProviders } from "../lib/ingestion/providers"
import { applyQualityGate } from "../lib/ingestion/quality"
import { titleFingerprint } from "../lib/ingestion/deduplicate"

async function main() {
  const errors: string[] = []
  const raw = await fetchFromProviders(errors)
  console.log(`fetched: ${raw.length}   provider errors: ${errors.length}`)
  errors.slice(0, 3).forEach(e => console.log(`  ! ${e.slice(0, 130)}`))

  const q = applyQualityGate(raw)
  console.log(`\nQUALITY GATE: kept ${q.kept.length}/${raw.length}`)
  console.log(`  rejected by source:      ${q.rejected.source}`)
  console.log(`  rejected by shape:       ${q.rejected.shape}`)
  console.log(`  rejected for relevance:  ${q.rejected.relevance}`)

  if (q.rejectedSources.length) {
    console.log(`\nsources outside allowlist (${q.rejectedSources.length}):`)
    console.log(`  ${q.rejectedSources.slice(0, 28).join(", ")}`)
  }

  const fps = new Set<string>()
  let dups = 0
  const unique = q.kept.filter(a => {
    const fp = titleFingerprint(a.title)
    if (fp && fps.has(fp)) { dups++; return false }
    if (fp) fps.add(fp)
    return true
  })
  console.log(`\ndedup by title in batch: -${dups}  →  ${unique.length} articles`)

  const today = new Date().toISOString().slice(0, 10)
  const fresh = unique.filter(a => a.publishedAt.toISOString().slice(0, 10) === today)
  console.log(`published TODAY (${today}): ${fresh.length}`)

  console.log(`\n── WHAT WOULD BE INCLUDED ──`)
  unique.slice(0, 30).forEach((a, i) => console.log(
    `${String(i + 1).padStart(2)}. [${a.publishedAt.toISOString().slice(0, 10)}] ${a.title.slice(0, 74)}\n    ${a.sourceName}`))
}
main().catch(e => { console.error(e); process.exit(1) })
