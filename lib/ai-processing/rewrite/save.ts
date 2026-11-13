/**
 * Persists the outcome of a rewrite attempt — success or failure, never both,
 * and never a dressed-up failure.
 *
 * This file is where § 3.5 of docs/editor/ingestion-editorial-workflow.md is
 * actually enforced, which is why it is separate from the enrichment save path:
 *
 *   - A success writes both columns and the timestamp in one update. There is
 *     no path that writes a title without a body.
 *   - A failure increments the counter and records the reason. It never sets
 *     `rewrittenAt`, never clears `rewriteError`, and never writes a body.
 *   - Nothing here falls back to the source text. Publishing the source's words
 *     as ours is the exact outcome the editorial gate exists to prevent, and
 *     reaching it through an error handler rather than a decision would be
 *     worse, not better.
 *
 * `lib/ai-processing/save-result.ts` does the opposite for enrichment — on a
 * failed AI call the caller substitutes a heuristic and this same shape of
 * function stamps `processedAt` and clears `lastError`, recording a failure as
 * a success. That is flagged in § 3.5 as a pre-existing violation to fix on its
 * own ticket. It is deliberately not inherited here.
 */

import { prisma } from "@/lib/prisma"
import type { RewriteResult } from "./types"

/** Retry cap, matching MAX_ATTEMPTS in the enrichment processor. */
export const MAX_REWRITE_ATTEMPTS = 3

interface PrismaWithAI {
  articleAI: {
    update: (args: {
      where: { id: string }
      data: Record<string, unknown>
    }) => Promise<unknown>
  }
}

function db(): PrismaWithAI {
  return prisma as unknown as PrismaWithAI
}

/**
 * Records a completed rewrite. Both columns and the timestamp move together, so
 * a crash between them is impossible and a re-run after one sees a finished
 * article rather than half of one.
 *
 * `rewriteError` is cleared here and only here: the attempt that succeeded is
 * the one that gets to say the article is fine.
 */
export async function saveRewrite(stubId: string, result: RewriteResult): Promise<void> {
  await db().articleAI.update({
    where: { id: stubId },
    data: {
      titleRewritten: result.title,
      contentRewritten: result.content,
      rewrittenAt: new Date(),
      rewriteError: null,
    },
  })
}

/**
 * Records a failed attempt, leaving the article unrewritten.
 *
 * `exhaust` forces the counter to the cap for failures that re-running cannot
 * fix — the model judging the source too thin to ground an honest article. The
 * source text will not change between now and tomorrow, so spending two more
 * provider calls to be told the same thing is waste; the article goes straight
 * to the queue a human has to look at.
 */
export async function recordRewriteFailure(
  stubId: string,
  attempts: number,
  reason: string,
  options: { exhaust?: boolean } = {},
): Promise<void> {
  await db().articleAI.update({
    where: { id: stubId },
    data: {
      rewriteAttempts: options.exhaust ? MAX_REWRITE_ATTEMPTS : attempts + 1,
      rewriteError: reason.slice(0, 500),
    },
  })
}
