/**
 * lib/messaging/deliver.ts
 *
 * Delivery service: selects articles, formats messages, dispatches through
 * channel adapters, and logs results in MessagingDelivery rows.
 *
 * Entry points:
 *   runMessagingBatch()  — called by the cron job every 15 min (or on schedule)
 *
 * Architecture:
 *   1. Load active MessagingSubscription rows for the current trigger
 *   2. Load top-ranked articles for the delivery window
 *   3. Format per channel (Telegram MarkdownV2 / WhatsApp plain text)
 *   4. Send via channel adapter
 *   5. Write MessagingDelivery row with status + telegramMsgId
 */

import { prisma } from "../prisma"
import { MessageArticle, formatTelegramDigest, formatWhatsAppDigest } from "./format"
import { sendTelegramMessage } from "./telegram"
import { sendWhatsAppMessage, isWhatsAppConfigured } from "./whatsapp"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeliveryTrigger = "daily_digest" | "trending_alert"

export interface BatchResult {
  trigger: DeliveryTrigger
  total: number
  sent: number
  failed: number
  skipped: number
  durationMs: number
}

// ---------------------------------------------------------------------------
// Prisma cast helpers
// ---------------------------------------------------------------------------

type PrismaExt = typeof prisma & {
  messagingSubscription: {
    findMany: (a: Record<string, unknown>) => Promise<Array<{
      id: string
      channel: string
      channelId: string
      categories: string[]
    }>>
  }
  messagingDelivery: {
    create: (a: { data: Record<string, unknown> }) => Promise<{ id: string }>
    update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>
    findFirst: (a: Record<string, unknown>) => Promise<{ id: string } | null>
  }
  news: {
    findMany: (a: Record<string, unknown>) => Promise<Array<{
      id: string
      title: string
      slug: string | null
      aiSummary: string | null
      summary: string | null
      sourceUrl: string
      rankingScore: number
      sentiment: string | null
      readTime: number | null
      category: { name: string; slug: string } | null
    }>>
  }
}

const WINDOW_HOURS = 24
const TOP_N = 5

// ---------------------------------------------------------------------------
// Article selection
// ---------------------------------------------------------------------------

async function fetchTopArticles(db: PrismaExt, categorySlug?: string): Promise<MessageArticle[]> {
  const windowStart = new Date(Date.now() - WINDOW_HOURS * 3_600_000)

  const rows = await db.news.findMany({
    where: {
      publishedAt: { gte: windowStart },
      status: "PUBLISHED",
      ...(categorySlug && categorySlug !== "trending"
        ? { category: { slug: categorySlug } }
        : {}),
    },
    orderBy: { rankingScore: "desc" },
    take: TOP_N,
    select: {
      id: true,
      title: true,
      slug: true,
      aiSummary: true,
      summary: true,
      sourceUrl: true,
      rankingScore: true,
      sentiment: true,
      readTime: true,
      category: { select: { name: true, slug: true } },
    },
  })

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    aiSummary: r.aiSummary,
    summary: r.summary,
    categoryName: r.category?.name ?? "General",
    categorySlug: r.category?.slug ?? "general",
    sourceUrl: r.sourceUrl,
    rankingScore: r.rankingScore,
    sentiment: r.sentiment,
    readTime: r.readTime,
  }))
}

// ---------------------------------------------------------------------------
// Guard: skip if already delivered today
// ---------------------------------------------------------------------------

async function alreadyDeliveredToday(
  db: PrismaExt,
  subscriptionId: string,
  messageType: string,
): Promise<boolean> {
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const existing = await db.messagingDelivery.findFirst({
    where: {
      subscriptionId,
      messageType,
      status: "sent",
      sentAt: { gte: todayStart },
    },
  })

  return existing !== null
}

// ---------------------------------------------------------------------------
// Per-subscription dispatch
// ---------------------------------------------------------------------------

async function dispatchToSubscription(
  db: PrismaExt,
  sub: { id: string; channel: string; channelId: string; categories: string[] },
  articles: MessageArticle[],
  messageType: DeliveryTrigger,
): Promise<"sent" | "failed" | "skipped"> {
  if (articles.length === 0) return "skipped"

  const duplicate = await alreadyDeliveredToday(db, sub.id, messageType)
  if (duplicate) return "skipped"

  // Create pending delivery row
  const delivery = await db.messagingDelivery.create({
    data: {
      subscriptionId: sub.id,
      channel: sub.channel,
      messageType,
      status: "pending",
      articleIds: articles.map((a) => a.id),
    },
  })

  try {
    let result: { ok: boolean; error?: string; messageId?: number | string }

    if (sub.channel === "telegram") {
      const text = formatTelegramDigest(articles)
      const tgResult = await sendTelegramMessage(sub.channelId, text)
      result = tgResult

      if (tgResult.ok) {
        await db.messagingDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "sent",
            sentAt: new Date(),
            telegramMsgId: tgResult.messageId ?? null,
          },
        })
        return "sent"
      }
    } else if (sub.channel === "whatsapp") {
      if (!isWhatsAppConfigured()) {
        // Phase 1: skip silently — WA not yet enabled
        await db.messagingDelivery.update({
          where: { id: delivery.id },
          data: { status: "failed", error: "WhatsApp Business API not configured" },
        })
        return "skipped"
      }

      const text = formatWhatsAppDigest(articles)
      result = await sendWhatsAppMessage(sub.channelId, text)

      if (result.ok) {
        await db.messagingDelivery.update({
          where: { id: delivery.id },
          data: { status: "sent", sentAt: new Date() },
        })
        return "sent"
      }
    } else {
      await db.messagingDelivery.update({
        where: { id: delivery.id },
        data: { status: "failed", error: `Unknown channel: ${sub.channel}` },
      })
      return "failed"
    }

    // If we reach here, send failed
    const errorMsg = (result as { error?: string }).error ?? "Unknown error"
    await db.messagingDelivery.update({
      where: { id: delivery.id },
      data: { status: "failed", error: errorMsg.slice(0, 500) },
    })
    return "failed"
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.messagingDelivery.update({
      where: { id: delivery.id },
      data: { status: "failed", error: msg.slice(0, 500) },
    })
    return "failed"
  }
}

// ---------------------------------------------------------------------------
// Main batch entry point
// ---------------------------------------------------------------------------

/**
 * Runs the messaging delivery batch for the given trigger type.
 *
 * - Loads all active subscriptions for the trigger's typical frequency.
 * - Fetches top articles once (global) then per-subscription if category
 *   filters are set.
 * - Dispatches to each subscription's channel adapter.
 * - Returns aggregate stats.
 */
export async function runMessagingBatch(
  trigger: DeliveryTrigger = "daily_digest",
): Promise<BatchResult> {
  const start = Date.now()
  const db = prisma as unknown as PrismaExt

  const subscriptions = await db.messagingSubscription.findMany({
    where: { isActive: true },
    select: { id: true, channel: true, channelId: true, categories: true },
  })

  // Pre-fetch global top articles (used when subscription has no category filter)
  const globalArticles = await fetchTopArticles(db)

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const sub of subscriptions) {
    // If the subscription has category preferences, fetch a filtered set
    const articles =
      sub.categories.length > 0
        ? await fetchTopArticles(db, sub.categories[0])
        : globalArticles

    const outcome = await dispatchToSubscription(db, sub, articles, trigger)

    if (outcome === "sent") sent++
    else if (outcome === "failed") failed++
    else skipped++
  }

  return {
    trigger,
    total: subscriptions.length,
    sent,
    failed,
    skipped,
    durationMs: Date.now() - start,
  }
}
