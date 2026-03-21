import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const { email, frequency, categories } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    const validFrequencies = ["daily", "weekly"]
    const freq = validFrequencies.includes(frequency) ? frequency : "daily"

    const subscription = await prisma.digestSubscription.upsert({
      where: { email },
      update: {
        frequency: freq,
        categories: categories || [],
        isActive: true,
      },
      create: {
        email,
        frequency: freq,
        categories: categories || [],
        isActive: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Subscribed to ${freq} digest`,
      subscription: {
        id: subscription.id,
        email: subscription.email,
        frequency: subscription.frequency,
        categories: subscription.categories,
      },
    })
  } catch (error) {
    console.error("Digest subscribe error:", error)
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    await prisma.digestSubscription.update({
      where: { email },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true, message: "Unsubscribed from digest" })
  } catch (error) {
    console.error("Digest unsubscribe error:", error)
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 })
  }
}
