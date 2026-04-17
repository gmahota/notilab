import { NextResponse } from "next/server"
import { getVariants } from "@/lib/growth/experiments"

export const dynamic = "force-dynamic"

// ---------------------------------------------------------------------------
// GET /api/growth/experiments?userId=xxx&names=hero_copy,share_cta
//
// Batch variant resolution for client components.
// Returns a map of { [experimentName]: { variant, meta } }
// Missing / inactive experiments are omitted.
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")
  const namesParam = searchParams.get("names")

  if (!userId || !namesParam) {
    return NextResponse.json({ error: "userId and names are required" }, { status: 400 })
  }

  const names = namesParam
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 20) // hard cap to prevent abuse

  if (names.length === 0) {
    return NextResponse.json({})
  }

  const variants = await getVariants(userId, names)
  return NextResponse.json(variants)
}
