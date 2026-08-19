import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    })

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const result = await Promise.all(
      categories.map(async (category: (typeof categories)[number]) => {
        const todayCount = await prisma.news.count({
          where: {
            categoryId: category.id,
            status: "PUBLISHED",
            publishedAt: { gte: startOfToday },
          },
        })

        return {
          name: category.name,
          slug: category.slug,
          color: category.color,
          icon: category.icon,
          todayCount,
        }
      }),
    )

    return NextResponse.json({ categories: result })
  } catch (error) {
    console.error("Categories API error:", error)
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 })
  }
}
