import { NextResponse } from "next/server"
import { getShareData, logShare, injectReferralUrl } from "@/lib/growth/share"
import { createShareCode } from "@/lib/growth/referral"

export const dynamic = "force-dynamic"

// ---------------------------------------------------------------------------
// GET /api/growth/share/[id]
// Returns share data with AI snippet. Does NOT create a referral code yet —
// codes are only created when the user actually triggers a share (POST).
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid article ID" }, { status: 400 })
  }

  const data = await getShareData(id)

  if (!data) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  return NextResponse.json(data)
}

// ---------------------------------------------------------------------------
// POST /api/growth/share/[id]
// Creates a referral code, logs the share, returns updated share URLs.
// ---------------------------------------------------------------------------

const VALID_CHANNELS = new Set(["whatsapp", "telegram", "twitter", "copy"])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid article ID" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { channel, userId, snippet } = (body ?? {}) as Record<string, unknown>

  if (typeof channel !== "string" || !VALID_CHANNELS.has(channel)) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 })
  }

  const resolvedUserId = typeof userId === "string" ? userId : undefined
  const resolvedSnippet = typeof snippet === "string" ? snippet : undefined

  // Create referral code for attribution tracking
  const { code, referralUrl } = await createShareCode({
    articleId: id,
    channel,
    snippet: resolvedSnippet,
    sharedByUserId: resolvedUserId,
  })

  // Log to legacy ShareHistory (keeps backward compatibility)
  await logShare(id, channel, resolvedUserId, resolvedSnippet)

  // Return the referral-aware URLs so the client can open the correct link
  const data = await getShareData(id)
  if (data) {
    const enriched = injectReferralUrl(data, referralUrl)
    return NextResponse.json({ ok: true, code, referralUrl, shareUrls: enriched.shareUrls })
  }

  return NextResponse.json({ ok: true, code, referralUrl })
}
