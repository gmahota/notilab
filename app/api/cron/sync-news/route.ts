/**
 * GET /api/cron/sync-news
 *
 * Triggered automatically by Vercel Cron (vercel.json) every 30 minutes.
 * Can also be called manually for testing:
 *
 *   curl -H "Authorization: Bearer <CRON_SECRET>" \
 *        https://your-app.vercel.app/api/cron/sync-news
 *
 * Security: validates the Authorization header against CRON_SECRET env var.
 * Vercel automatically injects this header when CRON_SECRET is set in the
 * project environment variables.
 */

import { type NextRequest, NextResponse } from "next/server"
import { runIngestionPipeline } from "@/lib/ingestion/pipeline"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[cron/sync-news] CRON_SECRET is not set")
    return NextResponse.json(
      { ok: false, error: "Server misconfiguration: CRON_SECRET not set" },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  // ── Run ────────────────────────────────────────────────────────────────────
  try {
    const result = await runIngestionPipeline()

    const status = result.errors.length > 0 ? 207 : 200 // 207 = partial success
    return NextResponse.json({ ok: true, ...result }, { status })
  } catch (err) {
    console.error("[cron/sync-news] Fatal pipeline error:", err)
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
