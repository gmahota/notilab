import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  try {
    const article = await prisma.news.findFirst({
      where: {
        status: "PUBLISHED",
        OR: [{ id }, { slug: id }],
      },
      include: {
        category: { select: { name: true, slug: true, color: true } },
        articleAI: { select: { summary: true, tldr: true, whyItMatters: true, importanceScore: true } },
        source: { select: { name: true, priority: true } },
        _count: { select: { reactions: true, readHistory: true, savedBy: true } },
      },
    })

    if (!article) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const relatedStories = await prisma.news.findMany({
      where: {
        status: "PUBLISHED",
        categoryId: article.categoryId,
        id: { not: article.id },
      },
      take: 4,
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        imageUrl: true,
        publishedAt: true,
        category: { select: { slug: true } },
      },
    })

    return NextResponse.json({
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      summary: article.articleAI?.summary || article.summary || "",
      tldr: article.articleAI?.tldr || null,
      whyItMatters: article.articleAI?.whyItMatters || null,
      imageUrl: article.imageUrl || "/placeholder.svg",
      sourceUrl: article.sourceUrl,
      sourceName: article.sourceName,
      source: article.source
        ? { name: article.source.name, priority: article.source.priority }
        : null,
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
      stats: {
        reactions: article._count.reactions,
        reads: article._count.readHistory,
        saves: article._count.savedBy,
      },
      relatedStories: relatedStories.map((r: (typeof relatedStories)[number]) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        imageUrl: r.imageUrl || "/placeholder.svg",
        publishedAt: r.publishedAt,
        category: { slug: r.category?.slug || "" },
      })),
    })
  } catch (error) {
    console.error("News detail API error:", error)
    return NextResponse.json({ error: "Failed to fetch article" }, { status: 500 })
  }
}
