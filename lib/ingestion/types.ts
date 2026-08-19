// ─── Raw (provider output) ────────────────────────────────────────────────────

export interface RawArticle {
  title: string
  content: string
  description: string
  imageUrl: string | null
  sourceUrl: string
  sourceName: string
  publishedAt: Date
  provider: "gnews" | "newsapi"
  /**
   * Terms from the query that fetched this article. The relevance gate needs
   * them: providers do full-text OR matching, so an article can come back for
   * merely mentioning a term in passing. Checking the terms against the title
   * and lead is what separates "about this" from "mentions this".
   */
  mustMatch: string[]
}

/**
 * One ingestion query.
 *
 * `q` is the provider's query string; `mustMatch` is the same intent expressed
 * as bare terms, because a provider query string cannot be re-used as a filter
 * (it carries OR/AND syntax and quoting).
 */
export interface SyncQuery {
  q: string
  lang: string
  mustMatch: string[]
}

// ─── Normalized (pipeline-internal) ──────────────────────────────────────────

export interface NormalizedArticle {
  title: string
  content: string
  summary: string
  imageUrl: string | null
  sourceUrl: string
  sourceName: string
  publishedAt: Date
  categorySlug: string
  tags: string[]
  importanceScore: number
  readTime: number
}

// ─── Pipeline result ──────────────────────────────────────────────────────────

export interface IngestionResult {
  fetched: number
  normalized: number
  skipped: number
  saved: number
  aiQueued: number
  errors: string[]
  durationMs: number
}
