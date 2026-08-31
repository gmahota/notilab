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
import { storyTablesPresent } from "../story-tables"

// ---------------------------------------------------------------------------
// Event catalogue
// ---------------------------------------------------------------------------

export type GrowthEvent =
  | "article_viewed"
  | "article_saved"
  | "article_shared"
  | "article_reacted"
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
  // NOW V2 story feed (spec § 35). These carry `storyId`, not `articleId`:
  // a Story can span several articles, so attributing to one of them would
  // misreport which event the user actually saw.
  | "story_impression"    // card entered the viewport
  | "story_open"          // Brief opened
  | "story_skip"          // advanced away before the read threshold
  | "story_read_30s"      // card held long enough to have been read
  | "story_source_open"   // an original source was opened
  | "story_save"
  | "story_share"
  | "story_ask_ai"
  | "story_next"
  | "story_previous"
  // Experimentation
  | "experiment_exposed"    // user first sees an experiment variant
  | "experiment_converted"  // user completes the experiment's goal action

export interface TrackEventInput {
  event: GrowthEvent
  userId?: string
  sessionId?: string
  articleId?: string
  /** Story context for `story_*` events. */
  storyId?: string
  meta?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// PrismaExt cast
// ---------------------------------------------------------------------------

type PrismaExt = typeof prisma & {
  userEvent: {
    create: (a: {
      data: Record<string, unknown>
      select?: Record<string, unknown>
    }) => Promise<unknown>
  }
}

// ---------------------------------------------------------------------------
// Core tracker
// ---------------------------------------------------------------------------

/**
 * Records a growth event. Never rejects — safe to call without try/catch.
 *
 * Two details here exist because the NOW V2 code can be deployed before the
 * `story_model` migration is applied, and analytics must not break in between:
 *
 *  - **`select: { id: true }`.** By default Prisma returns the whole row, so its
 *    `RETURNING` clause names every column in the schema — including `storyId`.
 *    On a database without that column, *every* event write fails, article
 *    events included, even ones that never mention `storyId`. Narrowing the
 *    selection keeps the statement to columns that exist.
 *
 *  - **The `storyId` column is only written when it exists.** Otherwise the id
 *    goes into `meta`, so story events are still recorded during the window
 *    rather than dropped. The check is a cached probe, not a failed write, so it
 *    costs nothing per event and logs nothing alarming.
 */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  const data: Record<string, unknown> = {
    event: input.event,
    userId: input.userId ?? null,
    sessionId: input.sessionId ?? null,
    articleId: input.articleId ?? null,
    meta: input.meta ?? null,
  }

  try {
    if (input.storyId) {
      if (await storyTablesPresent()) {
        data.storyId = input.storyId
      } else {
        data.meta = { ...(input.meta ?? {}), storyId: input.storyId }
      }
    }

    const db = prisma as unknown as PrismaExt
    await db.userEvent.create({ data, select: { id: true } })
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
