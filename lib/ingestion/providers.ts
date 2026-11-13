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

// Topics covered on every sync run. Keep this list <= 10 for free-tier safety.
//
// Scope (maintainer decision, 2026-11-12): US celebrities, club football in the
// English, Portuguese, Spanish and Italian top flights plus PSG, and financial
// markets. Politics is out by explicit instruction — the Hormuz, Ukraine/Russia,
// Trump, Macron and Moçambique queries that used to occupy six of these ten
// slots were removed, not merely reordered.
//
// `mustMatch` is the relevance gate (lib/ingestion/quality.ts): at least one of
// these terms must appear in the article's title or lead, not merely somewhere
// in the body. Without it, "World Cup" in an OR query matched an NFL blog's
// link roundup and a crypto fan-token piece. Terms are matched accent-blind and
// as substrings, so a short word like "inter" is spelled out ("inter milan") to
// keep it from matching "international".
const SYNC_QUERIES: SyncQuery[] = [
  // ── US celebrities ────────────────────────────────────────────────────────
  {
    q: "\"Taylor Swift\" OR Beyoncé OR Rihanna OR \"Kim Kardashian\" OR \"Dwayne Johnson\" OR Zendaya",
    lang: "en",
    mustMatch: ["taylor swift", "beyonce", "rihanna", "kardashian", "dwayne johnson", "zendaya"],
  },
  {
    q: "(\"Selena Gomez\" OR \"Ariana Grande\" OR \"Travis Kelce\" OR \"Jennifer Lopez\" OR \"Timothée Chalamet\" OR \"Kylie Jenner\") AND (Hollywood OR music OR film OR tour OR \"red carpet\")",
    lang: "en",
    mustMatch: ["selena gomez", "ariana grande", "travis kelce", "jennifer lopez", "timothee chalamet", "kylie jenner"],
  },
  // ── Club football ─────────────────────────────────────────────────────────
  {
    q: "\"Premier League\" AND (Arsenal OR Liverpool OR Chelsea OR Tottenham OR \"Manchester City\" OR \"Manchester United\")",
    lang: "en",
    mustMatch: ["premier league", "arsenal", "liverpool", "chelsea", "tottenham", "manchester city", "manchester united"],
  },
  {
    q: "Benfica OR \"FC Porto\" OR \"Sporting CP\"",
    lang: "pt",
    mustMatch: ["benfica", "porto", "sporting"],
  },
  {
    q: "\"Real Madrid\" OR Barcelona OR \"Atlético Madrid\"",
    lang: "es",
    mustMatch: ["real madrid", "barcelona", "atletico"],
  },
  {
    q: "\"Serie A\" AND (Juventus OR Inter OR Milan OR Napoli OR Roma OR Lazio)",
    lang: "it",
    mustMatch: ["serie a", "juventus", "napoli", "milan", "lazio", "inter milan", "internazionale", "as roma"],
  },
  {
    q: "\"Paris Saint-Germain\" OR PSG OR \"Ligue 1\"",
    lang: "fr",
    mustMatch: ["paris saint-germain", "psg", "ligue 1"],
  },
  {
    q: "\"Champions League\" OR \"Europa League\" OR UEFA",
    lang: "en",
    mustMatch: ["champions league", "europa league", "uefa"],
  },
  // ── Financial markets ─────────────────────────────────────────────────────
  {
    q: "(\"Wall Street\" OR \"S&P 500\" OR Nasdaq OR \"Dow Jones\" OR \"Federal Reserve\") AND (stocks OR markets OR earnings OR rates)",
    lang: "en",
    mustMatch: ["wall street", "s&p 500", "nasdaq", "dow jones", "federal reserve", "stock market", "stocks"],
  },
  {
    q: "(bolsa OR mercados OR juros OR inflação OR Euronext) AND (ações OR investidores OR BCE OR economia)",
    lang: "pt",
    mustMatch: ["bolsa", "mercados", "juros", "inflacao", "euronext", "bce"],
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
