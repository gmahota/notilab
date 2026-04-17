import { NextResponse } from "next/server"
import { generateDigestIssue } from "@/lib/digest"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization")
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Always generate daily. Only generate weekly on Mondays (UTC).
    const isMonday = new Date().getUTCDay() === 1

    const [daily, weekly] = await Promise.all([
      generateDigestIssue("daily"),
      isMonday ? generateDigestIssue("weekly") : Promise.resolve(null),
    ])

    return NextResponse.json({
      ok: true,
      daily: {
        issueId: daily.issueId,
        articleCount: daily.articleCount,
        subscriberCount: daily.subscriberCount,
        skipped: daily.skipped,
        skipReason: daily.skipReason,
      },
      weekly: weekly
        ? {
            issueId: weekly.issueId,
            articleCount: weekly.articleCount,
            subscriberCount: weekly.subscriberCount,
            skipped: weekly.skipped,
            skipReason: weekly.skipReason,
          }
        : { skipped: true, skipReason: "Not Monday" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[cron/generate-digest] Fatal:", message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
