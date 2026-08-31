/**
 * scripts/backfill-stories.ts
 *
 * Populates the NOW V2 `Story` tables from existing `News` rows.
 *
 * This is NOT clustering. It creates one Story per published article, each with
 * a single source — the honest starting point, because nothing in the codebase
 * can yet tell that a Reuters and an AP article describe the same event (spec
 * § 19/§ 20, Sprint 3). Running it changes *where* `/now` reads from, not what
 * it shows: `lib/story-service.ts` produces the same read model either way.
 *
 * Why run it at all, then? It makes the Story path live, so clustering can start
 * merging real rows instead of having to create the whole table structure and
 * the merge logic in one step.
 *
 * Deliberately conservative:
 *   - **Dry run by default.** Writes only with `--apply`.
 *   - **Idempotent.** Skips any article that already has `storyId` set, so it is
 *     safe to re-run after ingestion adds more articles.
 *   - **Additive.** Never edits or deletes a `News` row beyond setting its
 *     `storyId`, and never touches an existing Story.
 *
 * IMPORTANT: this project's local `.env` points at the same database the
 * deployment uses. Running with `--apply` writes to that database. Check
 * `DATABASE_URL` before you do.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-stories.ts              # dry run, report only
 *   pnpm tsx scripts/backfill-stories.ts --apply      # write
 *   pnpm tsx scripts/backfill-stories.ts --limit 50   # cap how many are handled
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const APPLY = process.argv.includes("--apply")
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit")
  if (i === -1) return Number.POSITIVE_INFINITY
  const parsed = Number.parseInt(process.argv[i + 1] ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.POSITIVE_INFINITY
})()

/** Rows handled per transaction — keeps a long run from holding one big lock. */
const BATCH_SIZE = 25

/** Card-length summary target (spec § 4: ~180 characters). */
const SUMMARY_MAX = 200

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

/**
 * Card-length "what happened", from the shortest real text available. Mirrors
 * `newsWhatHappened` in `lib/story-service.ts` so a backfilled story reads the
 * same as the derived one it replaces.
 */
