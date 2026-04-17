/**
 * lib/messaging/telegram.ts
 *
 * Thin adapter around the Telegram Bot API.
 * Wraps sendMessage and the webhook-based command router.
 *
 * Env vars required:
 *   TELEGRAM_BOT_TOKEN  — from @BotFather
 *
 * Webhook setup (one-time, run after deploy):
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://yourdomain.app/api/messaging/telegram/webhook
 */

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

// ---------------------------------------------------------------------------
// Core send helper
// ---------------------------------------------------------------------------

export interface SendResult {
  ok: boolean
  messageId?: number
  error?: string
}

/**
 * Sends a MarkdownV2-formatted message to a Telegram chat.
 * Returns the Telegram message_id on success so it can be stored for edits.
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options: {
    parseMode?: "MarkdownV2" | "HTML"
    disableWebPagePreview?: boolean
  } = {},
): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not configured" }

  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options.parseMode ?? "MarkdownV2",
        disable_web_page_preview: options.disableWebPagePreview ?? true,
      }),
    })

    const data = await res.json() as { ok: boolean; result?: { message_id: number }; description?: string }

    if (data.ok) {
      return { ok: true, messageId: data.result?.message_id }
    }
    return { ok: false, error: `Telegram API: ${data.description ?? "unknown error"}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ---------------------------------------------------------------------------
// Command router
// ---------------------------------------------------------------------------

export type TelegramCommand =
  | "/start"
  | "/help"
  | "/trending"
  | "/politics"
  | "/football"
  | "/technology"
  | "/business"
  | "/science"
  | "/health"
  | "/explain"
  | "/subscribe"
  | "/unsubscribe"

/** Maps bot commands to category slugs for feed queries. */
export const COMMAND_CATEGORY_MAP: Partial<Record<TelegramCommand, string>> = {
  "/trending": "trending",
  "/politics": "politics",
  "/football": "football",
  "/technology": "technology",
  "/business": "business",
  "/science": "science",
  "/health": "health",
}

export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from?: { id: number; username?: string; first_name?: string }
    chat: { id: number; type: string }
    text?: string
    date: number
  }
}

/** Extracts the base command (strip args) from message text. */
export function parseCommand(text: string | undefined): { command: string; args: string } | null {
  if (!text?.startsWith("/")) return null
  const [rawCmd, ...rest] = text.trim().split(/\s+/)
  // Strip bot username suffix if present: /cmd@BotName
  const command = rawCmd.split("@")[0].toLowerCase()
  return { command, args: rest.join(" ") }
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Validates that the incoming webhook request is from Telegram.
 * Uses the optional TELEGRAM_WEBHOOK_SECRET set via setWebhook's secret_token param.
 * If the secret is not configured, the check is skipped (less secure).
 */
export function verifyTelegramWebhook(
  headerValue: string | null,
): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return true // not configured — accept all (suitable for dev)
  return headerValue === secret
}
