/**
 * lib/agent/tools/taxonomy.ts — Reading the category vocabulary.
 *
 * Read-only on purpose. Categories are the shape of the whole site: the public
 * navigation, the digest sections, the subscriber preferences in
 * `UserPreferences.categories` and `MessagingSubscription.categories` all key
 * off these slugs. An agent inventing a category would silently orphan every
 * subscriber who had filtered on the old one, so creating and renaming
 * categories stays a human decision with no tool behind it.
 */

import { prisma } from "@/lib/prisma"
import { defineTool } from "../types"

export const listCategoriesTool = defineTool({
  name: "list_categories",
  title: "List categories",
  description:
    "List every NotiLab category with its slug and how many articles it holds. Call this before " +
    "creating an article or changing one's category — `categorySlug` must be an existing slug, " +
    "and there is no tool that creates a new category.",
  permissions: ["taxonomy.read"],
  mutating: false,
  input: {},
  output: {
    type: "object",
    properties: {
      categories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string", description: "Use this value as `categorySlug`." },
            description: { type: ["string", "null"] },
            color: { type: "string" },
            articleCount: { type: "integer" },
          },
        },
      },
    },
    required: ["categories"],
  },
  async handler() {
    const rows = (await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        _count: { select: { news: true } },
      },
    })) as Array<{
      id: string
      name: string
      slug: string
      description: string | null
      color: string
      _count: { news: number }
    }>

    return {
      data: {
        categories: rows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          color: row.color,
          articleCount: row._count.news,
        })),
      },
    }
  },
})
