/**
 * providers.ts — Fetch raw articles from GNews (primary) and NewsAPI (fallback).
 *
 * Each query is isolated: one provider failing does not abort the others.
 *
 * Rate-limit note: 10 queries × 1 provider = 10 req/run, and the sync-news cron
 * (vercel.json) fires once a day at 20:00 UTC → 10 GNews req/day, inside the
 * 100-req/day free tier. The cadence is what keeps this in budget, not the query
 * count, so a sub-daily schedule needs a paid GNews plan — 48 runs/day (the old
 * every-30-minutes schedule) worked out to 480 req/day, ~4.8x the tier. Note
 * that the Hobby plan rejects sub-daily cron expressions at deploy time; see
 * DEPLOYMENT.md § "Cadências e o limite do plano Hobby" and
 * docs/editor/content-focus.md Addendum v1.1 § C.
 *
 * Keep SYNC_QUERIES ≤ 10 so one run stays under the daily tier on its own.
 */

import type { RawArticle, SyncQuery } from "./types"

const GNEWS_BASE   = "https://gnews.io/api/v4"

/** Gap between provider requests, to stay under GNews's burst limit. */
const QUERY_DELAY_MS = 1_200

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const NEWSAPI_BASE = "https://newsapi.org/v2"

// Topics covered on every sync run. Keep this list ≤ 10 for free-tier safety.
//
// Scope: world politics and world football. Entertainment queries (Netflix,
// Prime Video, doramas) were removed — they were the widest, least specific
// queries and pulled in the worst noise, including a scene-release listing.
//
// `mustMatch` is the relevance gate (lib/ingestion/quality.ts): at least one of
// these terms must appear in the article's title or lead, not merely somewhere
// in the body. Without it, "World Cup" in an OR query matched an NFL blog's
// link roundup and a crypto fan-token piece.
const SYNC_QUERIES: SyncQuery[] = [
  // ── World politics ────────────────────────────────────────────────────────
  {
    q: "(\"Strait of Hormuz\" OR Hormuz) AND (Iran OR shipping OR oil OR navy)",
    lang: "en",
    mustMatch: ["hormuz"],
  },
  {
    q: "(Ukraine OR Russia) AND (war OR ceasefire OR offensive OR \"peace talks\" OR strike)",
    lang: "en",
    mustMatch: ["ukraine", "russia", "russian", "ukrainian", "zelensky", "putin"],
  },
  {
    q: "(Ucrânia OR Rússia) AND (guerra OR tréguas OR negociações OR ataque)",
    lang: "pt",
    mustMatch: ["ucrania", "russia", "zelensky", "putin"],
  },
  {
    q: "Trump AND (\"White House\" OR administration OR tariffs OR \"executive order\" OR Congress)",
    lang: "en",
    mustMatch: ["trump"],
  },
  {
    q: "Macron AND (France OR government OR Elysee OR parliament)",
    lang: "en",
    mustMatch: ["macron"],
  },
  {
    q: "Moçambique AND (política OR governo OR eleições OR Frelimo OR Renamo)",
    lang: "pt",
    mustMatch: ["mocambique", "frelimo", "renamo", "maputo"],
  },
  // ── World football ────────────────────────────────────────────────────────
  {
    q: "\"Real Madrid\" OR Barcelona OR \"Atletico Madrid\"",
    lang: "es",
    mustMatch: ["real madrid", "barcelona", "atletico"],
  },
  {
    q: "\"Champions League\" OR \"World Cup\" OR UEFA OR FIFA",
    lang: "en",
    mustMatch: ["champions league", "world cup", "uefa", "fifa"],
  },
  {
    q: "Benfica OR \"FC Porto\" OR \"Sporting CP\"",
    lang: "pt",
    mustMatch: ["benfica", "porto", "sporting"],
  },
  {
    q: "\"Premier League\" AND (Arsenal OR Liverpool OR Chelsea OR Tottenham OR Manchester)",
    lang: "en",
    mustMatch: ["premier league", "arsenal", "liverpool", "chelsea", "tottenham", "manchester"],
  },
]

// ─── GNews ────────────────────────────────────────────────────────────────────

async function fetchGNews({ q: query, lang, mustMatch }: SyncQuery): Promise<RawArticle[]> {
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
    mustMatch,
  }))
}

// ─── NewsAPI ──────────────────────────────────────────────────────────────────

async function fetchNewsAPI({ q: query, lang, mustMatch }: SyncQuery): Promise<RawArticle[]> {
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
    mustMatch,
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
  let first = true

  for (const query of SYNC_QUERIES) {
    // GNews rate-limits bursts, not just daily volume: firing all queries
    // back to back returned 429 for 6 of 10. Space them out.
    if (!first) await sleep(QUERY_DELAY_MS)
    first = false

    try {
      // Primary: GNews
      const gnewsArticles = await fetchGNews(query)
      if (gnewsArticles.length > 0) {
        results.push(...gnewsArticles)
        continue
      }
      // Fallback: NewsAPI (only when GNews returns 0)
      const newsApiArticles = await fetchNewsAPI(query)
      results.push(...newsApiArticles)
    } catch (primaryErr) {
      const msg = `GNews failed for "${query.q}": ${primaryErr instanceof Error ? primaryErr.message : String(primaryErr)}`
      console.warn("[providers]", msg)
      errors.push(msg)

      // Always attempt the fallback independently
      try {
        const fallback = await fetchNewsAPI(query)
        results.push(...fallback)
      } catch (fallbackErr) {
        const fbMsg = `NewsAPI also failed for "${query.q}": ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`
        console.error("[providers]", fbMsg)
        errors.push(fbMsg)
      }
    }
  }

  return results
}
