/**
 * archive-out-of-scope-content.ts
 *
 * Implements docs/editor/content-focus.md Section F: bulk-transition News rows
 * that fall outside the new editorial scope (world football / Real Madrid /
 * PT-EN-ES top-team backstage / Mozambique politics / South Africa xenophobia)
 * from PUBLISHED to ARCHIVED, and clear the off-scope seeded TrendingTopic rows.
 *
 * Never deletes News — preserves sourceUrl/provenance and avoids orphaning
 * ArticleAI/reactions/read-history rows (schema.prisma). TrendingTopic rows
 * have no relations and no archive-style field, so those are deleted outright
 * and left for the recalculate-ranking cron to re-derive.
 *
 * Two archiving rules:
 *   1. Any PUBLISHED article in a wholly-retired category (politica, leis,
 *      economia, tecnologia, ciencia, cultura) is archived unconditionally —
 *      the category itself is out of scope, no content judgment needed.
 *   2. Articles in "desporto" are football-scoped now, but the category used
 *      to hold all sport. Each PUBLISHED desporto article is keyword-classified
 *      as football (kept) or non-football sport (archived). Anything that
 *      matches both, or neither, is left untouched and reported for a REVISOR
 *      to decide by hand — per the doc, this is deliberately NOT auto-swept.
 *
 * Defaults to a dry run (report only). Pass --execute to apply changes.
 *
 * Usage:
 *   tsx scripts/archive-out-of-scope-content.ts            # dry run
 *   tsx scripts/archive-out-of-scope-content.ts --execute  # apply
 */

import { PrismaClient, NewsStatus, UserRole, type News } from "@prisma/client"

const prisma = new PrismaClient()

const EXECUTE = process.argv.includes("--execute")

const RETIRED_CATEGORY_SLUGS = ["politica", "leis", "economia", "tecnologia", "ciencia", "cultura"]

// Off-scope TrendingTopic.category labels (English labels used by lib/trends.ts / seed.ts)
const RETIRED_TREND_CATEGORY_LABELS = ["technology", "politics", "economy", "science", "laws", "culture"]

// Keyword lists mirror docs/editor/content-focus.md Section E (desporto rules),
// extended with unambiguous non-football sport terms for the reverse check.
const FOOTBALL_KEYWORDS = [
  "real madrid", "barcelona", "atletico madrid", "atlético madrid",
  "benfica", "fc porto", "sporting cp", "sporting clube",
  "manchester city", "manchester united", "liverpool",
  "chelsea", "arsenal", "tottenham",
  "premier league", "la liga", "laliga", "liga portugal",
  "champions league", "world cup", "copa do mundo", "fifa", "uefa",
  "football", "futebol", "soccer", "transfer window", "bastidores",
  "ronaldo", "messi", "var ", "offside",
]

const NON_FOOTBALL_SPORT_KEYWORDS = [
  "formula 1", " f1 ", "f1:", "grand prix",
  "nba", "basketball", "basquete",
  "tennis", "ténis", "grand slam", "wimbledon", "roland garros", "australian open",
  "rugby",
  "cycling", "cyclist", "volta a portugal", "tour de france", "giro d'italia",
  "surf", "surfing", "nazaré wave", "nazare wave",
  "ufc", "mma", "mixed martial arts",
  "cricket",
  "golf", "ryder cup",
  "esports", "e-sports", "valorant", "league of legends", "dota", "counter-strike",
  "swimming", "swimmer",
  "olympics", "olympic games", "jogos olímpicos", "breakdancing",
  "athletics", "marathon", "atletismo",
  "volleyball", "voleibol",
  "handball", "andebol",
  "hockey",
  "boxing", "boxe",
  "motogp", "nfl", "mlb", "nhl",
]

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k))
}

function classifyDesportoArticle(article: News): "keep" | "archive" | "review" {
  const text = ` ${article.title} ${article.content} ${article.summary ?? ""} ${article.tags.join(" ")} `.toLowerCase()
  const isFootball = matchesAny(text, FOOTBALL_KEYWORDS)
  const isNonFootball = matchesAny(text, NON_FOOTBALL_SPORT_KEYWORDS)

  if (isFootball && !isNonFootball) return "keep"
  if (isNonFootball && !isFootball) return "archive"
  return "review" // matches both, or neither — needs a human (REVISOR), not a keyword sweep
}

/**
 * No ADMIN/SUPER_ADMIN is seeded anywhere (prisma/seed.ts). Prefer an existing
 * admin if one has since been created in this DB; otherwise upsert a dedicated,
 * clearly-labelled system account so AdminAction rows have a valid attribution.
 */
async function resolveMigrationActorId(): Promise<string> {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: { in: [UserRole.SUPER_ADMIN, UserRole.ADMIN] }, isActive: true },
    orderBy: { createdAt: "asc" },
  })
  if (existingAdmin) return existingAdmin.id

  const systemUser = await prisma.user.upsert({
    where: { email: "system.contentops@notilab.internal" },
    update: {},
    create: {
      email: "system.contentops@notilab.internal",
      name: "System · Content Policy Migration",
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  })
  return systemUser.id
}

