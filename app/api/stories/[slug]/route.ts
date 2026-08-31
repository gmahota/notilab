import { NextResponse } from "next/server"

import { getStoryBrief } from "@/lib/story-service"

export const dynamic = "force-dynamic"

/**
 * GET /api/stories/[slug] — the 30-second Brief for one Story (spec § 10).
 *
 * Accepts a slug or an id. 404s when the story does not exist rather than
 * returning a shell, so the client can say so instead of rendering blanks.
 */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params

  try {
    const brief = await getStoryBrief(slug)
    if (!brief) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json(brief)
  } catch (error) {
    console.error("[api/stories/:slug]", error)
    return NextResponse.json({ error: "Failed to load the story" }, { status: 500 })
  }
}
