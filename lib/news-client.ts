/**
 * lib/news-client.ts
 *
 * Browser-side client for the public news endpoints. Keeping the request and
 * response shapes in one place stops the home page, /feed and /trending from
 * drifting apart — they previously each rendered their own hardcoded arrays.
 *
 * Mirrors exactly what GET /api/news/feed and GET /api/news/trending return —
 * do not add fields here that the backend doesn't send.
 *
 * Note: components/immersive/types.ts declares the same /api/news/feed shape
 * for the /now redesign. Worth consolidating onto this module once that work
 * lands, rather than maintaining two copies of the contract.
 */

export interface FeedCategory {
  name: string
  slug: string
  color: string
}

export interface FeedStats {
  reactions: number
  reads: number
  saves: number
}

/** One item from GET /api/news/feed */
export interface FeedArticle {
  id: string
  title: string
  slug: string
  summary: string
  tldr: string | null
  whyItMatters: string | null
  imageUrl: string
  sourceUrl: string
  sourceName: string
  publishedAt: string
  category: FeedCategory
  tags: string[]
  trending: boolean
  priority: string
  sentiment: string
  readTime: number
  /** Composite ranking score — only the ranked feed endpoint sends this. */
  rankScore?: number
  stats: FeedStats
}

export interface FeedPage {
  articles: FeedArticle[]
  total: number
  offset: number
  hasMore: boolean
}

/** One item from GET /api/news/trending (`topics[]`) */
export interface TrendingTopic {
  keyword: string
  volume: number
  description?: string
  category: string
  region?: string
}

/**
 * What a topic's `volume` counts. Trending is derived from our own articles, so
 * the number is reader engagement — or article mentions before there is any
 * reader signal. Callers must label it accordingly instead of assuming
 * "searches".
 */
export type TrendMode = "engagement" | "coverage"

export interface TrendingResult {
  mode: TrendMode
  topics: TrendingTopic[]
}

/** Human label for what `volume` counts, for use next to the number. */
export function trendVolumeLabel(mode: TrendMode, volume: number): string {
  if (mode === "engagement") return volume === 1 ? "interaction" : "interactions"
  return volume === 1 ? "story" : "stories"
}

export interface FeedQuery {
  limit?: number
  offset?: number
  /** Category slug; omit or pass "all" for everything. */
  category?: string
  search?: string
  userId?: string
  signal?: AbortSignal
}

/**
 * Fetches one page of the ranked feed. Throws on a non-2xx response so callers
 * can show an error state instead of silently rendering an empty feed — an
 * empty feed and a broken feed look identical to the user otherwise.
 */
export async function fetchFeedPage({
  limit = 20,
  offset = 0,
  category,
  search,
  userId,
  signal,
}: FeedQuery = {}): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (category && category !== "all") params.set("category", category)
  if (search) params.set("search", search)
  if (userId) params.set("userId", userId)

  const res = await fetch(`/api/news/feed?${params.toString()}`, { signal })
  if (!res.ok) throw new Error(`Feed request failed: ${res.status}`)
  return res.json()
}

/**
 * Fetches trending search topics. Returns `topics` unwrapped.
 */
export async function fetchTrendingTopics(
  { limit = 10, region, signal }: { limit?: number; region?: string; signal?: AbortSignal } = {},
): Promise<TrendingResult> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (region) params.set("region", region)

  const res = await fetch(`/api/news/trending?${params.toString()}`, { signal })
  if (!res.ok) throw new Error(`Trending request failed: ${res.status}`)
  const data = await res.json()

  return {
    mode: data.mode === "engagement" ? "engagement" : "coverage",
    topics: Array.isArray(data.topics) ? data.topics : [],
  }
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/** 2_100_000 → "2.1M", 980_000 → "980K" */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "0"
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return String(value)
}

/** ISO timestamp → "Just now" / "4h ago" / "3d ago" */
export function formatTimeAgo(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const diffH = Math.floor((Date.now() - date.getTime()) / 3_600_000)
  if (diffH < 1) return "Just now"
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.floor(diffH / 24)}d ago`
}