async function main() {
  console.log(`\n${EXECUTE ? "⚡ EXECUTE mode — changes will be written" : "🔍 DRY RUN — no changes will be written (pass --execute to apply)"}\n`)

  // ── 1. Retired categories: unconditional archive of PUBLISHED rows ──────────
  const retiredCategories = await prisma.category.findMany({
    where: { slug: { in: RETIRED_CATEGORY_SLUGS } },
  })
  const retiredCategoryIds = retiredCategories.map((c) => c.id)

  const retiredCategoryArticles = retiredCategoryIds.length
    ? await prisma.news.findMany({
        where: { categoryId: { in: retiredCategoryIds }, status: NewsStatus.PUBLISHED },
      })
    : []

  console.log(`Retired categories present in DB: ${retiredCategories.map((c) => c.slug).join(", ") || "(none)"}`)
  console.log(`PUBLISHED articles to archive (retired category): ${retiredCategoryArticles.length}`)

  // ── 2. desporto: keyword classification ──────────────────────────────────────
  const desportoCategory = await prisma.category.findUnique({ where: { slug: "desporto" } })
  const desportoArticles = desportoCategory
    ? await prisma.news.findMany({
        where: { categoryId: desportoCategory.id, status: NewsStatus.PUBLISHED },
      })
    : []

  const desportoArchive: News[] = []
  const desportoReview: News[] = []
  for (const article of desportoArticles) {
    const verdict = classifyDesportoArticle(article)
    if (verdict === "archive") desportoArchive.push(article)
    else if (verdict === "review") desportoReview.push(article)
    // "keep" → stays PUBLISHED, no action
  }

  console.log(`\ndesporto PUBLISHED articles: ${desportoArticles.length}`)
  console.log(`  → non-football, archiving: ${desportoArchive.length}`)
  console.log(`  → football, staying PUBLISHED: ${desportoArticles.length - desportoArchive.length - desportoReview.length}`)
  console.log(`  → ambiguous, needs REVISOR: ${desportoReview.length}`)
  if (desportoReview.length) {
    console.log("\n  Needs-review list (left untouched — decide by hand):")
    for (const a of desportoReview) console.log(`    - [${a.id}] ${a.title}`)
  }

  const allArchiveCandidates = [...retiredCategoryArticles, ...desportoArchive]

  // ── 3. TrendingTopic cleanup ─────────────────────────────────────────────────
  const allTrends = await prisma.trendingTopic.findMany()
  const trendsToClear = allTrends.filter((t) => {
    const categoryLabel = (t.category ?? "").toLowerCase()
    if (RETIRED_TREND_CATEGORY_LABELS.includes(categoryLabel)) return true
    const keywordText = ` ${t.keyword} `.toLowerCase()
    const isFootball = matchesAny(keywordText, FOOTBALL_KEYWORDS)
    const isNonFootball = matchesAny(keywordText, NON_FOOTBALL_SPORT_KEYWORDS)
    return isNonFootball && !isFootball
  })

  console.log(`\nTrendingTopic rows: ${allTrends.length} total, ${trendsToClear.length} off-scope to clear`)
  for (const t of trendsToClear) console.log(`    - ${t.keyword} (${t.category})`)

  console.log(`\n── Summary ──`)
  console.log(`News rows to archive: ${allArchiveCandidates.length}`)
  console.log(`TrendingTopic rows to delete: ${trendsToClear.length}`)
  console.log(`News rows flagged for human review (untouched): ${desportoReview.length}`)

  if (!EXECUTE) {
    console.log(`\nDry run complete. Re-run with --execute to apply.\n`)
    return
  }

  // ── 4. Apply ──────────────────────────────────────────────────────────────────
  const actorId = await resolveMigrationActorId()
  console.log(`\nAttributing AdminAction rows to user ${actorId}`)

  const CHUNK_SIZE = 50
  let archivedCount = 0
  for (let i = 0; i < allArchiveCandidates.length; i += CHUNK_SIZE) {
    const chunk = allArchiveCandidates.slice(i, i + CHUNK_SIZE)
    await prisma.$transaction(
      chunk.flatMap((article) => [
        prisma.news.update({
          where: { id: article.id },
          data: { status: NewsStatus.ARCHIVED },
        }),
        prisma.adminAction.create({
          data: {
            userId: actorId,
            action: "ARCHIVE",
            resource: "NEWS",
            resourceId: article.id,
            details: {
              reason: "content-focus-pivot",
              previousStatus: NewsStatus.PUBLISHED,
              categoryId: article.categoryId,
            },
          },
        }),
      ]),
    )
    archivedCount += chunk.length
  }
  console.log(`✅ Archived ${archivedCount} News rows (+ ${archivedCount} AdminAction audit rows)`)

  if (trendsToClear.length) {
    const { count } = await prisma.trendingTopic.deleteMany({
      where: { id: { in: trendsToClear.map((t) => t.id) } },
    })
    console.log(`✅ Cleared ${count} off-scope TrendingTopic rows`)
  }

  console.log(`\nDone. ${desportoReview.length} desporto articles still need REVISOR judgment (see list above) — not touched.\n`)
}

main()
  .catch((e) => {
    console.error("❌ Migration error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
