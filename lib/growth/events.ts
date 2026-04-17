/**
 * lib/growth/events.ts
 *
 * Lightweight, append-only event tracking.
 * Called server-side from API routes — never from components directly.
 *
 * Design rules:
 *   - Never throws: failures are logged but silently swallowed so tracking
 *     never breaks the user-facing request.
 *   - Fire-and-forget on the client: POST /api/growth/events, no await.
 *   - No PII in meta: store IDs, not emails or names.
 */

import { prisma } from "../prisma"

// ---------------------------------------------------------------------------
// Event catalogue
// ---------------------------------------------------------------------------

export type GrowthEvent =
  | "article_viewed"
  | "article_saved"
  | "article_shared"
  | "article_explained"
  | "link_pasted"
  | "digest_opened"
  | "digest_clicked"
  | "streak_completed"
  | "trending_alert_clicked"
  | "chatbot_opened"
  | "chatbot_question_sent"
  | "share_panel_opened"
  | "share_snippet_copied"
  // Experimentation
  | "experiment_exposed"    // user first sees an experiment variant
  | "experiment_converted"  // user completes the experiment's goal action

export interface TrackEventInput {
  event: GrowthEvent
  userId?: string
  sessionId?: string
  articleId?: string
  meta?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// PrismaExt cast
// ---------------------------------------------------------------------------

type PrismaExt = typeof prisma & {
  userEvent: {
    create: (a: { data: Record<string, unknown> }) => Promise<unknown>
  }
}

// ---------------------------------------------------------------------------
// Core tracker
// ---------------------------------------------------------------------------

/**
 * Records a growth event. Never rejects — safe to call without try/catch.
 */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    const db = prisma as unknown as PrismaExt
    await db.userEvent.create({
      data: {
        event: input.event,
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        articleId: input.articleId ?? null,
        meta: input.meta ?? null,
      },
    })
  } catch (err) {
    // Never crash the calling request over analytics
    console.error("[growth/events] Failed to track event:", input.event, err)
  }
}

/**
 * Track multiple events in one call (e.g. view + streak in the same request).
 * Still fire-and-forget safe.
 */
export async function trackEvents(inputs: TrackEventInput[]): Promise<void> {
  await Promise.all(inputs.map(trackEvent))
}
