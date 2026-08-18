import { type NextRequest, NextResponse } from "next/server"
import { checkAdminAuth } from "@/lib/admin-auth"
import { generateDraftFromSources } from "@/lib/ai-generate-service"

export const dynamic = "force-dynamic"

/**
 * POST /api/ai/generate-news
 *
 * Produces a DRAFT grounded in articles we already store. See
 * lib/ai-generate-service.ts for why generation is source-bound: this endpoint
 * previously returned a fabricated article for any topic, complete with an
 * invented expert quote and a `Math.random()` value presented as an SEO score.
 *
 * It also had no authentication, so anyone could spend AI tokens through it.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const user = await checkAdminAuth()
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const { topic, category, tone, length, style, audience } = (body ?? {}) as Record<string, unknown>

  if (typeof topic !== "string" || topic.trim().length < 3) {
    return NextResponse.json(
      { success: false, error: "`topic` is required and must be at least 3 characters." },
      { status: 400 },
    )
  }

  const result = await generateDraftFromSources({
    topic,
    categorySlug: typeof category === "string" ? category : undefined,
    tone: typeof tone === "string" ? tone : undefined,
    length: typeof length === "string" ? length : undefined,
    style: typeof style === "string" ? style : undefined,
    audience: typeof audience === "string" ? audience : undefined,
  })

  if (!result.success) {
    // NO_SOURCES is a legitimate answer, not a server fault — the caller asked
    // for a topic we hold no coverage on.
    const status = result.code === "NO_SOURCES" || result.code === "INVALID_INPUT" ? 422 : 502
    return NextResponse.json({ success: false, error: result.error, code: result.code }, { status })
  }

  return NextResponse.json({ success: true, data: result.data })
}