function toSummary(article: {
  content: string
  summary: string | null
  articleAI: { tldr: string | null; summary: string | null } | null
}): string {
  const candidate = article.articleAI?.tldr ?? article.articleAI?.summary ?? article.summary ?? ""
  if (candidate.trim().length > 0) return candidate.trim()

  const body = article.content.trim().replace(/\s+/g, " ")
  if (body.length <= SUMMARY_MAX) return body
  const cut = body.slice(0, SUMMARY_MAX)
  const lastStop = cut.lastIndexOf(". ")
  return lastStop > 80 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`
}

async function main() {
  const url = process.env.DATABASE_URL ?? ""
  const host = url.match(/@([^/:?]+)/)?.[1] ?? "unknown host"

  console.log(`\nNOW V2 story backfill`)
  console.log(`  mode:     ${APPLY ? "APPLY (writes)" : "dry run (no writes)"}`)
  console.log(`  database: ${host}`)
  console.log(`  limit:    ${LIMIT === Number.POSITIVE_INFINITY ? "none" : LIMIT}\n`)

  // Confirm the Story tables actually exist before reporting on them, so a
  // missing migration produces a clear message instead of a Prisma stack trace.
  try {
    await prisma.story.count()
  } catch {
    console.error(
      "The `stories` table does not exist. Apply the story_model migration first:\n" +
        "  npx prisma migrate deploy\n",
    )
    process.exitCode = 1
    return
  }

  const pending = await prisma.news.findMany({
    where: { status: "PUBLISHED", storyId: null },
    orderBy: { publishedAt: "desc" },
    take: LIMIT === Number.POSITIVE_INFINITY ? undefined : LIMIT,
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      content: true,
      imageUrl: true,
      sourceUrl: true,
      sourceName: true,
      publishedAt: true,
      tags: true,
      categoryId: true,
      importanceScore: true,
      articleAI: {
        select: { tldr: true, summary: true, whyItMatters: true, importanceScore: true },
      },
      source: { select: { priority: true } },
    },
  })

  console.log(`${pending.length} published article(s) not yet attached to a Story.`)

  if (pending.length === 0) {
    console.log("Nothing to do.\n")
    return
  }

  // Slugs already taken, so generated ones stay unique without a round-trip per
  // article. Held in memory for the run and added to as we go.
  const takenSlugs = new Set(
    (await prisma.story.findMany({ select: { slug: true } })).map((s) => s.slug),
  )

  let created = 0
  let skipped = 0

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE)

    for (const article of batch) {
      const base = article.slug ? slugify(article.slug) : slugify(article.title)
      let slug = base || `story-${article.id}`
      if (takenSlugs.has(slug)) {
        // Collision: two articles with the same headline. Suffix with the
        // article id, which is unique by construction.
        slug = `${slug}-${article.id.slice(-6)}`
      }
      if (takenSlugs.has(slug)) {
        console.warn(`  ! skipping ${article.id}: could not derive a unique slug`)
        skipped += 1
        continue
      }

      const summary = toSummary(article)
      if (summary.length === 0) {
        console.warn(`  ! skipping ${article.id}: no summary and no body to derive one from`)
        skipped += 1
        continue
      }

      takenSlugs.add(slug)

      if (!APPLY) {
        created += 1
        if (created <= 5) {
          console.log(`  would create: ${slug}\n      ${article.title.slice(0, 78)}`)
        }
        continue
      }

      // One transaction per article: the Story, its single source, and the link
      // back from the article must all land or none of them.
      await prisma.$transaction(async (tx) => {
        const story = await tx.story.create({
          data: {
            slug,
            headline: article.title,
            summary,
            // Only what we actually hold. `whyItMatters` stays null when AI
            // enrichment has not run — the UI omits the block rather than
            // showing a restated headline.
            whyItMatters: article.articleAI?.whyItMatters ?? null,
            narrative: article.content?.trim() || null,
            // No extraction pipeline yet, so these stay empty by design:
            // context, whatsNext, keyFacts, entities, timeline.
            categoryId: article.categoryId,
            // `News` has no location column; guessing one from the body is
            // exactly the kind of invention this product cannot afford.
            location: null,
            topics: article.tags ?? [],
            // Single-source and unverified. DEVELOPING is the least-committal
            // state, and `story-service.ts` suppresses the badge entirely for
            // single-source stories, so this does not surface as a claim.
            status: "DEVELOPING",
            importanceScore: article.articleAI?.importanceScore ?? article.importanceScore ?? 0,
            // 0 means "not assessed", not "no confidence" — nothing has scored
            // corroboration for these yet.
            confidenceScore: 0,
            heroImageUrl: article.imageUrl,
            heroMediaType: article.imageUrl ? "image" : null,
            heroCredit: null,
            publishedAt: article.publishedAt,
            sources: {
              create: {
                newsId: article.id,
                publisher: article.sourceName,
                url: article.sourceUrl,
                headline: article.title,
                publishedAt: article.publishedAt,
                sourceType: "NEWS",
                reliabilityScore: article.source?.priority ?? null,
              },
            },
          },
          select: { id: true },
        })

        await tx.news.update({
          where: { id: article.id },
          data: { storyId: story.id },
        })
      })

      created += 1
    }

    if (APPLY) {
      console.log(`  ${Math.min(start + BATCH_SIZE, pending.length)}/${pending.length}…`)
    }
  }

  console.log(
    `\n${APPLY ? "Created" : "Would create"} ${created} story/stories` +
      (skipped > 0 ? `, skipped ${skipped}` : "") +
      ".",
  )

  if (!APPLY) {
    console.log("Dry run — nothing was written. Re-run with --apply to commit.\n")
  } else {
    console.log("Done. /now now reads from the Story tables.\n")
  }
}

main()
  .catch((error) => {
    console.error("\nBackfill failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
