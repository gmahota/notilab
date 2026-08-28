import { NextResponse } from "next/server"
import { runMessagingBatch } from "@/lib/messaging/deliver"

export const dynamic = "force-dynamic"

// Fans out to every messaging subscriber, one channel API call each.
export const maxDuration = 60

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get("Authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runMessagingBatch("daily_digest")
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[cron/send-messaging]", err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
