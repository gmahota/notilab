export interface AIMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface AIResponse {
  message: string
  suggestions?: string[]
  confidence?: number
}

export class AIService {
  private static instance: AIService

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService()
    }
    return AIService.instance
  }

  async generateResponse(
    message: string,
    context: AIMessage[] = [],
    options: {
      temperature?: number
      maxTokens?: number
      includeContext?: boolean
    } = {},
  ): Promise<AIResponse> {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          history: context,
          options,
        }),
      })

      if (!response.ok) {
        throw new Error(`AI service error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Error generating AI response:", error)
      throw new Error("Failed to generate AI response")
    }
  }

  async summarizeNews(newsIds: string[]): Promise<string> {
    try {
      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newsIds }),
      })

      if (!response.ok) {
        throw new Error("Failed to summarize news")
      }

      const data = await response.json()
      return data.summary
    } catch (error) {
      console.error("Error summarizing news:", error)
      throw new Error("Failed to summarize news")
    }
  }

  /**
   * Returns the stored explainer for an article at the requested level.
   *
   * Takes an article id, not a free-text topic: the endpoint now serves text the
   * enrichment pipeline already produced for a specific article, so there is
   * nothing to explain about a topic we hold no article on.
   */
  async explainArticle(
    articleId: string,
    complexity: "simple" | "child" | "expert" = "simple",
  ): Promise<string> {
    try {
      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ articleId, complexity }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload?.error || "Failed to explain article")
      }

      return payload.data.explanation
    } catch (error) {
      console.error("Error explaining article:", error)
      throw error instanceof Error ? error : new Error("Failed to explain article")
    }
  }

  async generatePersonalizedSummary(
    userId: string,
    preferences: {
      categories: string[]
      complexity: "simple" | "detailed"
      language: string
    },
  ): Promise<string> {
    try {
      const response = await fetch("/api/ai/personalized-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, preferences }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate personalized summary")
      }

      const data = await response.json()
      return data.summary
    } catch (error) {
      console.error("Error generating personalized summary:", error)
      throw new Error("Failed to generate personalized summary")
    }
  }

  async generateNews(params: {
    topic: string
    category: string
    style: string
    tone: string
    length: string
    targetAudience: string
    includeAnalysis: boolean
    includeSources: boolean
  }): Promise<{
    title: string
    summary: string
    content: string
    aiAnalysis: any
    suggestions: string[]
  }> {
    try {
      const response = await fetch("/api/ai/generate-news", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        throw new Error("Failed to generate news")
      }

      return await response.json()
    } catch (error) {
      console.error("Error generating news:", error)
      throw new Error("Failed to generate news")
    }
  }

  async researchTopic(
    topic: string,
    sources?: string[],
  ): Promise<{
    results: Array<{
      title: string
      source: string
      url: string
      summary: string
      relevance: number
      publishedAt: string
      category: string
    }>
    summary: string
  }> {
    try {
      const response = await fetch("/api/ai/research", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic, sources }),
      })

      if (!response.ok) {
        throw new Error("Failed to research topic")
      }

      return await response.json()
    } catch (error) {
      console.error("Error researching topic:", error)
      throw new Error("Failed to research topic")
    }
  }

  async getTrendingTopics(
    region = "PT",
    timeframe = "24h",
  ): Promise<
    Array<{
      keyword: string
      volume: number
      growth: string
      category: string
      sentiment: string
      related: string[]
    }>
  > {
    try {
      const response = await fetch(`/api/ai/trending?region=${region}&timeframe=${timeframe}`)

      if (!response.ok) {
        throw new Error("Failed to get trending topics")
      }

      const data = await response.json()
      return data.topics
    } catch (error) {
      console.error("Error getting trending topics:", error)
      throw new Error("Failed to get trending topics")
    }
  }
}

export const aiService = AIService.getInstance()
