/**
 * scripts/ingestion-dry-run.ts — `pnpm ingest:dry-run`
 *
 * Fetches from the providers exactly as the cron does, applies the quality gate
 * and prints what would be stored. Writes nothing to the database.
 *
 * Use it to tune lib/ingestion/quality.ts and lib/ingestion/image-rights.ts:
 * the report lists every source domain and every image host the allowlists
 * rejected, so a legitimate outlet being dropped — or an outlet losing its
 * pictures — shows up as a name to add rather than as an unexplained fall in
 * volume.
 *
 * Costs one provider request per query in SYNC_QUERIES, against the same
 * free-tier quota the cron uses — so don't run it in a loop.
 */
import { fetchFromProviders } from "../lib/ingestion/providers"
import { applyQualityGate } from "../lib/ingestion/quality"
import { normalizeArticles } from "../lib/ingestion/normalize"
import { applyImageRights } from "../lib/ingestion/image-rights"
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

  // Same pass the pipeline runs, so the image hosts printed here are exactly
  // the ones that would lose their picture in a real run. Nothing is written.
  const images = applyImageRights(normalizeArticles(q.kept))
  const withImage = images.articles.filter(a => a.imageUrl).length
  console.log(`\nIMAGE RIGHTS: kept ${withImage}/${images.articles.length} image(s)`)
  console.log(`  rejected unlicensed host: ${images.rejected.unlicensedHost}`)
  console.log(`  rejected non-HTTPS:       ${images.rejected.insecure}`)
  console.log(`  rejected non-photo:       ${images.rejected.nonPhoto}`)
  console.log(`  rejected unusable URL:    ${images.rejected.unusableUrl}`)
  if (images.unlicensedImageHosts.length) {
    // The allowlist-candidate list, and only that. Adding any of these is an
    // editorial decision (SUPERVISOR+, licence basis recorded) per
    // docs/editor/ingestion-editorial-workflow.md § 4.3.
    console.log(`\nimage hosts without a licence basis (${images.unlicensedImageHosts.length}):`)
    console.log(`  ${images.unlicensedImageHosts.slice(0, 28).join(", ")}`)
  }
  if (images.otherDroppedImageHosts.length) {
    console.log(`\nimages dropped for other reasons, from (${images.otherDroppedImageHosts.length}):`)
    console.log(`  ${images.otherDroppedImageHosts.slice(0, 28).join(", ")}`)
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
