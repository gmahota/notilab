/**
 * lib/growth/streak.ts
 *
 * Daily reading streak engine.
 *
 * Rules:
 *   - A streak counts when a user reads ≥1 article (or sends ≥1 chat message) per day
 *   - "Day" is measured in UTC midnight boundaries
 *   - 1-day grace period: if a user misses a day, streak is frozen for 24h
 *     before breaking (gives mobile users in different timezones a fair window)
 *   - Longest streak is never decremented
 *   - totalDaysActive always increments (counts unique active days)
 */

import { prisma } from "../prisma"
import { trackEvent } from "./events"

// ---------------------------------------------------------------------------
// PrismaExt
// ---------------------------------------------------------------------------

type StreakRow = {
  id: string
  userId: string
  currentStreak: number
  longestStreak: number
  lastActiveDate: Date | null
  streakFrozenUntil: Date | null
  totalDaysActive: number
}

type PrismaExt = typeof prisma & {
  userStreak: {
    findUnique: (a: Record<string, unknown>) => Promise<StreakRow | null>
    upsert: (a: Record<string, unknown>) => Promise<StreakRow>
    update: (a: { where: { userId: string }; data: Record<string, unknown> }) => Promise<StreakRow>
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function utcMidnight(date = new Date()): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function daysDiff(a: Date, b: Date): number {
  return Math.round(
    (utcMidnight(b).getTime() - utcMidnight(a).getTime()) / 86_400_000,
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface StreakState {
  currentStreak: number
  longestStreak: number
  totalDaysActive: number
  lastActiveDate: Date | null
  /** true if the streak was extended by this call */
  extended: boolean
}

/**
 * Records daily activity for a user. Idempotent within the same UTC day.
 * Returns the updated streak state + whether it was extended.
 */
export async function recordActivity(userId: string): Promise<StreakState> {
  const db = prisma as unknown as PrismaExt
  const today = utcMidnight()

  const existing = await db.userStreak.findUnique({ where: { userId } })

  if (!existing) {
    // First ever activity
    const created = await db.userStreak.upsert({
      where: { userId },
      create: {
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today,
        totalDaysActive: 1,
      },
      update: {},
    })
    await trackEvent({ event: "streak_completed", userId, meta: { streak: 1 } })
    return { ...toState(created), extended: true }
  }

  const lastDate = existing.lastActiveDate

  // Already recorded today — idempotent
  if (lastDate && daysDiff(lastDate, today) === 0) {
    return { ...toState(existing), extended: false }
  }

  const diff = lastDate ? daysDiff(lastDate, today) : null
  const now = new Date()

  let newStreak: number
  let extended = false

  if (diff === null || diff > 2) {
    // No history or gap > grace period: streak resets
    newStreak = 1
  } else if (diff === 1) {
    // Consecutive day: extend streak
    newStreak = existing.currentStreak + 1
    extended = true
  } else if (diff === 2 && existing.streakFrozenUntil && now <= existing.streakFrozenUntil) {
    // Within grace period (frozen): extend streak
    newStreak = existing.currentStreak + 1
    extended = true
  } else {
    // Missed day, grace expired: reset
    newStreak = 1
  }

  const newLongest = Math.max(newStreak, existing.longestStreak)

  // Grace period: set freeze window for tomorrow so users have until midnight+24h
  const freezeUntil = new Date(today.getTime() + 2 * 86_400_000)

  const updated = await db.userStreak.update({
    where: { userId },
    data: {
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActiveDate: today,
      streakFrozenUntil: freezeUntil,
      totalDaysActive: existing.totalDaysActive + 1,
    },
  })

  if (extended) {
    await trackEvent({
      event: "streak_completed",
      userId,
      meta: { streak: newStreak, longest: newLongest },
    })
  }

  return { ...toState(updated), extended }
}

/**
 * Returns the current streak state without modifying it.
 * Returns null if the user has no streak record.
 */
export async function getStreakState(userId: string): Promise<StreakState | null> {
  const db = prisma as unknown as PrismaExt
  const row = await db.userStreak.findUnique({ where: { userId } })
  if (!row) return null
  return { ...toState(row), extended: false }
}

function toState(row: StreakRow): Omit<StreakState, "extended"> {
  return {
    currentStreak: row.currentStreak,
    longestStreak: row.longestStreak,
    totalDaysActive: row.totalDaysActive,
    lastActiveDate: row.lastActiveDate,
  }
}
