import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const { userId, newsId } = await request.json()

    if (!userId || !newsId) {
      return NextResponse.json({ error: "userId and newsId are required" }, { status: 400 })
    }

    // Toggle save: if already saved, unsave; otherwise save
    const existing = await prisma.savedArticle.findUnique({
      where: { userId_newsId: { userId, newsId } },
    })

    if (existing) {
      await prisma.savedArticle.delete({
        where: { userId_newsId: { userId, newsId } },
      })
      return NextResponse.json({ saved: false, message: "Article unsaved" })
    }

    await prisma.savedArticle.create({
      data: { userId, newsId },
    })

    return NextResponse.json({ saved: true, message: "Article saved" })
  } catch (error) {
    console.error("Save API error:", error)
    return NextResponse.json({ error: "Failed to save article" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    const saved = await prisma.savedArticle.findMany({
      where: { userId },
      include: {
        news: {
          include: {
            category: { select: { name: true, slug: true, color: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      articles: saved.map((s) => ({
        id: s.news.id,
        title: s.news.title,
        summary: s.news.summary,
        imageUrl: s.news.imageUrl,
        category: s.news.category,
        savedAt: s.createdAt,
      })),
    })
  } catch (error) {
    console.error("Get saved API error:", error)
    return NextResponse.json({ error: "Failed to fetch saved articles" }, { status: 500 })
  }
}
