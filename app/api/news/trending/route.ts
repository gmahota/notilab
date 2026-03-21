import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { fetchTrendingTopics } from "@/lib/trends"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const region = searchParams.get("region") || "PT"
    const limit = Math.min(20, Number.parseInt(searchParams.get("limit") || "10"))

    // Try database first
    const dbTrends = await prisma.trendingTopic.findMany({
      where: { region },
      orderBy: { searchVolume: "desc" },
      take: limit,
    })

    if (dbTrends.length >= 5) {
      return NextResponse.json({
        topics: dbTrends.map((t) => ({
          keyword: t.keyword,
          volume: t.searchVolume,
          category: t.category || "trending",
          region: t.region,
        })),
        source: "database",
      })
    }

    // Fallback to external API / mock data
    const trends = await fetchTrendingTopics(region, limit)

    // Upsert into DB for caching
    for (const trend of trends) {
      await prisma.trendingTopic.upsert({
        where: { keyword: trend.keyword },
        update: { searchVolume: trend.volume, category: trend.category, region: trend.region },
        create: {
          keyword: trend.keyword,
          searchVolume: trend.volume,
          category: trend.category,
          region: trend.region,
        },
      }).catch(() => { /* ignore duplicate key errors */ })
    }

    return NextResponse.json({
      topics: trends.map((t) => ({
        keyword: t.keyword,
        volume: t.volume,
        description: t.description,
        category: t.category,
        region: t.region,
      })),
      source: "api",
    })
  } catch (error) {
    console.error("Trending API error:", error)
    return NextResponse.json({ error: "Failed to fetch trending" }, { status: 500 })
  }
}
