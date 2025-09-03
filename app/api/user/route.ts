import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        preferences: true,
        readHistory: {
          include: {
            news: {
              include: {
                category: true,
              },
            },
          },
          orderBy: {
            readAt: "desc",
          },
          take: 50,
        },
        reactions: {
          include: {
            news: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Calculate user stats
    const stats = {
      totalArticlesRead: user.readHistory.length,
      totalTimeSpent: user.readHistory.reduce((acc, history) => acc + (history.timeSpent || 0), 0),
      favoriteCategory: getMostReadCategory(user.readHistory),
      completionRate: calculateCompletionRate(user.readHistory),
      streak: calculateReadingStreak(user.readHistory),
      level: calculateUserLevel(user.points),
      nextLevelPoints: getNextLevelPoints(Number(user.level)),
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        points: user.points,
        level: user.level,
        profile: user.profile,
        preferences: user.preferences,
      },
      stats,
      readHistory: user.readHistory.slice(0, 10), // Return only recent history
      reactions: user.reactions,
    })
  } catch (error) {
    console.error("Error fetching user data:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, profile, preferences } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Update user profile
    if (profile) {
      await prisma.userProfile.upsert({
        where: { userId },
        update: profile,
        create: {
          userId,
          ...profile,
        },
      })
    }

    // Update user preferences
    if (preferences) {
      await prisma.userPreferences.upsert({
        where: { userId },
        update: preferences,
        create: {
          userId,
          ...preferences,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating user data:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function getMostReadCategory(readHistory: any[]): string {
  const categoryCount: Record<string, number> = {}

  readHistory.forEach((history) => {
    const category = history.news?.category?.name
    if (category) {
      categoryCount[category] = (categoryCount[category] || 0) + 1
    }
  })

  return (
    Object.entries(categoryCount).reduce((a, b) => (categoryCount[a[0]] > categoryCount[b[0]] ? a : b))?.[0] ||
    "Tecnologia"
  )
}

function calculateCompletionRate(readHistory: any[]): number {
  if (readHistory.length === 0) return 0

  const completedArticles = readHistory.filter((history) => (history.timeSpent || 0) > 60) // More than 1 minute
  return Math.round((completedArticles.length / readHistory.length) * 100)
}

function calculateReadingStreak(readHistory: any[]): number {
  if (readHistory.length === 0) return 0

  const today = new Date()
  let streak = 0
  const currentDate = new Date(today)

  // Check each day backwards
  for (let i = 0; i < 30; i++) {
    const dayStart = new Date(currentDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(currentDate)
    dayEnd.setHours(23, 59, 59, 999)

    const hasReadingOnDay = readHistory.some((history) => {
      const readDate = new Date(history.readAt)
      return readDate >= dayStart && readDate <= dayEnd
    })

    if (hasReadingOnDay) {
      streak++
    } else if (i > 0) {
      // If no reading today but we're not on the first day, break the streak
      break
    }

    currentDate.setDate(currentDate.getDate() - 1)
  }

  return streak
}

function calculateUserLevel(points: number): number {
  return Math.floor(points / 1000) + 1
}

function getNextLevelPoints(level: number): number {
  return level * 1000
}
