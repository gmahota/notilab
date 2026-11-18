/**
 * GET /api/admin/articles — the review queue.
 *
 * Phase 4(ii). The list the newsroom works from, ordered by importance rather
 * than by date (see `lib/editorial/review-queue.ts` for why), with the counts
 * the status tabs need folded into the same response.
 *
 * Query parameters, all optional:
 *
 *   status        DRAFT | PENDING_REVIEW | APPROVED | PUBLISHED | REJECTED | ARCHIVED
 *   stage         DRAFT | WRITING | REVIEW | APPROVAL | PUBLISHED | REJECTED
 *   rewrite       none | pending | failed | ready
 *   q             substring of the headline or the source name
 *   limit/offset  paging, limit capped at 50
 */

import { type NextRequest, NextResponse } from "next/server"
import {
  getReviewQueue,
  MAX_QUEUE_PAGE,
  type RewriteState,
} from "@/lib/editorial/review-queue"
import { isArticleStatus } from "@/lib/editorial/transitions"
import type { WorkflowStage } from "@/lib/generated/prisma"
import { requireAdmin, respondToError } from "@/app/api/admin/articles/_respond"

export const dynamic = "force-dynamic"

const STAGES: readonly WorkflowStage[] = [
  "DRAFT",
  "WRITING",
  "REVIEW",
  "APPROVAL",
  "PUBLISHED",
  "REJECTED",
]

const REWRITE_STATES: readonly RewriteState[] = ["none", "pending", "failed", "ready"]

export async function GET(request: NextRequest): Promise<Response> {
  const { user, error } = await requireAdmin()
  if (!user) return error

  const params = request.nextUrl.searchParams

  // Unknown values are dropped rather than refused. A stale bookmark with a
  // filter that no longer exists should show the unfiltered queue, not an
  // error page in the middle of someone's working day.
  const status = params.get("status")
  const stage = params.get("stage")
  const rewrite = params.get("rewrite")
  const limit = Number.parseInt(params.get("limit") ?? "", 10)
  const offset = Number.parseInt(params.get("offset") ?? "", 10)

  try {
    const result = await getReviewQueue({
      status: status && isArticleStatus(status) ? status : undefined,
      stage: stage && STAGES.includes(stage as WorkflowStage) ? (stage as WorkflowStage) : undefined,
      rewriteState:
        rewrite && REWRITE_STATES.includes(rewrite as RewriteState)
          ? (rewrite as RewriteState)
          : undefined,
      query: params.get("q")?.trim() || undefined,
      limit: Number.isFinite(limit) ? Math.min(limit, MAX_QUEUE_PAGE) : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    })

    // The viewer's role travels with the queue so the CMS can decide what to
    // offer without a second request.
    return NextResponse.json({ ...result, viewer: { role: user.role } })
  } catch (err) {
    return respondToError("admin/articles", err)
  }
}
