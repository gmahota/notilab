import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rankArticles } from "@/lib/ranking"

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
      include: {
        category: { select: { name: true, slug: true, color: true } },
        articleAI: { select: { summary: true, tldr: true, whyItMatters: true, importanceScore: true } },
        reactions: { select: { type: true } },
        _count: { select: { readHistory: true, reactions: true, savedBy: true } },
      },
    })

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
    const articlesForRanking = articles.map((a: typeof articles[number]) => ({
      ...a,
      importanceScore: a.articleAI?.importanceScore || a.importanceScore || 50,
      categorySlug: a.category?.slug || "",
    }))

    const ranked = (rankArticles(articlesForRanking, { userCategoryIds: userCategories }) as (typeof articles[number] & { rankScore: number; categorySlug: string })[])
      .slice(0, limit)

    // Transform for frontend
    const feed = ranked.map((article) => ({
      id: article.id,
      title: article.title,
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
