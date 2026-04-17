import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { recordVisit, markConverted, hashIp } from "@/lib/growth/referral"

export const dynamic = "force-dynamic"

// ---------------------------------------------------------------------------
// POST /api/growth/share/visit
// Called from /s/[code] on page load — records a visit and bumps counters.
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { shareId, visitorUserId, isNewUser } = (body ?? {}) as Record<string, unknown>

  if (typeof shareId !== "string" || !shareId) {
    return NextResponse.json({ error: "shareId required" }, { status: 400 })
  }

  // Hash the IP for dedup — never store the raw value
  const headersList = await headers()
  const rawIp =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown"
  const ipHash = hashIp(rawIp)

  const result = await recordVisit({
    shareId,
    visitorUserId: typeof visitorUserId === "string" ? visitorUserId : undefined,
    isNewUser: isNewUser === true,
    ipHash,
  })

  return NextResponse.json(result)
}

// ---------------------------------------------------------------------------
// PATCH /api/growth/share/visit
// Called when a visitor engages (opens article, asks NotiBot, etc.).
// ---------------------------------------------------------------------------

export async function PATCH(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { visitId } = (body ?? {}) as Record<string, unknown>

  if (typeof visitId !== "string" || !visitId) {
    return NextResponse.json({ error: "visitId required" }, { status: 400 })
  }

  await markConverted(visitId)
  return NextResponse.json({ ok: true })
}
