import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/stats — counts derived from the articles we actually hold.
 *
 * Exists because the feed sidebar previously rendered three hardcoded numbers
 * ("1,234" articles today, "45.6K" active users, "2,890" AI summaries). They
 * never moved, and they described a platform far larger than the real one.
 *
 * Every field here is a live COUNT. Nothing is estimated, extrapolated or
 * padded — if a number is 0, the UI shows 0. That is the point: a stat panel is
 * only worth having if a reader can trust it.
 *
 * Deliberately public and unauthenticated: it exposes aggregate counts of
 * already-public content, nothing per-user. Per-user and editorial metrics stay
 * behind /api/admin/overview.
 */
export const dynamic = "force-dynamic"

export interface PublicStats {
  /** PUBLISHED articles with a publishedAt timestamp since local midnight. */
  articlesToday: number
  /** Articles the AI batch has successfully enriched. */
  aiSummaries: number
  /** Distinct outlets among published articles. */
  sources: number
}

export async function GET(): Promise<Response> {
  try {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [articlesToday, aiSummaries, sourceGroups] = await Promise.all([
      prisma.news.count({
        where: { status: "PUBLISHED", publishedAt: { gte: startOfToday } },
      }),
      prisma.articleAI.count({ where: { processedAt: { not: null } } }),
      // groupBy rather than a distinct findMany: this returns one row per
      // outlet instead of one row per article.
      prisma.news.groupBy({
        by: ["sourceName"],
        where: { status: "PUBLISHED" },
      }),
    ])

    const stats: PublicStats = {
      articlesToday,
      aiSummaries,
      sources: sourceGroups.length,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("[api/stats]", error)
    // 500 rather than zeros: the caller hides the panel on failure, and zeros
    // would be indistinguishable from a genuinely empty database.
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 })
  }
}
