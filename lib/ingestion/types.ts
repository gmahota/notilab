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
