/**
 * scripts/editorial/measure-review-capacity.ts — `pnpm editorial:measure`
 *
 * Phase 0 of docs/manager/strategy/ingestion-editorial-gate.md: the numbers that
 * size every later phase. Read-only — it writes nothing and deploys nothing.
 *
 * Three decisions wait on this output:
 *
 *   - Phase 3's batch size, from the enrichment backlog and the daily intake.
 *   - Phase 6's ordering. The strategy says that if review latency routinely
 *     exceeds 24 hours, the publication-window fix stops being a follow-up to
 *     the gate and becomes its prerequisite. Review does not exist yet, so its
 *     latency cannot be measured — but the budget it would have to fit inside
 *     can be. An article arrives already aged (publishedAt is the source's
 *     date, not ours), and the digest window is 24h from publishedAt, so the
 *     hours left for a human to act are 24 minus the age at ingestion. That
 *     remainder is the honest proxy, and § "Digest window" prints it.
 *   - Whether the queue outgrows the reviewer, from intake against the
 *     enrichment ceiling the strategy puts at 15/day.
 *
 * Caveat the output repeats where it matters: the crons were dead from
 * 2026-11-05 to 2026-11-12, so any per-day average over the last 30 days is
 * dragged down by a week of zeros. Rates are therefore reported per *active*
 * day as well as per calendar day, and the two should not be confused.
 */

import { PrismaClient } from "../../lib/generated/prisma"

const prisma = new PrismaClient()

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Enrichment ceiling assumed by the strategy's R3 risk. */
const ENRICHMENT_PER_DAY = 15

/** The digest's selection window, from lib/digest.ts. */
const DIGEST_WINDOW_HOURS = 24

function section(title: string): void {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 68 - title.length))}`)
}

function row(label: string, value: string | number): void {
  console.log(`  ${String(label).padEnd(44)} ${value}`)
}

/** Median of a numeric list; 0 for an empty one. */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function hours(ms: number): string {
  return `${(ms / HOUR).toFixed(1)}h`
}

async function main(): Promise<void> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY)

  console.log(`Phase 0 — review capacity measurement, ${now.toISOString()}`)
  console.log("Read-only. Nothing is written.")

  // ── Corpus ─────────────────────────────────────────────────────────────────

  section("Corpus")

  const byStatus = await prisma.news.groupBy({ by: ["status"], _count: { _all: true } })
  for (const entry of byStatus.sort((a, b) => b._count._all - a._count._all)) {
    row(entry.status, entry._count._all)
  }
  row("total", byStatus.reduce((sum, entry) => sum + entry._count._all, 0))

  // ── Intake ─────────────────────────────────────────────────────────────────

  section("Intake (last 30 days, by createdAt)")

  const recent = await prisma.news.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true, publishedAt: true, sourceName: true, importanceScore: true },
    orderBy: { createdAt: "asc" },
  })

  const perDay = new Map<string, number>()
  for (const article of recent) {
    const day = article.createdAt.toISOString().slice(0, 10)
    perDay.set(day, (perDay.get(day) ?? 0) + 1)
  }

  const activeDays = perDay.size
  const counts = [...perDay.values()]

  row("articles ingested", recent.length)
  row("days with any ingestion", activeDays)
  row("per calendar day (30d average)", (recent.length / 30).toFixed(1))
  row("per ACTIVE day", activeDays === 0 ? "n/a" : (recent.length / activeDays).toFixed(1))
  row("busiest day", counts.length === 0 ? "n/a" : Math.max(...counts))
  row("median active day", counts.length === 0 ? "n/a" : median(counts).toFixed(1))

  console.log("\n  by day:")
  for (const [day, count] of [...perDay.entries()].sort()) {
    console.log(`    ${day}  ${"█".repeat(Math.min(count, 50))} ${count}`)
  }

  // ── Digest window ──────────────────────────────────────────────────────────

  section("Digest window — the hours a reviewer would actually have")

  // publishedAt is the source's date; createdAt is when we collected it. An
  // article is already this old when it lands, and the digest only looks back
  // DIGEST_WINDOW_HOURS from publishedAt — so this is subtracted from the
  // reviewer's budget before anyone has looked at anything.
  const ages = recent
    .map((article) => article.createdAt.getTime() - article.publishedAt.getTime())
    .filter((age) => age >= 0)

  const medianAge = median(ages)
  const budget = DIGEST_WINDOW_HOURS * HOUR - medianAge

  row("median age at ingestion", ages.length === 0 ? "n/a" : hours(medianAge))
  row("digest window", `${DIGEST_WINDOW_HOURS}h from publishedAt`)
  row("hours left for review after ingestion", ages.length === 0 ? "n/a" : hours(budget))
  row(
    "share already outside the window on arrival",
    ages.length === 0
      ? "n/a"
      : `${((ages.filter((age) => age >= DIGEST_WINDOW_HOURS * HOUR).length / ages.length) * 100).toFixed(0)}%`,
  )

  // ── Enrichment backlog ─────────────────────────────────────────────────────

  section("Enrichment backlog (ArticleAI)")

  const [totalNews, withRow, noSummary, unprocessed, failed] = await Promise.all([
    prisma.news.count(),
    prisma.articleAI.count(),
    prisma.articleAI.count({ where: { summary: null } }),
    prisma.articleAI.count({ where: { processedAt: null } }),
    prisma.articleAI.count({ where: { attempts: { gt: 0 }, processedAt: null } }),
  ])

  row("news rows", totalNews)
  row("with an ArticleAI row", withRow)
  row("with NO ArticleAI row at all", totalNews - withRow)
  row("ArticleAI with summary IS NULL", noSummary)
  row("ArticleAI never processed (processedAt null)", unprocessed)
  row("of those, already failed at least once", failed)

  const stubs = await prisma.articleAI.findMany({
    where: { summary: null },
    select: { createdAt: true },
  })
  const stubAges = stubs.map((stub) => now.getTime() - stub.createdAt.getTime())
  row("median age of unprocessed stubs", stubs.length === 0 ? "n/a" : hours(median(stubAges)))

  // ── Queue arithmetic ───────────────────────────────────────────────────────

  section("Queue arithmetic")

  const perActiveDay = activeDays === 0 ? 0 : recent.length / activeDays
  row("intake per active day", perActiveDay.toFixed(1))
  row("enrichment ceiling assumed by the strategy", `${ENRICHMENT_PER_DAY}/day`)
  row(
    "net queue growth per active day",
    `${(perActiveDay - ENRICHMENT_PER_DAY).toFixed(1)} (negative = drains)`,
  )
  row(
    "reviewer rate needed to hold the queue flat",
    `${Math.ceil(perActiveDay)} articles/day`,
  )

  // ── Sources ────────────────────────────────────────────────────────────────

  section("Sources (last 30 days) — does a trust threshold change anything?")

  const bySource = new Map<string, number>()
  for (const article of recent) {
    bySource.set(article.sourceName, (bySource.get(article.sourceName) ?? 0) + 1)
  }

  row("distinct sources", bySource.size)
  for (const [name, count] of [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    row(`  ${name}`, count)
  }

  const configured = await prisma.newsSource.count()
  const activeConfigured = await prisma.newsSource.count({ where: { isActive: true } })
  row("NewsSource rows configured", `${configured} (${activeConfigured} active)`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error)
    await prisma.$disconnect()
    process.exit(1)
  })
