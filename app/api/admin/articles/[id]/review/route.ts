/**
 * POST /api/admin/articles/:id/review — the REVISOR's "revisão concluída".
 *
 * Body: `{ "note": "..." }` (optional)
 *
 * Moves `ContentWorkflow.stage` from `REVIEW` to `APPROVAL` and stamps
 * `News.reviewerId`. It changes no status — `News.status` stays
 * `PENDING_REVIEW` across both halves of the review — which is precisely why
 * it cannot be expressed as a transition and needs its own endpoint.
 *
 * This is the handoff that makes REVISOR and SUPERVISOR two roles rather than
 * one: a reviewer clears, an approver approves, and the reviewer can never
 * reach `APPROVED` alone.
 */

import { type NextRequest, NextResponse } from "next/server"
import { clearReview } from "@/lib/editorial/article-service"
import { actorFrom, requireAdmin, respondToError, readJson } from "@/app/api/admin/articles/_respond"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { user, error } = await requireAdmin()
  if (!user) return error

  const { id } = await context.params

  // A note is optional here, so an unparseable body is not worth refusing over
  // — but a malformed one should not be silently read as an empty note either.
  const { body, error: bodyError } = await readJson(request)
  if (!body) return bodyError

  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined

  try {
    const result = await clearReview(id, actorFrom(user), note)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return respondToError("admin/articles/[id]/review", err)
  }
}
