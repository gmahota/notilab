export interface AIEnrichmentResult {
  summary: string
  tldr: string
  whyItMatters: string
  explainLikeIm10: string
  sentiment: "positive" | "neutral" | "negative"
  importanceScore: number // 0–100
  readTime: number // minutes (integer)
}

export interface ArticleAIStub {
  id: string
  articleId: string
  attempts: number
  article: {
    id: string
    title: string
    content: string | null
    summary: string | null
    sourceName: string | null
  }
}

export interface ProcessorResult {
  total: number
  succeeded: number
  failed: number
  skipped: number
  errors: Array<{ articleId: string; reason: string }>
}
