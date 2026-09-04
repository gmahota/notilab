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

    // Only PUBLISHED articles are publicly readable. Without this filter the
    // endpoint also returned DRAFT, PENDING_REVIEW, APPROVED, REJECTED and
    // ARCHIVED articles, so unpublishing or archiving a story removed it from
    // the feed, the category pages and the detail route but not from here.
    // Matches app/api/news/feed, /api/news/category/[slug] and /api/news/[id].
    const where: Record<string, unknown> = {
      status: "PUBLISHED",
    }

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

    // Transform data for frontend.
    //
    // No annotation on `article`: findMany already infers the exact row shape
    // from the `include` above, and that inference stays in sync with the
    // schema. The `: any` that used to sit here threw it away, alongside a
    // hand-written NewsItem type that was never applied to anything — and had
    // already drifted (it declared `priority?: number`, but News.priority is
    // the Priority enum, so this endpoint returns a string there).
    const transformedNews = news.map((article) => ({
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
        ? article.reactions.map((r) => ({
            type: r.type,
            count: 1,
          }))
        : [],
      author: "NotiLab Team", // TODO: Add author relationship
    }))
    return NextResponse.json(transformedNews)
  } catch (error) {
    // The caught error was previously discarded, so a failing query surfaced
    // only as an opaque 500 with nothing in the logs to diagnose it.
    console.error("[api/news] Failed to fetch news:", error)
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 })
  }
}
