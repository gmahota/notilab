import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  TelegramUpdate,
  parseCommand,
  verifyTelegramWebhook,
  sendTelegramMessage,
  COMMAND_CATEGORY_MAP,
  TelegramCommand,
} from "@/lib/messaging/telegram"
import {
  formatTelegramCommandResponse,
  formatTelegramDigest,
  escapeTgMd,
  MessageArticle,
} from "@/lib/messaging/format"

export const dynamic = "force-dynamic"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://notilab.app"

// ---------------------------------------------------------------------------
// Prisma cast
// ---------------------------------------------------------------------------

type PrismaExt = typeof prisma & {
  messagingSubscription: {
    upsert: (a: Record<string, unknown>) => Promise<{ id: string }>
    update: (a: { where: { channel: string; channelId: string }; data: Record<string, unknown> }) => Promise<unknown>
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

// ---------------------------------------------------------------------------
// Article fetcher for command responses
// ---------------------------------------------------------------------------

async function getArticlesForCategory(categorySlug?: string): Promise<MessageArticle[]> {
  const db = prisma as unknown as PrismaExt
  const windowStart = new Date(Date.now() - 24 * 3_600_000)

  const rows = await db.news.findMany({
    where: {
      publishedAt: { gte: windowStart },
      status: "PUBLISHED",
      ...(categorySlug && categorySlug !== "trending"
        ? { category: { slug: categorySlug } }
        : {}),
    },
    orderBy: { rankingScore: "desc" },
    take: 5,
    select: {
      id: true, title: true, slug: true, aiSummary: true, summary: true,
      sourceUrl: true, rankingScore: true, sentiment: true, readTime: true,
      category: { select: { name: true, slug: true } },
    },
  })

  return rows.map((r) => ({
    id: r.id, title: r.title, slug: r.slug, aiSummary: r.aiSummary,
    summary: r.summary, categoryName: r.category?.name ?? "General",
    categorySlug: r.category?.slug ?? "general", sourceUrl: r.sourceUrl,
    rankingScore: r.rankingScore, sentiment: r.sentiment, readTime: r.readTime,
  }))
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function handleStart(chatId: number, firstName: string): Promise<void> {
  const name = escapeTgMd(firstName || "there")
  const text = [
    `👋 Hey ${name}\\! Welcome to *NotiLab*\\.`,
    "",
    "I send you AI\\-curated news summaries\\.",
    "",
    "*Commands:*",
    "/trending — top stories right now",
    "/technology — tech news",
    "/politics — politics & world",
    "/business — markets & economy",
    "/football — sports",
    "/science — science & health",
    "/subscribe — get daily digests",
    "/unsubscribe — stop messages",
    "/help — show this menu",
    "",
    `[Open NotiLab →](${BASE_URL})`,
  ].join("\n")

  await sendTelegramMessage(chatId, text)
}

async function handleHelp(chatId: number): Promise<void> {
  await handleStart(chatId, "")
}

async function handleCategoryCommand(
  chatId: number,
  command: TelegramCommand,
): Promise<void> {
  const categorySlug = COMMAND_CATEGORY_MAP[command]
  const articles = await getArticlesForCategory(categorySlug)
  const label = command.replace("/", "").charAt(0).toUpperCase() + command.slice(2)
  const text = formatTelegramCommandResponse(articles, label)
  await sendTelegramMessage(chatId, text)
}

async function handleTrending(chatId: number): Promise<void> {
  const articles = await getArticlesForCategory("trending")
  const text = formatTelegramDigest(articles.slice(0, 3))
  await sendTelegramMessage(chatId, text)
}

async function handleExplain(chatId: number, args: string): Promise<void> {
  if (!args.trim()) {
    await sendTelegramMessage(
      chatId,
      "Usage: `/explain <topic or question>`\nExample: `/explain What is quantum computing?`",
    )
    return
  }
  // Redirect to the platform's explain feature
  const q = encodeURIComponent(args.trim())
  await sendTelegramMessage(
    chatId,
    `💡 Open NotiLab to get an AI explanation:\n[Explain: ${escapeTgMd(args.trim())}](${BASE_URL}/explain?q=${q})`,
  )
}

async function handleSubscribe(chatId: number): Promise<void> {
  const db = prisma as unknown as PrismaExt
  await db.messagingSubscription.upsert({
    where: { channel_channelId: { channel: "telegram", channelId: String(chatId) } },
    update: { isActive: true },
    create: {
      channel: "telegram",
      channelId: String(chatId),
      isActive: true,
      frequency: "daily",
      categories: [],
    },
  })
  await sendTelegramMessage(
    chatId,
    "✅ Subscribed\\! You'll receive daily news digests every morning\\.\n\nUse /unsubscribe to stop anytime\\.",
  )
}

async function handleUnsubscribe(chatId: number): Promise<void> {
  const db = prisma as unknown as PrismaExt
  try {
    await db.messagingSubscription.update({
      where: { channel_channelId: { channel: "telegram", channelId: String(chatId) } },
      data: { isActive: false },
    })
  } catch {
    // Subscription didn't exist — ignore
  }
  await sendTelegramMessage(chatId, "👋 Unsubscribed\\. You won't receive further messages\\.")
}

// ---------------------------------------------------------------------------
// Webhook POST handler — receives updates from Telegram
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
  if (!verifyTelegramWebhook(secretHeader)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let update: TelegramUpdate
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const message = update.message
  if (!message) {
    // Ignore non-message updates (edited messages, channel posts, etc.)
    return NextResponse.json({ ok: true })
  }

  const chatId = message.chat.id
  const parsed = parseCommand(message.text)

  if (!parsed) {
    // Not a command — ignore silently (could add NLP here later)
    return NextResponse.json({ ok: true })
  }

  const { command, args } = parsed

  // Route to handler — fire and don't await so Telegram 5s timeout is met
  const handle = async () => {
    switch (command as TelegramCommand) {
      case "/start":
        await handleStart(chatId, message.from?.first_name ?? "")
        break
      case "/help":
        await handleHelp(chatId)
        break
      case "/trending":
        await handleTrending(chatId)
        break
      case "/politics":
      case "/football":
      case "/technology":
      case "/business":
      case "/science":
      case "/health":
        await handleCategoryCommand(chatId, command as TelegramCommand)
        break
      case "/explain":
        await handleExplain(chatId, args)
        break
      case "/subscribe":
        await handleSubscribe(chatId)
        break
      case "/unsubscribe":
        await handleUnsubscribe(chatId)
        break
      default:
        await sendTelegramMessage(
          chatId,
          `Unknown command\\. Use /help to see available commands\\.`,
        )
    }
  }

  // Respond to Telegram immediately, then process
  handle().catch((err) => {
    console.error("[telegram-webhook] Handler error:", err)
  })

  return NextResponse.json({ ok: true })
}
