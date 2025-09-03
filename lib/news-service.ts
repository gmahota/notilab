export interface NewsArticle {
  id: string
  title: string
  summary: string
  content: string
  imageUrl: string
  sourceUrl: string
  sourceName: string
  publishedAt: Date
  category: {
    name: string
    slug: string
    color: string
  }
  tags: string[]
  trending: boolean
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"
  aiSummary: string
  sentiment: string
  readTime: number
  reactions: Array<{
    type: "LIKE" | "LOVE" | "LAUGH" | "ANGRY" | "SAD" | "SHARE"
    count: number
  }>
  views: number
  author: string
}

export interface NewsFilters {
  category?: string
  sortBy?: "recent" | "popular" | "views" | "trending"
  search?: string
  limit?: number
  offset?: number
}

export class NewsService {
  private static instance: NewsService

  static getInstance(): NewsService {
    if (!NewsService.instance) {
      NewsService.instance = new NewsService()
    }
    return NewsService.instance
  }

  async getNews(filters: NewsFilters = {}): Promise<NewsArticle[]> {
    // TODO: Replace with actual API call
    const params = new URLSearchParams()

    if (filters.category && filters.category !== "all") {
      params.append("category", filters.category)
    }
    if (filters.sortBy) {
      params.append("sortBy", filters.sortBy)
    }
    if (filters.search) {
      params.append("search", filters.search)
    }
    if (filters.limit) {
      params.append("limit", filters.limit.toString())
    }
    if (filters.offset) {
      params.append("offset", filters.offset.toString())
    }

    try {
      const response = await fetch(`/api/news?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Failed to fetch news")
      }
      return await response.json()
    } catch (error) {
      console.error("Error fetching news:", error)
      return []
    }
  }

  async getNewsById(id: string): Promise<NewsArticle | null> {
    try {
      const response = await fetch(`/api/news/${id}`)
      if (!response.ok) {
        throw new Error("Failed to fetch news article")
      }
      return await response.json()
    } catch (error) {
      console.error("Error fetching news article:", error)
      return null
    }
  }

  async getTrendingTopics(): Promise<
    Array<{
      keyword: string
      volume: string
      category: string
    }>
  > {
    try {
      const response = await fetch("/api/trending")
      if (!response.ok) {
        throw new Error("Failed to fetch trending topics")
      }
      return await response.json()
    } catch (error) {
      console.error("Error fetching trending topics:", error)
      return []
    }
  }

  async reactToNews(newsId: string, reactionType: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/news/${newsId}/react`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: reactionType }),
      })
      return response.ok
    } catch (error) {
      console.error("Error reacting to news:", error)
      return false
    }
  }
}

export const newsService = NewsService.getInstance()
