/**
 * lib/story-view.ts
 *
 * The read model for NOW V2. One shape, two possible origins:
 *
 *   - the `Story` tables, once clustering (or `scripts/backfill-stories.ts`)
 *     has populated them;
 *   - `News` + `ArticleAI`, derived on the fly, for as long as they have not.
 *
 * `lib/story-service.ts` owns that choice. Everything above it — API routes,
 * pages, components — only ever sees these types, so the UI does not change
 * when clustering lands.
 *
 * Dates are ISO strings, not `Date`: these objects cross the server/client
 * boundary as JSON, and a `Date` field would lie about what arrives.
 */

/** Spec § 17. `null` means we have no basis for a status claim — see below. */
export type StoryStatusView = "developing" | "confirmed" | "updated" | "closed"

export type StorySourceKind = "news" | "official" | "document" | "social"

export type StoryMediaKind = "image" | "video" | "map" | "chart"

/** Spec § 16. Short enough to read at a glance: "58M / acres / potentially affected". */
export interface StoryKeyFactView {
  value: string
  label: string
  context: string | null
}

/** Spec § 15. One outlet's account of the event. */
export interface StorySourceView {
  id: string
  publisher: string
  url: string
  headline: string
  publishedAt: string
  sourceType: StorySourceKind
  /** 0–100. Null when the publisher is not in our source registry. */
  reliabilityScore: number | null
}

export interface StoryMediaView {
  url: string
  type: StoryMediaKind
  credit: string | null
}

export interface StoryTopicView {
  name: string
  slug: string
  color: string
}

/**
 * What one card in the vertical feed needs, and nothing more (spec § 4).
 * Anything not on this list does not belong on a NOW card.
 */
export interface NowStory {
  id: string
  slug: string

  headline: string
  /** 1–2 sentences, ~180 chars. */
  whatHappened: string
  /** Consequence, never a restatement of the headline. Null when not enriched. */
  whyItMatters: string | null

  topic: StoryTopicView
  /** Null when the event has no meaningful place — the UI omits the field. */
  location: string | null

  /**
   * Null when we cannot honestly claim a status: a single-source story that has
   * never been updated has not been assessed, and showing "DEVELOPING" on it
   * would be a fabricated signal. See `lib/story-service.ts`.
   */
  status: StoryStatusView | null

  publishedAt: string
  updatedAt: string
  /** True when `updatedAt` is meaningfully later than `publishedAt` (spec § 21). */
  wasUpdated: boolean

  media: StoryMediaView | null

  sourceCount: number
  /** Up to three publisher names, for the "Reuters · AP · BBC" line. */
  sourceNames: string[]

  /**
   * Spec § 32 — a deliberately high bar, not a synonym for "recent".
   * Set by the service, never by a component.
   */
  breaking: boolean

  /** 0–100. Exposed for ordering and debugging; never rendered as a number. */
  importanceScore: number
}

/**
 * The 30-second Brief (spec § 10). Superset of the card: same fields plus the
 * ones that only make sense once the user has committed to reading.
 *
 * `timeline` is deliberately absent — it belongs to DEEP (spec § 22).
 */
export interface StoryBrief extends NowStory {
  /**
   * The Brief's "what happened" — 2–3 short paragraphs, newline-separated.
   * Null when we only hold the card-length summary.
   */
  narrative: string | null
  keyFacts: StoryKeyFactView[]
  context: string | null
  whatsNext: string | null
  sources: StorySourceView[]
  topics: string[]
}

export interface NowFeedPage {
  stories: NowStory[]
  offset: number
  hasMore: boolean
}

/** Spec § 6. `following` is present but not served yet. */
export type FeedLane = "for-you" | "world" | "following"

export const FEED_LANES: readonly FeedLane[] = ["for-you", "world", "following"] as const

export function isFeedLane(value: unknown): value is FeedLane {
  return typeof value === "string" && (FEED_LANES as readonly string[]).includes(value)
}

/**
 * Share text for a story (spec § 29). Kept here so the card, the Brief and the
 * OpenGraph description cannot drift apart.
 */
export function storyShareText(story: NowStory): string {
  const lines = [story.headline]
  if (story.whyItMatters) lines.push("", `Why it matters: ${story.whyItMatters}`)
  return lines.join("\n")
}
