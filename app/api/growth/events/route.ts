import { NextResponse } from "next/server"
import { trackEvent, GrowthEvent } from "@/lib/growth/events"

export const dynamic = "force-dynamic"

const VALID_EVENTS = new Set<GrowthEvent>([
  "article_viewed",
  "article_saved",
  "article_shared",
  "article_explained",
  "link_pasted",
  "digest_opened",
  "digest_clicked",
  "streak_completed",
  "trending_alert_clicked",
  "chatbot_opened",
  "chatbot_question_sent",
  "share_panel_opened",
  "share_snippet_copied",
  "experiment_exposed",
  "experiment_converted",
])

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { event, userId, sessionId, articleId, meta } = body as Record<string, unknown>

  if (typeof event !== "string" || !VALID_EVENTS.has(event as GrowthEvent)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 })
  }

  // Validate optional fields are the right type if present
  if (userId !== undefined && typeof userId !== "string") {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 })
  }
  if (articleId !== undefined && typeof articleId !== "string") {
    return NextResponse.json({ error: "Invalid articleId" }, { status: 400 })
  }

  // Sanitise meta: must be a plain object, no nesting depth limit needed here
  const safeMeta =
    meta && typeof meta === "object" && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)
      : undefined

  // Fire-and-forget: respond immediately, track in background
  trackEvent({
    event: event as GrowthEvent,
    userId: typeof userId === "string" ? userId : undefined,
    sessionId: typeof sessionId === "string" ? sessionId : undefined,
    articleId: typeof articleId === "string" ? articleId : undefined,
    meta: safeMeta,
  })

  return NextResponse.json({ ok: true })
}
