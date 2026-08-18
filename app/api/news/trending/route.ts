import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { fetchTrendingTopics } from "@/lib/trends"

/**
 * How stale the persisted keyword set may get before this handler refreshes it.
 *
 * The response itself is always derived fresh — `fetchTrendingTopics` reads our
 * own articles, so caching that in another table of the same database would be
 * pointless indirection. The table is written for a different consumer:
 * `lib/ranking-recalculate.ts` reads `trending_topics` for the ranking's trend
 * boost dimension. This TTL therefore gates *writes*, not reads, so a busy
 * homepage doesn't issue an upsert per request.
 *
 * Previously this handler returned any stored set of 5+ rows unconditionally,
 * with no expiry and no pruning — which is how production served a keyword list
 * first written in March for months afterwards.
 */
const PERSIST_TTL_HOURS = 6

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const region = searchParams.get("region") || "PT"
    const limit = Math.min(20, Number.parseInt(searchParams.get("limit") || "10"))

    // Always derive from the articles we actually hold.
    const { mode, topics } = await fetchTrendingTopics(region, limit)

    if (topics.length === 0) {
      // Nothing to derive from yet. An empty list is a valid answer — the UI
      // hides the section rather than showing invented topics.
      return NextResponse.json({ topics: [], mode, source: "derived" })
    }

    await refreshPersistedKeywords(region, topics)

    return NextResponse.json({
      topics: topics.map((t) => ({
        keyword: t.keyword,
        volume: t.volume,
        description: t.description,
        category: t.category,
        region: t.region,
      })),
      mode,
      source: "derived",
    })
  } catch (error) {
    console.error("Trending API error:", error)
    return NextResponse.json({ error: "Failed to fetch trending" }, { status: 500 })
  }
}

/**
 * Keeps `trending_topics` in sync with the derived list so the ranking cron has
 * current keywords. Skips the write entirely while the stored set is fresh.
 *
 * Never throws: trending is a read surface, and failing to persist keywords for
 * a later cron must not turn a working page into a 500.
 */
async function refreshPersistedKeywords(
  region: string,
  trends: Awaited<ReturnType<typeof fetchTrendingTopics>>["topics"],
): Promise<void> {
  try {
    const stored = await prisma.trendingTopic.findMany({
      where: { region },
      select: { updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 1,
    })

    const newest = stored[0]?.updatedAt?.getTime() ?? 0
    const ageHours = (Date.now() - newest) / 3_600_000
    if (stored.length > 0 && ageHours < PERSIST_TTL_HOURS) return

    const refreshedAt = new Date()

    for (const trend of trends) {
      await prisma.trendingTopic.upsert({
        where: { keyword: trend.keyword },
        update: {
          searchVolume: trend.volume,
          category: trend.category,
          region: trend.region,
        },
        create: {
          keyword: trend.keyword,
          searchVolume: trend.volume,
          category: trend.category,
          region: trend.region,
        },
      })
    }

    // Drop keywords this refresh did not return. `updatedAt` is @updatedAt, so
    // every row touched above carries a newer timestamp than `refreshedAt`.
    // Upserting alone only ever added rows, which is why keywords that stopped
    // trending survived across code versions and kept crowding out current ones.
    await prisma.trendingTopic.deleteMany({
      where: { region, updatedAt: { lt: refreshedAt } },
    })
  } catch (error) {
    console.error("Trending keyword persistence failed:", error)
  }
}
