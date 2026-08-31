import { type NextRequest, NextResponse } from "next/server"

import { getStoriesBySlugs } from "@/lib/story-service"

export const dynamic = "force-dynamic"

/** Cap on how many slugs one request may resolve. */
const MAX_SLUGS = 50

/**
 * GET /api/stories?slugs=a,b,c — resolve a known set of slugs into cards.
 *
 * Serves `/saved`, where the set of stories comes from the visitor's own device.
 * Saves are stored locally (there are no user accounts on this surface yet), so
 * the server is only asked to turn slugs back into content — it is never told
 * what the visitor saved beyond the slugs they send.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get("slugs") ?? ""

  const slugs = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SLUGS)

  if (slugs.length === 0) {
    return NextResponse.json({ stories: [] })
  }

  try {
    const stories = await getStoriesBySlugs(slugs)
    return NextResponse.json({ stories })
  } catch (error) {
    console.error("[api/stories]", error)
    return NextResponse.json({ error: "Failed to load stories" }, { status: 500 })
  }
}
