/**
 * NotiLab Digest Service
 *
 * Responsibilities:
 *  1. Article selection — pick top-ranked articles for a time window, avoiding
 *     duplicates from the last issue of the same frequency.
 *  2. Content building — build the HTML email and subject line.
 *  3. Issue generation — create a DigestIssue row and pending DigestDelivery
 *     rows for every matching active subscriber.
 *
 * Delivery (calling Resend, updating status) lives in lib/digest-send.ts.
 * Channel extension (Telegram, WhatsApp) should implement the same
 * DigestDelivery row + status pattern with a different sender function.
 */

import { prisma } from "./prisma"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DigestFrequency = "daily" | "weekly"

export interface DigestArticle {
  id: string
  title: string
  summary: string
  aiSummary: string | null
  categoryName: string
  categorySlug: string
  slug: string | null
  sourceUrl: string
  rankingScore: number
  sentiment: string | null
  readTime: number | null
}

export interface GenerateResult {
  frequency: DigestFrequency
  issueId: string | null
  articleCount: number
  subscriberCount: number
  skipped: boolean
  skipReason?: string
}

// ---------------------------------------------------------------------------
// Cast helpers (mock Prisma client does not declare these models)
// ---------------------------------------------------------------------------

type PrismaExt = typeof prisma & {
  digestSubscription: {
    findMany: (a: Record<string, unknown>) => Promise<Array<{ email: string; categories: string[] }>>
  }
  digestIssue: {
    findFirst: (a: Record<string, unknown>) => Promise<{ id: string; articleIds: string[] } | null>
    create: (a: Record<string, unknown>) => Promise<{ id: string }>
  }
  digestDelivery: {
    createMany: (a: Record<string, unknown>) => Promise<{ count: number }>
  }
  news: {
    findMany: (a: Record<string, unknown>) => Promise<Array<{
      id: string
      title: string
      slug: string | null
      summary: string | null
      aiSummary: string | null
      sourceUrl: string
      rankingScore: number
      sentiment: string | null
      readTime: number | null
      category: { name: string; slug: string } | null
    }>>
  }
}

// ---------------------------------------------------------------------------
// Article selection
// ---------------------------------------------------------------------------

const ARTICLE_COUNTS: Record<DigestFrequency, number> = {
  daily: 5,
  weekly: 7,
}

const WINDOW_HOURS: Record<DigestFrequency, number> = {
  daily: 24,
  weekly: 168, // 7 days
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://notilab.app"

async function selectArticles(
  frequency: DigestFrequency,
  excludeIds: string[],
): Promise<DigestArticle[]> {
  const db = prisma as unknown as PrismaExt
  const windowStart = new Date(Date.now() - WINDOW_HOURS[frequency] * 3_600_000)

  const rows = await db.news.findMany({
    where: {
      publishedAt: { gte: windowStart },
      status: "PUBLISHED",
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    },
    orderBy: { rankingScore: "desc" },
    take: ARTICLE_COUNTS[frequency],
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      aiSummary: true,
      sourceUrl: true,
      rankingScore: true,
      sentiment: true,
      readTime: true,
      category: { select: { name: true, slug: true } },
    },
  })

  return rows.map((r: {
    id: string
    title: string
    slug: string | null
    summary: string | null
    aiSummary: string | null
    sourceUrl: string
    rankingScore: number
    sentiment: string | null
    readTime: number | null
    category: { name: string; slug: string } | null
  }) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    summary: r.summary ?? "",
    aiSummary: r.aiSummary,
    categoryName: r.category?.name ?? "General",
    categorySlug: r.category?.slug ?? "general",
    sourceUrl: r.sourceUrl,
    rankingScore: r.rankingScore,
    sentiment: r.sentiment,
    readTime: r.readTime,
  }))
}

// ---------------------------------------------------------------------------
// Content building
// ---------------------------------------------------------------------------

export interface DigestContent {
  subject: string
  html: string
}

function articleUrl(article: DigestArticle): string {
  return article.slug
    ? `${BASE_URL}/article/${article.slug}`
    : article.sourceUrl
}

function sentimentBadge(sentiment: string | null): string {
  if (sentiment === "positive") return "🟢"
  if (sentiment === "negative") return "🔴"
  return "⚪"
}

function buildArticleHTML(article: DigestArticle): string {
  const summary = article.aiSummary || article.summary || ""
  const readLabel = article.readTime ? `${article.readTime} min read` : ""
  const badge = sentimentBadge(article.sentiment)

  return `
  <div style="margin-bottom:20px;padding:16px;background:#1a1a2e;border-radius:10px;border-left:3px solid #0A7FFF;">
    <a href="${articleUrl(article)}" style="color:#fff;font-size:16px;font-weight:700;text-decoration:none;line-height:1.4;">${article.title}</a>
    ${summary ? `<p style="color:#aaa;font-size:14px;margin:8px 0 4px;">${summary}</p>` : ""}
    <div style="display:flex;gap:12px;margin-top:6px;">
      <span style="color:#666;font-size:12px;">${badge} ${article.categoryName}</span>
      ${readLabel ? `<span style="color:#666;font-size:12px;">· ${readLabel}</span>` : ""}
    </div>
  </div>`
}

