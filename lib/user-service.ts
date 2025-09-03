export interface UserProfile {
  id: string
  name: string
  email: string
  avatar?: string
  type: "JOVEM" | "EXECUTIVO" | "ESTUDANTE" | "SENIOR"
  interests: string[]
  language: string
  timezone: string
}

export interface UserPreferences {
  dailyDigest: boolean
  pushNotifications: boolean
  emailAlerts: boolean
  categories: string[]
}

export interface UserStats {
  totalArticlesRead: number
  totalTimeSpent: number
  favoriteCategory: string
  completionRate: number
  streak: number
  level: number
  nextLevelPoints: number
  points: number
}

export class UserService {
  private static instance: UserService

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService()
    }
    return UserService.instance
  }

  async getUserData(userId: string): Promise<{
    user: UserProfile
    stats: UserStats
    readHistory: any[]
    reactions: any[]
  } | null> {
    try {
      const response = await fetch(`/api/user?userId=${userId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch user data")
      }
      return await response.json()
    } catch (error) {
      console.error("Error fetching user data:", error)
      return null
    }
  }

  async updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<boolean> {
    try {
      const response = await fetch("/api/user", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, profile }),
      })
      return response.ok
    } catch (error) {
      console.error("Error updating user profile:", error)
      return false
    }
  }

  async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<boolean> {
    try {
      const response = await fetch("/api/user", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, preferences }),
      })
      return response.ok
    } catch (error) {
      console.error("Error updating user preferences:", error)
      return false
    }
  }

  async getPersonalizedFeed(userId: string): Promise<any[]> {
    try {
      const response = await fetch(`/api/user/personalized-feed?userId=${userId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch personalized feed")
      }
      return await response.json()
    } catch (error) {
      console.error("Error fetching personalized feed:", error)
      return []
    }
  }

  async trackReadingActivity(userId: string, newsId: string, timeSpent: number): Promise<boolean> {
    try {
      const response = await fetch("/api/user/reading-activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, newsId, timeSpent }),
      })
      return response.ok
    } catch (error) {
      console.error("Error tracking reading activity:", error)
      return false
    }
  }

  async addPoints(userId: string, points: number, reason: string): Promise<boolean> {
    try {
      const response = await fetch("/api/user/points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, points, reason }),
      })
      return response.ok
    } catch (error) {
      console.error("Error adding points:", error)
      return false
    }
  }

  async getUserAchievements(userId: string): Promise<any[]> {
    try {
      const response = await fetch(`/api/user/achievements?userId=${userId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch achievements")
      }
      return await response.json()
    } catch (error) {
      console.error("Error fetching achievements:", error)
      return []
    }
  }

  async getLeaderboard(timeframe: "week" | "month" | "all" = "week"): Promise<any[]> {
    try {
      const response = await fetch(`/api/user/leaderboard?timeframe=${timeframe}`)
      if (!response.ok) {
        throw new Error("Failed to fetch leaderboard")
      }
      return await response.json()
    } catch (error) {
      console.error("Error fetching leaderboard:", error)
      return []
    }
  }
}

export const userService = UserService.getInstance()
