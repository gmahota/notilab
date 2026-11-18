/**
 * POST /api/admin/articles/:id/transition — move an article's status.
 *
 * Body: `{ "target": "APPROVED", "note": "..." }`
 *
 * Every lifecycle move the CMS makes comes through here, and the route itself
 * decides nothing. `transitionArticle` holds the transition table, the per-edge
 * role check, the § 3.3 submission preconditions, the `reviewerId` stamp, the
 * `AdminAction` row and the workflow-stage move — all in one transaction, so a
 * status change cannot land without the audit row that names who made it.
 *
 * What the editor sees on a refusal is the service layer's own Portuguese
 * message. A REDATOR who tries to publish is told their role cannot make that
 * move; an article submitted without a rewrite is told which condition failed.
 * Neither is a generic 403.
 *
 * **There is no bulk endpoint, and that is a decision.** A "aprovar todos"
 * button recreates auto-publish with an audit row attached, which is strictly
 * worse than today's behaviour because it *looks* like review (strategy R3(e)).
 */

import { type NextRequest, NextResponse } from "next/server"
import { transitionArticle } from "@/lib/editorial/article-service"
import { isArticleStatus } from "@/lib/editorial/transitions"
import { actorFrom, requireAdmin, respondToError, readJson } from "@/app/api/admin/articles/_respond"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { user, error } = await requireAdmin()
  if (!user) return error

  const { id } = await context.params
  const { body, error: bodyError } = await readJson(request)
  if (!body) return bodyError

  const target = body.target
  if (typeof target !== "string" || !isArticleStatus(target)) {
    return NextResponse.json(
      { error: "Estado de destino inválido.", code: "VALIDATION_FAILED" },
      { status: 400 },
    )
  }

  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined

  try {
    const result = await transitionArticle(id, target, {
      actor: actorFrom(user),
      note,
      // publishedAt is deliberately not taken from the request. It is the
      // source's publication date, and letting the CMS set it would reorder
      // the public feed on every republish — see transitionArticle.
    })

    return NextResponse.json({
      ok: true,
      status: target,
      alreadyInState: result.alreadyInState,
      changes: result.changes,
    })
  } catch (err) {
    return respondToError("admin/articles/[id]/transition", err)
  }
}
