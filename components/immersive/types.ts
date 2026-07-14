/**
 * Shared shapes for the /now immersive feed. Mirrors exactly what
 * GET /api/news/feed and GET /api/news/[id] already return — do not add
 * fields here that the backend doesn't send.
 */

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT"

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
  priority: Priority
  sentiment: string
  readTime: number
  /** Only present when the item came from the ranked feed endpoint. */
  rankScore?: number
  stats: FeedStats
}

export interface RelatedStory {
  id: string
  title: string
  slug: string
  imageUrl: string
  publishedAt: string
  category: { slug: string }
}

/** GET /api/news/[id] response */
export interface ArticleDetail extends Omit<FeedArticle, "rankScore"> {
  content: string
  source: { name: string; priority: string } | null
  relatedStories: RelatedStory[]
}
