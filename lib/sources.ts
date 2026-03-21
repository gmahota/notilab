/**
 * NotiLab News Sources
 * 
 * Manages fetching from GNews (primary), NewsAPI (fallback), and RSS feeds.
 * All external fetches run server-side only.
 */

export interface FetchedArticle {
  title: string
  content: string
  summary: string
  imageUrl: string | null
  sourceUrl: string
  sourceName: string
  publishedAt: Date
  category: string
}

const GNEWS_BASE = "https://gnews.io/api/v4"
const NEWSAPI_BASE = "https://newsapi.org/v2"

/**
 * Fetch news from GNews API.
 */
export async function fetchFromGNews(
  query: string,
  options: { lang?: string; country?: string; max?: number } = {}
): Promise<FetchedArticle[]> {
  const apiKey = process.env.GNEWS_API_KEY
  if (!apiKey) {
    console.warn("GNEWS_API_KEY not set, skipping GNews fetch")
    return []
  }

  const { lang = "pt", country = "pt", max = 10 } = options
  const url = `${GNEWS_BASE}/search?q=${encodeURIComponent(query)}&lang=${lang}&country=${country}&max=${max}&apikey=${apiKey}`

  try {
    const res = await fetch(url, { next: { revalidate: 900 } }) // cache 15min
    if (!res.ok) throw new Error(`GNews API error: ${res.status}`)
    const data = await res.json()

    return (data.articles || []).map((a: Record<string, unknown>) => ({
      title: a.title as string,
      content: (a.content as string) || (a.description as string) || "",
      summary: (a.description as string) || "",
      imageUrl: (a.image as string) || null,
      sourceUrl: a.url as string,
      sourceName: (a.source as Record<string, string>)?.name || "GNews",
      publishedAt: new Date(a.publishedAt as string),
      category: "general",
    }))
  } catch (error) {
    console.error("GNews fetch failed:", error)
    return []
  }
}

/**
 * Fetch news from NewsAPI (fallback).
 */
export async function fetchFromNewsAPI(
  query: string,
  options: { language?: string; pageSize?: number } = {}
): Promise<FetchedArticle[]> {
  const apiKey = process.env.NEWSAPI_KEY
  if (!apiKey) {
    console.warn("NEWSAPI_KEY not set, skipping NewsAPI fetch")
    return []
  }

  const { language = "pt", pageSize = 10 } = options
  const url = `${NEWSAPI_BASE}/everything?q=${encodeURIComponent(query)}&language=${language}&pageSize=${pageSize}&apiKey=${apiKey}`

  try {
    const res = await fetch(url, { next: { revalidate: 900 } })
    if (!res.ok) throw new Error(`NewsAPI error: ${res.status}`)
    const data = await res.json()

    return (data.articles || []).map((a: Record<string, unknown>) => ({
      title: a.title as string,
      content: (a.content as string) || (a.description as string) || "",
      summary: (a.description as string) || "",
      imageUrl: (a.urlToImage as string) || null,
      sourceUrl: a.url as string,
      sourceName: (a.source as Record<string, string>)?.name || "NewsAPI",
      publishedAt: new Date(a.publishedAt as string),
      category: "general",
    }))
  } catch (error) {
    console.error("NewsAPI fetch failed:", error)
    return []
  }
}

/**
 * Fetch news with automatic fallback: GNews → NewsAPI.
 */
export async function fetchNews(
  query: string,
  options: { max?: number } = {}
): Promise<FetchedArticle[]> {
  const results = await fetchFromGNews(query, { max: options.max })
  if (results.length > 0) return results

  // Fallback to NewsAPI
  return fetchFromNewsAPI(query, { pageSize: options.max })
}

/**
 * Deduplicate articles by title similarity (simple approach).
 */
export function deduplicateArticles(articles: FetchedArticle[]): FetchedArticle[] {
  const seen = new Set<string>()
  return articles.filter((article) => {
    // Normalize: lowercase, remove punctuation, trim
    const normalized = article.title.toLowerCase().replace(/[^\w\s]/g, "").trim()
    const key = normalized.substring(0, 60) // first 60 chars as key
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Auto-categorize based on keywords.
 */
export function categorizeArticle(title: string, content: string): string {
  const text = `${title} ${content}`.toLowerCase()

  const categoryKeywords: Record<string, string[]> = {
    politica: ["governo", "parlamento", "ministro", "eleição", "política", "presidente", "law", "legislation", "parliament", "government"],
    desporto: ["futebol", "liga", "champions", "benfica", "sporting", "porto", "goal", "match", "champion", "football", "soccer"],
    economia: ["mercado", "bolsa", "pib", "inflação", "banco", "economia", "market", "stock", "economy", "gdp", "finance"],
    cultura: ["cinema", "música", "arte", "festival", "cultura", "movie", "music", "art", "culture", "film"],
    leis: ["lei", "tribunal", "juiz", "crime", "regulamento", "court", "judge", "crime", "regulation", "legal"],
    tecnologia: ["ai", "inteligência artificial", "tech", "software", "startup", "digital", "cyber", "robot", "quantum"],
  }

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) return category
  }

  return "general"
}
