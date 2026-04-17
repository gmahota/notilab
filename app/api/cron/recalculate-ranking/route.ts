import { NextResponse } from "next/server"
import { recalculateAllRankings } from "@/lib/ranking-recalculate"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization")
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await recalculateAllRankings()

    const allFailed = result.errors > 0 && result.updated === 0
    const status = allFailed ? 500 : 200

    return NextResponse.json(
      {
        ok: !allFailed,
        total: result.total,
        updated: result.updated,
        errors: result.errors,
        durationMs: result.durationMs,
      },
      { status },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[cron/recalculate-ranking] Fatal:", message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
