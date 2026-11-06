import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rankArticles } from "@/lib/ranking"

/**
 * How far back a pinned story stays eligible for the lead slot. Past this the
 * editor's 'destaque' stops being pulled in explicitly and the story competes
 * on its own signals like any other.
 */
const PINNED_LOOKBACK_HOURS = 48

/** Shared between the recency window and the pinned pull-in so both shapes match. */
const ARTICLE_INCLUDE = {
  category: { select: { name: true, slug: true, color: true } },
  articleAI: {
    select: {
      titleTranslated: true,
      summary: true,
      tldr: true,
      whyItMatters: true,
      importanceScore: true,
    },
  },
  reactions: { select: { type: true } },
  _count: { select: { readHistory: true, reactions: true, savedBy: true } },
} as const

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const search = searchParams.get("search")
    const limit = Math.min(50, Number.parseInt(searchParams.get("limit") || "20"))
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const userId = searchParams.get("userId")

    // Build where clause
    const where: Record<string, unknown> = {
      status: "PUBLISHED",
    }

    if (category && category !== "all") {
      where.category = { slug: category }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ]
    }

    const articles = await prisma.news.findMany({
      where,
      take: limit + 10, // fetch extra for ranking reorder
      skip: offset,
      orderBy: { publishedAt: "desc" },
      include: ARTICLE_INCLUDE,
    })

    // The window above is the newest `limit + 10` articles, so a story the
    // newsroom pinned yesterday is simply not among the candidates and its
    // 'destaque' does nothing. Pull recent pinned stories in by hand. First
    // page only — on page 2 they have already been shown.
    let candidates = articles
    if (offset === 0) {
      const pinned = await prisma.news.findMany({
        where: {
          ...where,
          priority: { in: ["HIGH", "URGENT"] },
          publishedAt: {
            gte: new Date(Date.now() - PINNED_LOOKBACK_HOURS * 3_600_000),
          },
        },
        take: 10,
        orderBy: { publishedAt: "desc" },
        include: ARTICLE_INCLUDE,
      })

      const alreadyInWindow = new Set(articles.map((a: typeof articles[number]) => a.id))
      candidates = [
        ...articles,
        ...pinned.filter((p: typeof articles[number]) => !alreadyInWindow.has(p.id)),
      ]
    }

    // Get user categories for affinity scoring
    let userCategories: string[] = []
    if (userId) {
      const prefs = await prisma.userPreferences.findUnique({
        where: { userId },
        select: { categories: true },
      })
      userCategories = prefs?.categories || []
    }

    // Apply ranking
    const articlesForRanking = candidates.map((a: typeof articles[number]) => ({
      ...a,
      importanceScore: a.articleAI?.importanceScore || a.importanceScore || 50,
      categorySlug: a.category?.slug || "",
    }))

    const ranked = (rankArticles(articlesForRanking, { userCategoryIds: userCategories }) as (typeof articles[number] & { rankScore: number; categorySlug: string })[])
      .slice(0, limit)

    // Transform for frontend
    const feed = ranked.map((article) => ({
      id: article.id,
      // The Portuguese headline when the AI batch has produced one, else the
      // source headline — which may still be in the source's language until the
      // next batch reaches this article. Never blank.
      title: article.articleAI?.titleTranslated || article.title,
      slug: article.slug,
      summary: article.articleAI?.summary || article.summary || "",
      tldr: article.articleAI?.tldr || null,
      whyItMatters: article.articleAI?.whyItMatters || null,
      imageUrl: article.imageUrl || "/placeholder.svg",
      sourceUrl: article.sourceUrl,
      sourceName: article.sourceName,
      publishedAt: article.publishedAt,
      category: {
        name: article.category?.name || "",
        slug: article.category?.slug || "",
        color: article.category?.color || "#007BFF",
      },
      tags: article.tags || [],
      trending: article.trending,
      priority: article.priority,
      sentiment: article.sentiment || "neutral",
      readTime: article.readTime || 3,
      rankScore: article.rankScore,
      stats: {
        reactions: article._count.reactions,
        reads: article._count.readHistory,
        saves: article._count.savedBy,
      },
    }))

    return NextResponse.json({
      articles: feed,
      total: feed.length,
      offset,
      hasMore: articles.length > limit,
    })
  } catch (error) {
    console.error("Feed API error:", error)
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 })
  }
}
