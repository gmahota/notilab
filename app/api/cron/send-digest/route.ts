import { NextResponse } from "next/server"
import { sendPendingDigests } from "@/lib/digest-send"

export const dynamic = "force-dynamic"

// Up to BATCH_SIZE emails per invocation, one HTTP call each.
export const maxDuration = 60

const BATCH_SIZE = 50

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization")
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await sendPendingDigests(BATCH_SIZE)

    const allFailed = result.failed > 0 && result.sent === 0 && result.total > 0
    const status = allFailed ? 500 : 200

    return NextResponse.json(
      {
        ok: !allFailed,
        total: result.total,
        sent: result.sent,
        failed: result.failed,
        durationMs: result.durationMs,
      },
      { status },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[cron/send-digest] Fatal:", message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
