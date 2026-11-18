/**
 * GET   /api/admin/articles/:id — the review screen's payload.
 * PATCH /api/admin/articles/:id — edit the editable fields.
 *
 * The GET returns the source's text and NotiLab's rewrite as two separate
 * fields. That is a hard requirement of the strategy's R4, not a convenience:
 * a reviewer who cannot see the source cannot detect a hallucination, and the
 * whole reason `News.content` is immutable is to be the evidence that check
 * runs against.
 *
 * The PATCH surface is whatever `updateArticle` accepts and nothing else —
 * status, provenance, `publishedAt` and the computed scores are unreachable
 * through it by construction, not by this route remembering to filter them.
 */

import { type NextRequest, NextResponse } from "next/server"
import { getReviewArticle } from "@/lib/editorial/review-queue"
import { updateArticle, type UpdateArticleInput } from "@/lib/editorial/article-service"
import { ARTICLE_PRIORITIES, type ArticlePriority } from "@/lib/editorial/transitions"
import { requireAdmin, respondToError, readJson } from "@/app/api/admin/articles/_respond"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { user, error } = await requireAdmin()
  if (!user) return error

  const { id } = await context.params

  try {
    return NextResponse.json(await getReviewArticle(id, user.role))
  } catch (err) {
    return respondToError("admin/articles/[id]", err)
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string")
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { user, error } = await requireAdmin()
  if (!user) return error

  const { id } = await context.params
  const { body, error: bodyError } = await readJson(request)
  if (!body) return bodyError

  // Built field by field rather than spread from the body: whatever arrives
  // here reaches a service call, and an unexpected key is a bug waiting for a
  // version of `updateArticle` that happens to accept it.
  const patch: UpdateArticleInput = {}
  if (typeof body.title === "string") patch.title = body.title
  if (typeof body.summary === "string") patch.summary = body.summary
  if (typeof body.content === "string") patch.content = body.content
  if (typeof body.categorySlug === "string") patch.categorySlug = body.categorySlug
  if (isStringArray(body.tags)) patch.tags = body.tags
  if (typeof body.readTime === "number") patch.readTime = body.readTime
  if (
    typeof body.priority === "string" &&
    (ARTICLE_PRIORITIES as readonly string[]).includes(body.priority)
  ) {
    patch.priority = body.priority as ArticlePriority
  }

  try {
    const result = await updateArticle(id, patch)
    return NextResponse.json(result)
  } catch (err) {
    return respondToError("admin/articles/[id] PATCH", err)
  }
}
