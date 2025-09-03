export interface SocialPlatform {
  id: string
  name: string
  connected: boolean
  subscribers: number
  features: string[]
}

export interface ShareOptions {
  title: string
  summary: string
  url: string
  category: string
  customMessage?: string
}

export interface NotificationOptions {
  type: "breaking" | "trending" | "personalized" | "digest"
  title: string
  message: string
  channels: string[]
  priority?: "low" | "medium" | "high"
}

export class SocialService {
  private static instance: SocialService

  static getInstance(): SocialService {
    if (!SocialService.instance) {
      SocialService.instance = new SocialService()
    }
    return SocialService.instance
  }

  async shareToSocial(platform: string, options: ShareOptions): Promise<boolean> {
    try {
      const response = await fetch("/api/social?action=share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform,
          content: options,
        }),
      })

      return response.ok
    } catch (error) {
      console.error("Error sharing to social:", error)
      return false
    }
  }

  async sendNotification(options: NotificationOptions): Promise<boolean> {
    try {
      const response = await fetch("/api/social?action=notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(options),
      })

      return response.ok
    } catch (error) {
      console.error("Error sending notification:", error)
      return false
    }
  }

  async getConnectedPlatforms(): Promise<SocialPlatform[]> {
    try {
      const response = await fetch("/api/social?action=integrations")
      if (!response.ok) {
        throw new Error("Failed to fetch integrations")
      }
      return await response.json()
    } catch (error) {
      console.error("Error fetching integrations:", error)
      return []
    }
  }

  async getSocialAnalytics(): Promise<any> {
    try {
      const response = await fetch("/api/social?action=analytics")
      if (!response.ok) {
        throw new Error("Failed to fetch analytics")
      }
      return await response.json()
    } catch (error) {
      console.error("Error fetching analytics:", error)
      return null
    }
  }

  async connectPlatform(platform: string, credentials: any): Promise<boolean> {
    try {
      const response = await fetch(`/api/social/connect/${platform}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      })

      return response.ok
    } catch (error) {
      console.error("Error connecting platform:", error)
      return false
    }
  }

  async disconnectPlatform(platform: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/social/disconnect/${platform}`, {
        method: "POST",
      })

      return response.ok
    } catch (error) {
      console.error("Error disconnecting platform:", error)
      return false
    }
  }

  // WhatsApp specific methods
  async sendWhatsAppMessage(message: string, recipients?: string[]): Promise<boolean> {
    return this.shareToSocial("whatsapp", {
      title: "",
      summary: message,
      url: "",
      category: "",
    })
  }

  // Telegram specific methods
  async sendTelegramMessage(message: string, chatId?: string): Promise<boolean> {
    return this.shareToSocial("telegram", {
      title: "",
      summary: message,
      url: "",
      category: "",
    })
  }

  // Twitter specific methods
  async postTweet(content: string, mediaUrls?: string[]): Promise<boolean> {
    return this.shareToSocial("twitter", {
      title: "",
      summary: content,
      url: "",
      category: "",
    })
  }

  // Utility methods
  generateShareMessage(options: ShareOptions): string {
    const { title, summary, category, customMessage } = options

    if (customMessage) {
      return customMessage
    }

    return `📰 ${title}\n\n${summary}\n\n#NotiLab #${category}`
  }

  generateHashtags(category: string, trending?: string[]): string[] {
    const baseHashtags = ["NotiLab", category]

    if (trending) {
      return [...baseHashtags, ...trending.slice(0, 3)]
    }

    return baseHashtags
  }
}

export const socialService = SocialService.getInstance()
