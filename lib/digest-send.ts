/**
 * NotiLab Digest Delivery
 *
 * Sends pending DigestDelivery rows via Resend's REST API.
 * No SDK required — uses fetch directly so no extra dependency is needed.
 *
 * Channel extension notes:
 *   To add Telegram / WhatsApp, implement a sendViaTelegram(email, subject, text)
 *   or sendViaWhatsApp() function following the same
 *   pending → sent / failed pattern. The DigestDelivery rows already support a
 *   "channel" discriminator — add `channel String @default("email")` to the
 *   schema when you're ready to fan out to multiple channels from one issue.
 */

import { prisma } from "./prisma"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendResult {
  total: number
  sent: number
  failed: number
  durationMs: number
}

interface PendingDelivery {
  id: string
  email: string
  issue: {
    subject: string
    htmlContent: string
  }
}

// ---------------------------------------------------------------------------
// Cast helper
// ---------------------------------------------------------------------------

type PrismaExt = typeof prisma & {
  digestDelivery: {
    findMany: (a: Record<string, unknown>) => Promise<PendingDelivery[]>
    update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>
  }
}

// ---------------------------------------------------------------------------
// Resend API helper
// ---------------------------------------------------------------------------

const RESEND_API = "https://api.resend.com/emails"
const FROM_ADDRESS = process.env.DIGEST_FROM_EMAIL ?? "NotiLab <digest@notilab.app>"

interface ResendError {
  name: string
  message: string
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    })

    if (res.ok) return { ok: true }

    const body = (await res.json()) as ResendError
    return { ok: false, error: `Resend ${res.status}: ${body.message ?? res.statusText}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ---------------------------------------------------------------------------
// Batch delivery
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50

/**
 * Processes all pending DigestDelivery rows:
 * - loads up to `batchSize` pending deliveries (joined with their issue)
 * - sends each email via Resend
 * - marks status "sent" on success, "failed" on error
 *
 * Safe to call multiple times — already-sent rows are ignored because the
 * query filters by `status: "pending"`.
 */
export async function sendPendingDigests(batchSize = BATCH_SIZE): Promise<SendResult> {
  const start = Date.now()
  const db = prisma as unknown as PrismaExt

  const deliveries = await db.digestDelivery.findMany({
    where: { status: "pending" },
    take: batchSize,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      issue: {
        select: { subject: true, htmlContent: true },
      },
    },
  })

  let sent = 0
  let failed = 0

  for (const delivery of deliveries) {
    const result = await sendViaResend(
      delivery.email,
      delivery.issue.subject,
      delivery.issue.htmlContent,
    )

    if (result.ok) {
      await db.digestDelivery.update({
        where: { id: delivery.id },
        data: { status: "sent", sentAt: new Date(), error: null },
      })
      sent++
    } else {
      console.warn(`[digest-send] Failed to deliver to ${delivery.email}: ${result.error}`)
      await db.digestDelivery.update({
        where: { id: delivery.id },
        data: { status: "failed", error: result.error?.slice(0, 500) ?? "Unknown error" },
      })
      failed++
    }
  }

  return { total: deliveries.length, sent, failed, durationMs: Date.now() - start }
}
