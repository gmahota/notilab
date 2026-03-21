import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(30, Number.parseInt(searchParams.get("limit") || "10"))
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    const articles = await prisma.news.findMany({
      where: {
        category: { slug },
        status: "PUBLISHED",
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        category: { select: { name: true, slug: true, color: true } },
        articleAI: { select: { summary: true, tldr: true, importanceScore: true } },
        _count: { select: { reactions: true, readHistory: true } },
      },
    })

    return NextResponse.json({
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        summary: a.articleAI?.summary || a.summary || "",
        tldr: a.articleAI?.tldr || null,
        imageUrl: a.imageUrl || "/placeholder.svg",
        sourceName: a.sourceName,
        publishedAt: a.publishedAt,
        category: a.category,
        trending: a.trending,
        readTime: a.readTime || 3,
        stats: { reactions: a._count.reactions, reads: a._count.readHistory },
      })),
      category: slug,
      total: articles.length,
    })
  } catch (error) {
    console.error("Category API error:", error)
    return NextResponse.json({ error: "Failed to fetch category news" }, { status: 500 })
  }
}
