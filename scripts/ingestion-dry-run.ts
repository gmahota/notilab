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
  console.log(`buscados: ${raw.length}   erros de provider: ${errors.length}`)
  errors.slice(0, 3).forEach(e => console.log(`  ! ${e.slice(0, 130)}`))

  const q = applyQualityGate(raw)
  console.log(`\nPORTA DE QUALIDADE: ficaram ${q.kept.length}/${raw.length}`)
  console.log(`  rejeitados por fonte:      ${q.rejected.source}`)
  console.log(`  rejeitados por formato:    ${q.rejected.shape}`)
  console.log(`  rejeitados por relevância: ${q.rejected.relevance}`)

  if (q.rejectedSources.length) {
    console.log(`\nfontes fora da allowlist (${q.rejectedSources.length}):`)
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
  console.log(`\ndedup por título no lote: -${dups}  →  ${unique.length} artigos`)

  const today = new Date().toISOString().slice(0, 10)
  const fresh = unique.filter(a => a.publishedAt.toISOString().slice(0, 10) === today)
  console.log(`publicados HOJE (${today}): ${fresh.length}`)

  console.log(`\n── O QUE ENTRARIA ──`)
  unique.slice(0, 30).forEach((a, i) => console.log(
    `${String(i + 1).padStart(2)}. [${a.publishedAt.toISOString().slice(0, 10)}] ${a.title.slice(0, 74)}\n    ${a.sourceName}`))
}
main().catch(e => { console.error(e); process.exit(1) })
