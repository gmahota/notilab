import { AIEnrichmentResult } from "./types"

/**
 * Generates a heuristic enrichment result when the AI call fails.
 * Uses the article's existing summary or the first sentences of content.
 */
export function generateFallback(
  title: string,
  content: string | null,
  existingSummary: string | null,
): AIEnrichmentResult {
  const source = existingSummary ?? content ?? title
  const summary = extractFirstSentences(source, 2) || title
  const wordCount = source.split(/\s+/).filter(Boolean).length
  const readTime = Math.max(1, Math.round(wordCount / 200))

  return {
    summary,
    tldr: summary,
    whyItMatters: "This story may be relevant to current events.",
    explainLikeIm10: summary,
    sentiment: "neutral",
    importanceScore: 50,
    readTime,
  }
}

function extractFirstSentences(text: string, count: number): string {
  const sentences = text
    .replace(/<[^>]+>/g, " ") // strip HTML tags
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)

  return sentences.slice(0, count).join(" ")
}
