import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/** Longest address RFC 5321 allows on the wire. */
const MAX_EMAIL_LENGTH = 254

/**
 * Deliberately permissive, and deliberately not a regular expression.
 * The previous check, two unbounded character classes either side of a literal
 * dot, backtracks for a long time on a crafted address — on a route anyone can
 * POST to. The same shape checked by hand is linear: a length cap, no
 * whitespace, exactly one "@", and a dot inside the domain. Whether the address
 * actually exists is decided by the digest send, not here.
 */
function isPlausibleEmail(value: string): boolean {
  if (value.length === 0 || value.length > MAX_EMAIL_LENGTH) return false
  if (/\s/.test(value)) return false
  const at = value.indexOf("@")
  if (at <= 0 || at !== value.lastIndexOf("@")) return false
  const domain = value.slice(at + 1)
  const dot = domain.indexOf(".")
  return dot > 0 && dot < domain.length - 1
}

export async function POST(request: Request) {
  try {
    const { email, frequency, categories } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    if (!isPlausibleEmail(email)) {
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