export function buildDigestContent(
  articles: DigestArticle[],
  frequency: DigestFrequency,
  periodStart: Date,
): DigestContent {
  const now = new Date()
  const dateLabel = now.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const subject =
    frequency === "daily"
      ? `NotiLab Daily · ${dateLabel}`
      : `NotiLab Weekly · ${dateLabel}`

  const intro =
    frequency === "daily"
      ? `Your AI-curated briefing for <strong>${dateLabel}</strong>.`
      : `Your weekly digest. The stories that mattered most.`

  // Group articles by category for the category block
  const byCategory: Record<string, DigestArticle[]> = {}
  for (const a of articles) {
    if (!byCategory[a.categoryName]) byCategory[a.categoryName] = []
    byCategory[a.categoryName].push(a)
  }

  const categoryBlockHTML = Object.entries(byCategory)
    .map(
      ([cat, arts]) => `
    <div style="margin-bottom:6px;">
      <span style="color:#39FF14;font-size:13px;font-weight:600;">${cat}</span>
      <span style="color:#888;font-size:13px;"> · ${arts.length} ${arts.length === 1 ? "story" : "stories"}</span>
    </div>`,
    )
    .join("")

  const articlesHTML = articles.map(buildArticleHTML).join("")

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0B0B0F;color:#fff;padding:24px;max-width:600px;margin:0 auto;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="font-size:26px;font-weight:800;color:#0A7FFF;margin:0;letter-spacing:-0.5px;">⚡ NotiLab</h1>
    <p style="color:#555;font-size:13px;margin:4px 0 0;">News, decoded.</p>
  </div>

  <!-- Intro -->
  <p style="color:#ccc;font-size:15px;margin-bottom:28px;line-height:1.6;">${intro}</p>

  <!-- Category overview -->
  <div style="background:#13131a;border-radius:10px;padding:14px 16px;margin-bottom:28px;">
    <p style="color:#777;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">In this issue</p>
    ${categoryBlockHTML}
  </div>

  <!-- Top stories -->
  <h2 style="color:#fff;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Top Stories</h2>
  ${articlesHTML}

  <hr style="border:none;border-top:1px solid #222;margin:32px 0;" />

  <!-- CTA -->
  <div style="text-align:center;margin-bottom:24px;">
    <a href="${BASE_URL}/feed" style="display:inline-block;background:#0A7FFF;color:#fff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Read full feed →</a>
  </div>

  <!-- Footer -->
  <p style="color:#444;font-size:12px;text-align:center;line-height:1.6;">
    You're receiving this because you subscribed to NotiLab ${frequency} digests.<br/>
    <a href="${BASE_URL}/profile" style="color:#555;">Manage preferences</a> · <a href="${BASE_URL}/unsubscribe" style="color:#555;">Unsubscribe</a>
  </p>

</body>
</html>`

  return { subject, html }
}

// ---------------------------------------------------------------------------
// Issue generation
// ---------------------------------------------------------------------------

/**
 * Generates a DigestIssue for the given frequency if one hasn't been
 * created in the current cycle (today for daily, this week for weekly).
 *
 * Also creates one pending DigestDelivery row per matching active subscriber.
 * Returns summary stats.
 */
export async function generateDigestIssue(
  frequency: DigestFrequency,
): Promise<GenerateResult> {
  const db = prisma as unknown as PrismaExt

  // Guard: don't regenerate if an issue already exists for this cycle
  const cycleStart = getCycleStart(frequency)

  const existing = await db.digestIssue.findFirst({
    where: {
      frequency,
      generatedAt: { gte: cycleStart },
    },
    select: { id: true, articleIds: true },
  })

  if (existing) {
    return {
      frequency,
      issueId: existing.id,
      articleCount: existing.articleIds.length,
      subscriberCount: 0,
      skipped: true,
      skipReason: "Issue already generated for this cycle",
    }
  }

  // Get excluded IDs from the previous issue of the same frequency
  const previousIssue = await db.digestIssue.findFirst({
    where: { frequency },
    orderBy: { generatedAt: "desc" },
    select: { articleIds: true },
  })
  const excludeIds: string[] = previousIssue?.articleIds ?? []

  // Select articles
  const articles = await selectArticles(frequency, excludeIds)

  if (articles.length === 0) {
    return {
      frequency,
      issueId: null,
      articleCount: 0,
      subscriberCount: 0,
      skipped: true,
      skipReason: "No eligible articles found",
    }
  }

  const periodStart = new Date(Date.now() - WINDOW_HOURS[frequency] * 3_600_000)
  const { subject, html } = buildDigestContent(articles, frequency, periodStart)

  // Create the issue
  const issue = await db.digestIssue.create({
    data: {
      frequency,
      periodStart,
      periodEnd: new Date(),
      subject,
      htmlContent: html,
      articleIds: articles.map((a) => a.id),
    },
  })

  // Load matching subscribers
  const subscribers = await db.digestSubscription.findMany({
    where: { frequency, isActive: true },
    select: { email: true, categories: true },
  })

  // Create pending delivery rows
  if (subscribers.length > 0) {
    await db.digestDelivery.createMany({
      data: subscribers.map((s: { email: string; categories: string[] }) => ({
        issueId: issue.id,
        email: s.email,
        status: "pending",
      })),
      skipDuplicates: true,
    })
  }

  return {
    frequency,
    issueId: issue.id,
    articleCount: articles.length,
    subscriberCount: subscribers.length,
    skipped: false,
  }
}

/**
 * Returns the start of the current cycle for duplicate-guard purposes.
 * Daily = start of today UTC. Weekly = start of this Monday UTC.
 */
function getCycleStart(frequency: DigestFrequency): Date {
  const now = new Date()
  if (frequency === "daily") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  }
  // Weekly: Monday 00:00 UTC
  const day = now.getUTCDay() // 0=Sun, 1=Mon …
  const mondayOffset = (day === 0 ? -6 : 1 - day) * 86_400_000
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + mondayOffset,
  )
  return monday
}

// ---------------------------------------------------------------------------
// HTML re-export kept for backward compat (used nowhere but safe to keep)
// ---------------------------------------------------------------------------

/** @deprecated Use buildDigestContent instead */
export function buildDigestHTML(articles: DigestArticle[], frequency: DigestFrequency): string {
  return buildDigestContent(articles, frequency, new Date()).html
}
