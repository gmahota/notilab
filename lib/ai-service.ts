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

  async explainTopic(topic: string, complexity: "simple" | "detailed" = "simple"): Promise<string> {
    try {
      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic, complexity }),
      })

      if (!response.ok) {
        throw new Error("Failed to explain topic")
      }

      const data = await response.json()
      return data.explanation
    } catch (error) {
      console.error("Error explaining topic:", error)
      throw new Error("Failed to explain topic")
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
}

export const aiService = AIService.getInstance()
