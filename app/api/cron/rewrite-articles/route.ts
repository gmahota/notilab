/**
 * GET /api/cron/rewrite-articles
 *
 * Phase 3 of the editorial gate: writes NotiLab's own version of collected
 * articles into the `ArticleAI.*Rewritten` columns.
 *
 * **Shadow mode — nothing reads what this writes.** Articles publish exactly
 * as they do today. The run can be inspected, and its quality signed off
 * (Phase 3b), before anything depends on it.
 *
 * Scheduled at 21:00 UTC, between ingestion (20:00) and AI enrichment (22:00),
 * so it works on the articles that arrived an hour earlier and finishes before
 * enrichment starts. The two touch different columns and never race.
 *
 * Manual run:
 *
 *   curl -H "Authorization: Bearer <CRON_SECRET>" \
 *        https://notilab.vercel.app/api/cron/rewrite-articles
 *
 * Known limitation, stated rather than discovered later: the batch size fits
 * the 60s ceiling, not the intake. The Hobby plan allows one run a day, so
 * this rewrites four articles a day against the 15.3 a day Phase 0 measured —
 * the queue grows by eleven daily. See the arithmetic in
 * lib/ai-processing/rewrite/worker.ts. Shadow mode is when to find that out.
 */

import { type NextRequest, NextResponse } from "next/server"
import { runRewriteBatch } from "@/lib/ai-processing/rewrite/worker"
import { hasAIProvider } from "@/lib/ai-processing/call-ai"

export const dynamic = "force-dynamic"

// A rewrite is one model call over a full article body, and the batch is sized
// to fit here with margin. 60s is the ceiling on the Hobby plan.
export const maxDuration = 60

export async function GET(request: NextRequest): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[cron/rewrite-articles] CRON_SECRET is not set")
    return NextResponse.json(
      { ok: false, error: "Server misconfiguration: CRON_SECRET not set" },
      { status: 500 },
    )
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  // Refusing up front rather than letting every article in the batch fail and
  // burn an attempt each on a misconfiguration no retry can fix.
  if (!hasAIProvider()) {
    console.error("[cron/rewrite-articles] no AI provider configured")
    return NextResponse.json(
      { ok: false, error: "No AI provider configured. Set OPENAI_API_KEY or GROQ_API_KEY." },
      { status: 500 },
    )
  }

  try {
    const result = await runRewriteBatch()

    return NextResponse.json(
      { ok: true, ...result },
      { status: result.failed > 0 ? 207 : 200 },
    )
  } catch (err) {
    console.error("[cron/rewrite-articles] Fatal error:", err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    )
  }
}
