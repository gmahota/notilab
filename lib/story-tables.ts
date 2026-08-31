/**
 * lib/story-tables.ts
 *
 * One question, asked in one place: has the `story_model` migration been applied
 * to this database?
 *
 * It exists because the NOW V2 code ships before the migration is necessarily
 * run — `lib/story-service.ts` falls back to `News`, and `lib/chat-service.ts`
 * falls back to a single-article lookup. Both need the answer, and both need it
 * without provoking a Prisma "table does not exist" error: caught or not, Prisma
 * logs those, and a recurring one in production reads as a broken database
 * rather than the expected pre-migration state.
 *
 * `to_regclass` returns NULL instead of raising for an unknown relation, so this
 * probe always succeeds.
 *
 * Delete this module once the migration is applied everywhere and the fallbacks
 * are removed.
 */

import { prisma } from "./prisma"

/** How long an answer is trusted, so a page of cards does not re-probe per call. */
const TTL_MS = 60_000

let cache: { present: boolean; at: number } | null = null

export async function storyTablesPresent(): Promise<boolean> {
  const cached = cache
  if (cached && Date.now() - cached.at < TTL_MS) return cached.present

  const rows = await prisma.$queryRaw<Array<{ present: boolean }>>`
    SELECT to_regclass('public.stories') IS NOT NULL AS present
  `
  const present = rows[0]?.present === true

  cache = { present, at: Date.now() }
  return present
}

/** Test/ops helper: drops the cached answer so the next call re-probes. */
export function resetStoryTablesProbe(): void {
  cache = null
}
