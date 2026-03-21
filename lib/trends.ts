/**
 * NotiLab Google Trends Integration
 * 
 * Fetches trending topics. Falls back to mock data when API keys are not available.
 */

export interface TrendItem {
  keyword: string
  volume: number
  description: string
  category: string
  region: string
}

/**
 * Fetch trending topics from Google Trends (via SerpAPI or similar).
 * Falls back to curated mock data for MVP.
 */
export async function fetchTrendingTopics(
  region = "PT",
  limit = 10
): Promise<TrendItem[]> {
  const apiKey = process.env.SERPAPI_KEY

  if (apiKey) {
    try {
      const url = `https://serpapi.com/search.json?engine=google_trends_trending_now&geo=${region}&api_key=${apiKey}`
      const res = await fetch(url, { next: { revalidate: 1800 } }) // cache 30min
      if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`)
      const data = await res.json()
      
      return (data.trending_searches || []).slice(0, limit).map((t: Record<string, unknown>) => ({
        keyword: (t.query as string) || (t.title as string) || "",
        volume: Number(t.search_volume) || 0,
        description: (t.snippet as string) || "",
        category: "trending",
        region,
      }))
    } catch (error) {
      console.error("SerpAPI trending fetch failed:", error)
    }
  }

  // Fallback: curated trending topics
  return getMockTrending(region)
}

function getMockTrending(region: string): TrendItem[] {
  return [
    { keyword: "AI Regulation EU", volume: 2100000, description: "European Union finalizes comprehensive AI safety framework", category: "Technology", region },
    { keyword: "Climate Summit 2026", volume: 1800000, description: "World leaders meet to discuss accelerated climate action targets", category: "Politics", region },
    { keyword: "Quantum Computing", volume: 1200000, description: "Major breakthrough in quantum error correction announced", category: "Science", region },
    { keyword: "Champions League", volume: 980000, description: "Quarter-final results surprise football fans across Europe", category: "Sports", region },
    { keyword: "Digital Euro", volume: 870000, description: "ECB announces pilot program for digital currency rollout", category: "Economy", region },
    { keyword: "Space Tourism", volume: 750000, description: "Commercial space flights now available for civilians", category: "Science", region },
    { keyword: "Cybersecurity Alert", volume: 650000, description: "Critical vulnerabilities discovered in major platforms", category: "Technology", region },
    { keyword: "EV Battery Tech", volume: 520000, description: "Solid-state batteries achieve 1000km range milestone", category: "Technology", region },
    { keyword: "Remote Work Laws", volume: 480000, description: "New legislation protects remote workers' rights across EU", category: "Laws", region },
    { keyword: "World Cup 2026", volume: 3200000, description: "Host cities announced for the biggest tournament ever", category: "Sports", region },
  ]
}
