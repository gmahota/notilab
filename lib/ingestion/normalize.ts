/**
 * normalize.ts — Clean, validate, and enrich raw articles from providers.
 *
 * Drops any article that is:
 *   - missing title or sourceUrl
 *   - has an invalid publishedAt date
 *   - is a NewsAPI "[Removed]" placeholder
 */

import type { RawArticle, NormalizedArticle } from "./types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim()
}

/**
 * Recency-based importance score (0–100).
 * Used as an initial signal before AI re-scoring.
 */
function computeImportanceScore(publishedAt: Date): number {
  const ageHours = (Date.now() - publishedAt.getTime()) / 3_600_000
  if (ageHours < 1)    return 95
  if (ageHours < 6)    return 85
  if (ageHours < 24)   return 72
  if (ageHours < 72)   return 55
  if (ageHours < 168)  return 35
  return 15
}

/** Estimate read time in minutes at ~200 wpm. */
function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

const STOP_WORDS = new Set([
  "the", "a", "an", "in", "on", "at", "to", "for", "of", "and", "or",
  "but", "is", "are", "was", "were", "be", "been", "has", "have", "had",
  "will", "would", "could", "should", "its", "this", "that", "with", "from",
  "says", "said", "after", "about", "into", "over", "more", "also", "than",
])

/** Extract up to 4 keywords from the title plus the category slug as tags. */
function extractTags(title: string, categorySlug: string): string[] {
  const words = title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
  return [...new Set([...words.slice(0, 4), categorySlug])]
}

// ─── Category detection ───────────────────────────────────────────────────────

/** Maps keyword patterns to category slugs (matches Prisma seed data). */
const CATEGORY_RULES: [string, string[]][] = [
  ["desporto",   ["football", "soccer", "futebol", "champions league", "benfica",
                  "sporting", "porto", "nba", "tennis", "athlete", "goal", "rugby"]],
  ["politica",   ["president", "parliament", "government", "minister", "election",
                  "senate", "congress", "partido", "governo", "parlamento",
                  "presidente", "ministro", "eleição", "policy", "diplomacy"]],
  ["leis",       ["law", "court", "judge", "verdict", "lawsuit", "regulation",
                  "crime", "tribunal", "lei", "juiz", "legal", "justice",
                  "legislation", "constitution"]],
  ["economia",   ["economy", "inflation", "market", "stock", "gdp", "finance",
                  "bank", "recession", "trade", "mercado", "bolsa", "inflação",
                  "banco", "crypto", "bitcoin", "interest rate", "earnings"]],
  ["tecnologia", ["artificial intelligence", " ai ", "tech", "software", "startup",
                  "cyber", "robot", "quantum", "digital", "data", "cloud",
                  "openai", "google", "apple", "microsoft", "chip"]],
  ["ciencia",    ["science", "research", "study", "nasa", "space", "climate",
                  "health", "medicine", "vaccine", "biology", "physics", "energy"]],
  ["cultura",    ["cinema", "music", "art", "festival", "movie", "film",
                  "cultura", "arte", "música", "theatre", "award", "oscar"]],
]

export function detectCategorySlug(title: string, content: string): string {
  const text = ` ${title} ${content} `.toLowerCase()
  for (const [slug, keywords] of CATEGORY_RULES) {
    if (keywords.some((kw) => text.includes(kw))) return slug
  }
  return "general"
}

// ─── Public ───────────────────────────────────────────────────────────────────

/**
 * Transforms a batch of raw provider articles into normalized, validated articles
 * ready for deduplication and database insertion.
 */
export function normalizeArticles(raw: RawArticle[]): NormalizedArticle[] {
  const out: NormalizedArticle[] = []

  for (const a of raw) {
    // Required fields
    if (!a.title?.trim() || !a.sourceUrl?.trim()) continue
    if (isNaN(a.publishedAt?.getTime())) continue

    // NewsAPI deleted-article placeholders
    if (a.title === "[Removed]") continue
    if (a.sourceUrl === "https://removed.com") continue

    const title      = stripHtml(a.title).trim()
    const rawContent = stripHtml(a.content || a.description || "").trim()
    const content    = rawContent || title
    const summary    = stripHtml(a.description || "").trim() || content.substring(0, 200)

    const categorySlug = detectCategorySlug(title, content)

    out.push({
      title,
      content,
      summary,
      imageUrl:        a.imageUrl,
      sourceUrl:       a.sourceUrl.trim(),
      sourceName:      a.sourceName,
      publishedAt:     a.publishedAt,
      categorySlug,
      tags:            extractTags(title, categorySlug),
      importanceScore: computeImportanceScore(a.publishedAt),
      readTime:        estimateReadTime(content),
    })
  }

  return out
}
