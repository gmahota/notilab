/**
 * lib/messaging/whatsapp.ts
 *
 * WhatsApp channel adapter.
 *
 * Phase 1 (current): share links via wa.me — no API key needed.
 *   - buildShareUrl() — embed any text in a wa.me link
 *   - Works from the frontend (open in browser) or as a shareable URL in emails
 *
 * Phase 2 (future): WhatsApp Business Cloud API.
 *   - sendWhatsAppMessage() is already wired — set WHATSAPP_TOKEN + WHATSAPP_PHONE_ID
 *     and it will switch from "not configured" to real delivery automatically.
 *   - Uses template messages for the first outbound contact (Meta requirement).
 *   - For free-form replies (within 24h window), use text messages directly.
 *
 * Env vars (Phase 2):
 *   WHATSAPP_TOKEN        — Meta app access token
 *   WHATSAPP_PHONE_ID     — WhatsApp Business phone number ID
 *   WHATSAPP_VERIFY_TOKEN — Webhook verification token
 */

import { buildWhatsAppShareUrl } from "./format"

// ---------------------------------------------------------------------------
// Phase 1 — Share links (no API required)
// ---------------------------------------------------------------------------

/**
 * Returns a wa.me URL that opens WhatsApp with pre-filled text.
 * Use this for CTA buttons in emails or on the website.
 */
export function getWhatsAppShareLink(text: string): string {
  return buildWhatsAppShareUrl(text)
}

// ---------------------------------------------------------------------------
// Phase 2 — WhatsApp Business Cloud API
// ---------------------------------------------------------------------------

export interface WhatsAppSendResult {
  ok: boolean
  messageId?: string
  error?: string
}

/**
 * Sends a plain-text message via WhatsApp Business Cloud API.
 *
 * Phase 2: requires WHATSAPP_TOKEN and WHATSAPP_PHONE_ID.
 * Returns { ok: false, error: "not configured" } if env vars are missing
 * so callers can log and skip gracefully.
 *
 * @param to   — Recipient phone in E.164 format (e.g. "351912345678")
 * @param text — Plain text body (no markdown)
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID

  if (!token || !phoneId) {
    return { ok: false, error: "WhatsApp Business API not configured" }
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      },
    )

    if (res.ok) {
      const data = await res.json() as { messages?: Array<{ id: string }> }
      return { ok: true, messageId: data.messages?.[0]?.id }
    }

    const err = await res.text()
    return { ok: false, error: `WhatsApp API ${res.status}: ${err.slice(0, 200)}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Verifies a WhatsApp webhook challenge (GET request from Meta).
 * Returns the hub.challenge string if valid, null otherwise.
 */
export function verifyWhatsAppWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null,
): string | null {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (!verifyToken) return null
  if (mode === "subscribe" && token === verifyToken) return challenge
  return null
}

/** Returns true if WhatsApp Business API is configured. */
export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID)
}
