/**
 * scripts/db/ensure-categories.ts — Creates any Category row the ingestion
 * pipeline routes to but the database does not have yet.
 *
 *   pnpm exec tsx --env-file-if-exists=.env scripts/db/ensure-categories.ts --confirm-production-write
 *
 * Why this exists rather than `pnpm db:seed`: the seed also inserts dozens of
 * demonstration articles. Running it to obtain one missing category would push
 * that fixture content into a live feed. This script touches nothing but the
 * Category table, and only ever inserts — an existing row is left exactly as it
 * is, description and colour included.
 *
 * THIS SCRIPT WRITES TO THE DATABASE IN DATABASE_URL, AND LOCAL AND PRODUCTION
 * SHARE ONE NEON INSTANCE. There is no such thing as running it "just locally",
 * hence the mandatory --confirm-production-write flag (same convention as
 * scripts/admin/provision-admin.ts).
 *
 * Safe to re-run: every write is an upsert keyed on the slug, so a connection
 * dropped halfway through converges on a second run instead of duplicating.
 *
 * The required set is DERIVED from CATEGORY_SLUGS in lib/ingestion/normalize.ts
 * rather than restated here, because a restated list is one that drifts. A slug
 * the categoriser can emit but this script does not know about would silently
 * demote those articles to "general"; the parity check below refuses to run at
 * all in that case, instead of writing a partial taxonomy.
 *
 * --dry-run reports what it would do and writes nothing. The confirm flag is
 * still required for a real write.
 */

import { PrismaClient } from "../../lib/generated/prisma"
import { CATEGORY_SLUGS } from "../../lib/ingestion/normalize"
import {
  CATEGORY_CATALOG,
  catalogEntriesWithNoRule,
  slugsMissingFromCatalog,
} from "../../lib/ingestion/category-catalog"

const CONFIRM_FLAG = "--confirm-production-write"
const DRY_RUN_FLAG = "--dry-run"

async function main() {
  const dryRun = process.argv.includes(DRY_RUN_FLAG)

  // Parity first: a mismatch here means the taxonomy was edited in one file and
  // not the other, and nothing should be written until that is resolved.
  const missing = slugsMissingFromCatalog(CATEGORY_SLUGS)
  if (missing.length > 0) {
    console.error(
      `CATEGORY_RULES emits ${missing.length} slug(s) that lib/ingestion/category-catalog.ts ` +
        `has no row for: ${missing.join(", ")}.\n` +
        `Articles matching those rules would be demoted to the fallback. ` +
        `Add them to CATEGORY_CATALOG or remove their rule, then re-run.`,
    )
    process.exit(1)
  }

  const unreachable = catalogEntriesWithNoRule(CATEGORY_SLUGS)
  if (unreachable.length > 0) {
    console.log(
      `Note: ${unreachable.length} catalog entr(ies) no rule can reach: ${unreachable.join(", ")}.\n` +
        `Retired categories keep their rows on purpose; check this is by decision.\n`,
    )
  }

  if (!dryRun && !process.argv.includes(CONFIRM_FLAG)) {
    console.error(
      `Refusing to write without ${CONFIRM_FLAG}.\n` +
        `DATABASE_URL points at the shared Neon instance — this is a production write.\n` +
        `Pass ${DRY_RUN_FLAG} to see what would change without writing.`,
    )
    process.exit(1)
  }

  const prisma = new PrismaClient()
  try {
    const existing = await prisma.category.findMany({
      where: { slug: { in: [...CATEGORY_SLUGS] } },
      select: { slug: true },
    })
    const have = new Set(existing.map((c) => c.slug))

    for (const slug of CATEGORY_SLUGS) {
      if (have.has(slug)) {
        console.log(`  = ${slug.padEnd(14)} already present, left untouched`)
        continue
      }
      if (dryRun) {
        console.log(`  ~ ${slug.padEnd(14)} MISSING — would be created`)
        continue
      }
      await prisma.category.upsert({
        where: { slug },
        update: {},
        create: { slug, ...CATEGORY_CATALOG[slug] },
      })
      console.log(`  + ${slug.padEnd(14)} created`)
    }

    const total = await prisma.category.count()
    console.log(`\nCategory rows in the database: ${total}`)
    if (dryRun) console.log("Dry run — nothing was written.")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
