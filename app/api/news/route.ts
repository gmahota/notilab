import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const sortBy = searchParams.get("sortBy") || "recent"
    const search = searchParams.get("search")
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

  // Build where clause
  const where: Record<string, unknown> = {}

    if (category && category !== "all") {
      where.category = {
        slug: category,
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ]
    }

  // Build orderBy clause
  let orderBy: Record<string, unknown> | Array<Record<string, unknown>> = { publishedAt: "desc" }

    switch (sortBy) {
      case "popular":
        orderBy = { reactions: { _count: "desc" } }
        break
      case "views":
        orderBy = { readHistory: { _count: "desc" } }
        break
      case "trending":
        orderBy = [{ trending: "desc" }, { publishedAt: "desc" }]
        break
      case "ranked":
        // Use the pre-computed composite ranking score (updated every 15 min by cron)
        orderBy = [{ rankingScore: "desc" }, { publishedAt: "desc" }]
        break
    }

    const news = await prisma.news.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include: {
        category: {
          select: {
            name: true,
            slug: true,
            color: true,
          },
        },
        reactions: {
          select: {
            type: true,
          },
        },
        readHistory: true,
      },
    })

    // Define the type for news items
    type NewsItem = {
      id: string
      title: string
      summary?: string
      content: string
      imageUrl?: string
      sourceUrl: string
      sourceName: string
      publishedAt: Date
      category?: {
        name?: string
        slug?: string
        color?: string
      }
      tags?: string[]
      trending?: boolean
      priority?: number
      aiSummary?: string
      sentiment?: string
      readTime?: number
      reactions: Array<{ type: string }>
      readHistory?: unknown
    }

    // Transform data for frontend
    const transformedNews = news.map((article: any) => ({
      id: article.id,
      title: article.title,
      summary: article.summary ?? "",
      content: article.content,
      imageUrl: article.imageUrl ?? "/placeholder.svg",
      sourceUrl: article.sourceUrl,
      sourceName: article.sourceName,
      publishedAt: article.publishedAt,
      category: {
        name: article.category?.name ?? "",
        slug: article.category?.slug ?? "",
        color: article.category?.color ?? "#007BFF",
      },
      tags: article.tags ?? [],
      trending: article.trending ?? false,
      priority: article.priority ?? 0,
      aiSummary: article.aiSummary ?? "",
      sentiment: article.sentiment ?? "neutral",
      readTime: article.readTime ?? 3,
      reactions: Array.isArray(article.reactions)
        ? article.reactions.map((r: typeof article.reactions[number]) => ({
            type: r.type,
            count: 1,
          }))
        : [],
      author: "NotiLab Team", // TODO: Add author relationship
    }))
    return NextResponse.json(transformedNews)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 })
  }
}
