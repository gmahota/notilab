import { NextResponse } from "next/server"
import { runAiBatch } from "@/lib/ai-processing/processor"

export const dynamic = "force-dynamic"

// BATCH_SIZE model calls in a single invocation, seconds each.
export const maxDuration = 60

const BATCH_SIZE = 15

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization")
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runAiBatch(BATCH_SIZE)

    const status = result.failed > 0 && result.succeeded === 0 ? 500 : 200

    return NextResponse.json(
      {
        ok: true,
        summary: {
          total: result.total,
          succeeded: result.succeeded,
          failed: result.failed,
          skipped: result.skipped,
        },
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
      { status },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[cron/process-ai-news] Fatal error:", message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
