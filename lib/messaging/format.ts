/**
 * lib/messaging/format.ts
 *
 * Channel-agnostic formatters that produce plain text suitable for
 * both Telegram (MarkdownV2) and WhatsApp (plain text / wa.me links).
 *
 * Keep messages short: messaging users scan, they don't read.
 * Max recommended length: ~800 chars for a digest, ~280 for a single alert.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://notilab.app"

// ---------------------------------------------------------------------------
// Shared article shape expected by formatters
// ---------------------------------------------------------------------------

export interface MessageArticle {
  id: string
  title: string
  slug: string | null
  aiSummary: string | null
  summary: string | null
  categoryName: string
  sourceUrl: string
  sentiment: string | null
  readTime: number | null
  rankingScore: number
}

export type MessageType = "daily_digest" | "trending_alert" | "command_response"

// ---------------------------------------------------------------------------
// Telegram MarkdownV2 helpers
// ---------------------------------------------------------------------------

/**
 * Escapes characters that Telegram MarkdownV2 treats as special.
 * Must be applied to all user-supplied strings before embedding in MD.
 */
export function escapeTgMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (c) => `\\${c}`)
}

function articleUrl(article: MessageArticle): string {
  return article.slug ? `${BASE_URL}/article/${article.slug}` : article.sourceUrl
}

function sentimentIcon(sentiment: string | null): string {
  if (sentiment === "positive") return "🟢"
  if (sentiment === "negative") return "🔴"
  return "⚪"
}

// ---------------------------------------------------------------------------
// Telegram formatters
// ---------------------------------------------------------------------------

/**
 * Daily digest message for Telegram.
 * Uses MarkdownV2 — all variable strings must be escaped.
 */
export function formatTelegramDigest(articles: MessageArticle[]): string {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })

  const lines: string[] = [
    `⚡ *NotiLab Daily* — ${escapeTgMd(today)}`,
    "",
    `_Top ${articles.length} stories ranked by AI:_`,
    "",
  ]

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i]
    const summary = (a.aiSummary ?? a.summary ?? "").slice(0, 120).trim()
    const icon = sentimentIcon(a.sentiment)
    const url = articleUrl(a)
    const readTag = a.readTime ? ` · ${a.readTime}m` : ""

    lines.push(
      `${i + 1}\\. ${icon} [${escapeTgMd(a.title)}](${url})`,
      summary ? `   _${escapeTgMd(summary)}_` : "",
      `   ${escapeTgMd(a.categoryName)}${escapeTgMd(readTag)}`,
      "",
    )
  }

  lines.push(
    `📰 [Full feed](${BASE_URL}/feed) · /trending · /help`,
  )

  return lines.filter((l) => l !== undefined).join("\n").trimEnd()
}

/**
 * Single trending alert — compact, one article.
 */
export function formatTelegramTrendingAlert(article: MessageArticle): string {
  const summary = (article.aiSummary ?? article.summary ?? "").slice(0, 160).trim()
  const url = articleUrl(article)

  return [
    `🔥 *Trending Now* — ${escapeTgMd(article.categoryName)}`,
    "",
    `[${escapeTgMd(article.title)}](${url})`,
    summary ? `_${escapeTgMd(summary)}_` : "",
    "",
    `[Read more →](${url})`,
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * Response to a /category or /explain command.
 */
export function formatTelegramCommandResponse(
  articles: MessageArticle[],
  label: string,
): string {
  if (articles.length === 0) {
    return `No recent stories for *${escapeTgMd(label)}*\\. Check back soon\\.`
  }

  const lines: string[] = [`📂 *${escapeTgMd(label)}* — latest stories`, ""]

  for (const a of articles.slice(0, 5)) {
    const url = articleUrl(a)
    lines.push(`• [${escapeTgMd(a.title)}](${url})`)
  }

  lines.push("", `[See all →](${BASE_URL}/category/${articles[0]?.categoryName?.toLowerCase()})`)
  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// WhatsApp formatters (plain text — no markdown)
// ---------------------------------------------------------------------------

/**
 * Daily digest as plain text suitable for WhatsApp.
 * Phase 1: used inside a wa.me share link.
 * Phase 2: sent via WhatsApp Business API.
 */
export function formatWhatsAppDigest(articles: MessageArticle[]): string {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })

  const lines: string[] = [
    `⚡ NotiLab Daily · ${today}`,
    "",
    `Top ${articles.length} stories:`,
    "",
  ]

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i]
    const icon = sentimentIcon(a.sentiment)
    lines.push(`${i + 1}. ${icon} ${a.title}`)
    lines.push(`   ${articleUrl(a)}`)
    lines.push("")
  }

  lines.push(`Full feed: ${BASE_URL}/feed`)
  return lines.join("\n").trimEnd()
}

/**
 * Builds a wa.me share URL containing the digest text.
 * Phase 1 implementation — no API required.
 */
export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/**
 * Single article share text for WhatsApp.
 */
export function formatWhatsAppArticleShare(article: MessageArticle): string {
  const summary = (article.aiSummary ?? article.summary ?? "").slice(0, 200).trim()
  const url = articleUrl(article)
  return [
    `📰 ${article.title}`,
    summary,
    url,
    `via NotiLab — ${BASE_URL}`,
  ]
    .filter(Boolean)
    .join("\n\n")
}
