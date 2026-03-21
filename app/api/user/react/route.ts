import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const { userId, newsId, type } = await request.json()

    if (!userId || !newsId || !type) {
      return NextResponse.json({ error: "userId, newsId, and type are required" }, { status: 400 })
    }

    const validTypes = ["LIKE", "LOVE", "LAUGH", "ANGRY", "SAD"]
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid reaction type" }, { status: 400 })
    }

    // Upsert reaction (toggle if same type, update if different)
    const existing = await prisma.newsReaction.findUnique({
      where: { userId_newsId: { userId, newsId } },
    })

    if (existing && existing.type === type) {
      // Remove reaction (toggle off)
      await prisma.newsReaction.delete({
        where: { userId_newsId: { userId, newsId } },
      })
      return NextResponse.json({ reacted: false, type: null, message: "Reaction removed" })
    }

    // Create or update reaction
    const reaction = await prisma.newsReaction.upsert({
      where: { userId_newsId: { userId, newsId } },
      update: { type },
      create: { userId, newsId, type },
    })

    return NextResponse.json({ reacted: true, type: reaction.type, message: "Reaction added" })
  } catch (error) {
    console.error("React API error:", error)
    return NextResponse.json({ error: "Failed to react" }, { status: 500 })
  }
}
