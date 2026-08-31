import { type NextRequest, NextResponse } from "next/server"

import { getNowFeed, NOW_PAGE_SIZE } from "@/lib/story-service"
import { isFeedLane } from "@/lib/story-view"

export const dynamic = "force-dynamic"

/**
 * GET /api/now/feed — one page of the NOW V2 vertical feed.
 *
 * Query: ?lane=for-you|world|following &limit &offset &userId
 * Returns: { stories: NowStory[], offset, hasMore }
 *
 * Story-shaped, not article-shaped: see `lib/story-view.ts`. `/api/news/feed`
 * still serves the article-shaped surfaces (`/feed`, homepage) and is left
 * alone.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const laneParam = searchParams.get("lane") ?? "for-you"
  if (!isFeedLane(laneParam)) {
    return NextResponse.json({ error: "Unknown lane" }, { status: 400 })
  }

  const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10)
  const offsetParam = Number.parseInt(searchParams.get("offset") ?? "", 10)

  try {
    const page = await getNowFeed({
      lane: laneParam,
      limit: Number.isFinite(limitParam) ? limitParam : NOW_PAGE_SIZE,
      offset: Number.isFinite(offsetParam) ? offsetParam : 0,
      userId: searchParams.get("userId") ?? undefined,
    })

    return NextResponse.json(page)
  } catch (error) {
    console.error("[api/now/feed]", error)
    return NextResponse.json({ error: "Failed to load the feed" }, { status: 500 })
  }
}
