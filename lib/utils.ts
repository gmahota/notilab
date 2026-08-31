import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Compact relative-time label in Portuguese (e.g. "agora", "5min", "3h", "2d").
 * Falls back to "-" for invalid dates.
 */
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  const ms = Date.now() - d.getTime()
  if (Number.isNaN(ms)) return "-"

  const sec = Math.floor(ms / 1000)
  if (sec < 45) return "agora"

  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}min`

  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`

  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`

  const week = Math.floor(day / 7)
  if (week < 4) return `${week}sem`

  const month = Math.floor(day / 30)
  if (month < 12) return `${month}mês`

  const year = Math.floor(day / 365)
  return `${year}a`
}

const SESSION_STORAGE_KEY = "notilab:anon-session-id"

/**
 * Stable per-browser anonymous id for growth event attribution.
 * Client-side only — returns undefined during SSR.
 */
export function getAnonSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (existing) return existing
    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(SESSION_STORAGE_KEY, generated)
    return generated
  } catch {
    // localStorage unavailable (private mode, quota, etc.)
    return undefined
  }
}

export type GrowthTrackableEvent = "article_saved" | "article_shared" | "article_reacted"

/**
 * NOW V2 feed events (spec § 35). Separate from `GrowthTrackableEvent` because
 * they are attributed to a Story, not an article — see `trackStoryEvent`.
 */
export type StoryTrackableEvent =
  | "story_impression"
  | "story_open"
  | "story_skip"
  | "story_read_30s"
  | "story_source_open"
  | "story_save"
  | "story_share"
  | "story_ask_ai"
  | "story_next"
  | "story_previous"

/**
 * Fire-and-forget POST to /api/growth/events. Never throws — safe to call
 * from event handlers without awaiting. Anonymous (no userId) is supported
 * by the endpoint, so sessionId is the only identifier sent from here.
 */
export function trackGrowthEvent(
  event: GrowthTrackableEvent,
  articleId?: string,
  meta?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return
  try {
    fetch("/api/growth/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, articleId, sessionId: getAnonSessionId(), meta }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignore — tracking must never break the UI
  }
}

/**
 * Fire-and-forget POST of a NOW V2 story event. Never throws.
 *
 * Sends `storyId` rather than `articleId`: a Story can span several source
 * articles, so attributing the event to one of them would misreport what the
 * user actually saw.
 */
export function trackStoryEvent(
  event: StoryTrackableEvent,
  storyId: string,
  meta?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return
  try {
    fetch("/api/growth/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, storyId, sessionId: getAnonSessionId(), meta }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignore — tracking must never break the UI
  }
}
