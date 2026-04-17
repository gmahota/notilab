/**
 * persist.ts — Write normalized articles to the database.
 *
 * Uses individual `create` calls (not createMany) so a single bad record
 * doesn't roll back the entire batch. The @unique constraint on sourceUrl
 * handles any race condition that slips past deduplication.
 *
 * Returns the IDs of successfully created records so the pipeline can
 * hand them off to the AI queue.
 */

import type { NormalizedArticle } from "./types"
import { prisma } from "@/lib/prisma"

/** Produces a URL-safe slug unique enough for this article. */
function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .substring(0, 90) +
    "-" +
    Date.now().toString(36)
  )
}

export interface PersistResult {
  saved: number
  savedIds: string[]
}

export async function saveToDatabase(
  articles: NormalizedArticle[],
  categoryMap: Map<string, string>,
  errors: string[]
): Promise<PersistResult> {
  const savedIds: string[] = []

  for (const article of articles) {
    // Resolve categoryId — skip article if no mapping found
    const categoryId =
      categoryMap.get(article.categorySlug) ?? categoryMap.get("general")
    if (!categoryId) {
      const msg = `No categoryId for slug "${article.categorySlug}" — skipping "${article.title.substring(0, 60)}"`
      console.warn("[persist]", msg)
      errors.push(msg)
      continue
    }

    try {
      const created = await prisma.news.create({
        data: {
          title:           article.title,
          slug:            slugify(article.title),
          content:         article.content,
          summary:         article.summary,
          imageUrl:        article.imageUrl,
          sourceUrl:       article.sourceUrl,
          sourceName:      article.sourceName,
          publishedAt:     article.publishedAt,
          categoryId,
          tags:            article.tags,
          trending:        false,
          importanceScore: article.importanceScore,
          readTime:        article.readTime,
          status:          "PUBLISHED",
        },
        select: { id: true },
      }) as { id: string } | null

      if (created?.id) savedIds.push(created.id)
    } catch (err) {
      // P2002 = unique constraint violation (race condition duplicate) — not an error worth alerting
      const isUniqueViolation =
        err instanceof Error && err.message.includes("Unique constraint")
      if (!isUniqueViolation) {
        const msg = `DB error saving "${article.title.substring(0, 60)}": ${err instanceof Error ? err.message : String(err)}`
        console.error("[persist]", msg)
        errors.push(msg)
      }
    }
  }

  return { saved: savedIds.length, savedIds }
}
