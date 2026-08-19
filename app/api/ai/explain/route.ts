import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * POST /api/ai/explain
 *
 * Serves the explainer text the AI enrichment pipeline already produced and
 * stored on `ArticleAI` — it does not call a model. The enrichment cron
 * (`/api/cron/process-ai-news`) writes these fields once per article, so
 * reading them here is instant, costs nothing per request, and returns exactly
 * the text a human can audit against the source.
 *
 * This replaced three canned paragraphs returned for *any* topic, behind an
 * artificial 1.5s delay that made it look like real processing. Asking it to
 * explain a football transfer returned EU AI-regulation analysis, asserting a
 * "risk-based classification system" and a "24-36 month" timeline that had
 * nothing to do with the request.
 *
 * Body: { articleId: string, complexity?: "simple" | "child" | "expert" }
 */

type Complexity = "simple" | "child" | "expert"

function pickExplanation(
  complexity: Complexity,
  ai: { tldr: string | null; whyItMatters: string | null; explainLikeIm10: string | null },
): string | null {
  switch (complexity) {
    case "child":
      return ai.explainLikeIm10
    case "expert":
      return ai.whyItMatters
    default:
      return ai.tldr
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const { articleId, complexity } = (body ?? {}) as Record<string, unknown>

  if (typeof articleId !== "string" || !articleId.trim()) {
    return NextResponse.json(
      { success: false, error: "`articleId` is required." },
      { status: 400 },
    )
  }

  const level: Complexity =
    complexity === "child" || complexity === "expert" ? complexity : "simple"

  try {
    const article = await prisma.news.findUnique({
      where: { id: articleId },
      select: {
        title: true,
        articleAI: {
          select: { tldr: true, whyItMatters: true, explainLikeIm10: true },
        },
      },
    })

    if (!article) {
      return NextResponse.json({ success: false, error: "Article not found" }, { status: 404 })
    }

    if (!article.articleAI) {
      // Enrichment has not run for this article yet. Saying so is the honest
      // answer — the previous implementation would have invented a paragraph.
      return NextResponse.json(
        {
          success: false,
          error: "This article has not been through AI enrichment yet.",
          code: "NOT_ENRICHED",
        },
        { status: 409 },
      )
    }

    const explanation = pickExplanation(level, article.articleAI)

    if (!explanation) {
      return NextResponse.json(
        {
          success: false,
          error: "No explanation is stored for this article at that level.",
          code: "NOT_AVAILABLE",
        },
        { status: 409 },
      )
    }

    return NextResponse.json({
      success: true,
      data: { articleId, complexity: level, explanation, title: article.title },
    })
  } catch (error) {
    console.error("[ai/explain]", error)
    return NextResponse.json(
      { success: false, error: "Failed to load explanation" },
      { status: 500 },
    )
  }
}
