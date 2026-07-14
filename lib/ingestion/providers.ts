/**
 * providers.ts — Fetch raw articles from GNews (primary) and NewsAPI (fallback).
 *
 * Each query is isolated: one provider failing does not abort the others.
 * Rate-limit note: 12 queries × 1 provider = 12 req/run. The sync-news cron
 * (vercel.json) runs every 30 min = 48 runs/day → 576 GNews req/day, ~5.75x a
 * 100-req/day free tier. Query count is not the lever here — cron cadence is.
 * Fix by dropping the cron to every 3h (8 runs/day × 12 = 96/day) or moving to
 * a paid GNews plan — see docs/editor/content-focus.md Addendum v1.1 § C.
 */

import type { RawArticle } from "./types"

const GNEWS_BASE   = "https://gnews.io/api/v4"
const NEWSAPI_BASE = "https://newsapi.org/v2"

// Topics covered on every sync run. Keep this list ≤ 10 for free-tier safety.
// Scope per docs/editor/content-focus.md: world football, Real Madrid, PT/EN/ES
// top-team backstage, Mozambique politics, South Africa xenophobia.
const SYNC_QUERIES: { q: string; lang: string }[] = [
  { q: "\"Real Madrid\"",                                                     lang: "en" },
  { q: "\"Real Madrid\" OR Barcelona OR \"Atletico Madrid\"",                 lang: "es" },
  { q: "\"Champions League\" OR \"World Cup\" OR FIFA OR UEFA",              lang: "en" },
  { q: "Benfica OR \"FC Porto\" OR \"Sporting CP\"",                          lang: "pt" },
  { q: "\"Premier League\" AND (Arsenal OR Liverpool OR Chelsea OR Tottenham OR Manchester)", lang: "en" },
  { q: "Moçambique AND (política OR governo OR eleições OR Frelimo OR Renamo)", lang: "pt" },
  { q: "Mozambique AND (politics OR government OR election)",                lang: "en" },
  { q: "xenophobia AND \"South Africa\"",                                    lang: "en" },
  { q: "xenofobia AND \"África do Sul\"",                                    lang: "pt" },
  { q: "(Netflix OR \"Prime Video\" OR \"Marvel Studios\") AND (movie OR series OR review OR trailer)", lang: "en" },
  { q: "(Netflix OR \"Prime Video\") AND (filme OR série OR estreia OR crítica)", lang: "pt" },
  { q: "dorama OR \"k-drama\" OR \"korean drama\"",                          lang: "en" },
]

// ─── GNews ────────────────────────────────────────────────────────────────────

async function fetchGNews(query: string, lang: string): Promise<RawArticle[]> {
  const apiKey = process.env.GNEWS_API_KEY
  if (!apiKey) return []

  const url =
    `${GNEWS_BASE}/search` +
    `?q=${encodeURIComponent(query)}` +
    `&lang=${lang}` +
    `&max=10` +
    `&apikey=${apiKey}`

  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`GNews ${res.status} for query "${query}": ${await res.text()}`)
  }

  const data = await res.json()
  return ((data.articles ?? []) as Record<string, unknown>[]).map((a) => ({
    title:       String(a.title ?? ""),
    content:     String(a.content ?? a.description ?? ""),
    description: String(a.description ?? ""),
    imageUrl:    (a.image as string) || null,
    sourceUrl:   String(a.url ?? ""),
    sourceName:  (a.source as Record<string, string>)?.name ?? "GNews",
    publishedAt: new Date(a.publishedAt as string),
    provider:    "gnews" as const,
  }))
}

// ─── NewsAPI ──────────────────────────────────────────────────────────────────

async function fetchNewsAPI(query: string, lang: string): Promise<RawArticle[]> {
  const apiKey = process.env.NEWSAPI_KEY
  if (!apiKey) return []

  const url =
    `${NEWSAPI_BASE}/everything` +
    `?q=${encodeURIComponent(query)}` +
    `&language=${lang}` +
    `&pageSize=10` +
    `&sortBy=publishedAt` +
    `&apiKey=${apiKey}`

  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`NewsAPI ${res.status} for query "${query}": ${await res.text()}`)
  }

  const data = await res.json()
  return ((data.articles ?? []) as Record<string, unknown>[]).map((a) => ({
    title:       String(a.title ?? ""),
    content:     String(a.content ?? a.description ?? ""),
    description: String(a.description ?? ""),
    imageUrl:    (a.urlToImage as string) || null,
    sourceUrl:   String(a.url ?? ""),
    sourceName:  (a.source as Record<string, string>)?.name ?? "NewsAPI",
    publishedAt: new Date(a.publishedAt as string),
    provider:    "newsapi" as const,
  }))
}

// ─── Public ───────────────────────────────────────────────────────────────────

/**
 * Fetches all SYNC_QUERIES using GNews first; falls back to NewsAPI per query.
 * Errors are appended to the shared `errors` array (not thrown) so the caller
 * continues processing whatever articles were successfully fetched.
 */
export async function fetchFromProviders(errors: string[]): Promise<RawArticle[]> {
  const results: RawArticle[] = []

  for (const { q, lang } of SYNC_QUERIES) {
    try {
      // Primary: GNews
      const gnewsArticles = await fetchGNews(q, lang)
      if (gnewsArticles.length > 0) {
        results.push(...gnewsArticles)
        continue
      }
      // Fallback: NewsAPI (only when GNews returns 0)
      const newsApiArticles = await fetchNewsAPI(q, lang)
      results.push(...newsApiArticles)
    } catch (primaryErr) {
      const msg = `GNews failed for "${q}": ${primaryErr instanceof Error ? primaryErr.message : String(primaryErr)}`
      console.warn("[providers]", msg)
      errors.push(msg)

      // Always attempt the fallback independently
      try {
        const fallback = await fetchNewsAPI(q, lang)
        results.push(...fallback)
      } catch (fallbackErr) {
        const fbMsg = `NewsAPI also failed for "${q}": ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`
        console.error("[providers]", fbMsg)
        errors.push(fbMsg)
      }
    }
  }

  return results
}
