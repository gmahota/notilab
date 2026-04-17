import { NextResponse } from "next/server"
import { recordActivity, getStreakState } from "@/lib/growth/streak"

export const dynamic = "force-dynamic"

// GET /api/growth/streak?userId=xxx  — fetch current state
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  const state = await getStreakState(userId)
  if (!state) {
    return NextResponse.json({ currentStreak: 0, longestStreak: 0, totalDaysActive: 0, lastActiveDate: null })
  }
  return NextResponse.json(state)
}

// POST /api/growth/streak  — record today's activity
export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { userId } = (body ?? {}) as Record<string, unknown>

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  const state = await recordActivity(userId)
  return NextResponse.json(state)
}
