/**
 * categorize.ts — Resolve category slugs to database IDs.
 *
 * Loads all required categories in a single DB query, then provides fast
 * in-memory lookups for the rest of the pipeline.
 *
 * If a slug has no matching DB record, articles fall back to "general".
 * If "general" also doesn't exist, those articles are dropped in persist.ts
 * to avoid a FK violation.
 */

import { prisma } from "@/lib/prisma"

/**
 * Resolves an array of category slugs to a Map<slug, categoryId>.
 * Always includes "general" as the ultimate fallback.
 */
export async function resolveCategoryIds(
  slugs: string[]
): Promise<Map<string, string>> {
  const uniqueSlugs = [...new Set([...slugs, "general"])]

  const categories = await prisma.category.findMany({
    where:  { slug: { in: uniqueSlugs } },
    select: { id: true, slug: true },
  }) as { id: string; slug: string }[]

  const map = new Map<string, string>()
  for (const cat of categories) {
    map.set(cat.slug, cat.id)
  }

  if (!map.has("general")) {
    // Last-resort: pick any existing category as fallback
    const any = await prisma.category.findFirst({ select: { id: true, slug: true } }) as { id: string; slug: string } | null
    if (any) {
      console.warn(`[categorize] "general" category not found; using "${any.slug}" as fallback`)
      map.set("general", any.id)
    } else {
      console.error("[categorize] No categories in DB — articles will be dropped. Run the seed script first.")
    }
  }

  return map
}
