import { AIEnrichmentResult } from "./types"

const VALID_SENTIMENTS = new Set(["positive", "neutral", "negative"])

/**
 * Parses the raw JSON string returned by the AI provider.
 * Returns null if the output is missing required fields or is unparseable.
 */
export function parseAIOutput(raw: string): AIEnrichmentResult | null {
  let parsed: Record<string, unknown>

  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : ""
  const tldr = typeof parsed.tldr === "string" ? parsed.tldr.trim() : ""
  const whyItMatters = typeof parsed.whyItMatters === "string" ? parsed.whyItMatters.trim() : ""
  const explainLikeIm10 =
    typeof parsed.explainLikeIm10 === "string" ? parsed.explainLikeIm10.trim() : ""
  const rawSentiment = typeof parsed.sentiment === "string" ? parsed.sentiment.toLowerCase() : ""
  const sentiment: AIEnrichmentResult["sentiment"] = VALID_SENTIMENTS.has(rawSentiment)
    ? (rawSentiment as AIEnrichmentResult["sentiment"])
    : "neutral"

  const importanceScore = clampInt(parsed.importanceScore, 0, 100, 50)
  const readTime = clampInt(parsed.readTime, 1, 60, 3)

  // Require at minimum a summary and tldr
  if (!summary || !tldr) return null

  return {
    summary,
    tldr,
    whyItMatters: whyItMatters || tldr,
    explainLikeIm10: explainLikeIm10 || summary,
    sentiment,
    importanceScore,
    readTime,
  }
}

function clampInt(
  raw: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}
