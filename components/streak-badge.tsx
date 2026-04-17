"use client"

/**
 * components/streak-badge.tsx
 *
 * Compact streak counter shown in nav / profile header.
 * Self-fetching: loads from /api/growth/streak on mount.
 * Records today's activity on first render (idempotent within same UTC day).
 */

import { useEffect, useState } from "react"
import { Flame } from "lucide-react"

interface StreakBadgeProps {
  userId: string
  /** record = update streak on mount (use on article pages / chat). show = read-only display */
  mode?: "record" | "show"
}

interface StreakState {
  currentStreak: number
  longestStreak: number
  totalDaysActive: number
  extended: boolean
}

export function StreakBadge({ userId, mode = "show" }: StreakBadgeProps) {
  const [streak, setStreak] = useState<StreakState | null>(null)
  const [pop, setPop] = useState(false)

  useEffect(() => {
    if (!userId) return

    const load = async () => {
      if (mode === "record") {
        const res = await fetch("/api/growth/streak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        })
        if (res.ok) {
          const data = await res.json()
          setStreak(data)
          if (data.extended) {
            setPop(true)
            setTimeout(() => setPop(false), 1500)
          }
        }
      } else {
        const res = await fetch(`/api/growth/streak?userId=${userId}`)
        if (res.ok) setStreak(await res.json())
      }
    }

    load().catch(() => {})
  }, [userId, mode])

  if (!streak || streak.currentStreak === 0) return null

  const isHot = streak.currentStreak >= 7

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold
        transition-all duration-300
        ${isHot
          ? "bg-orange-500/15 text-orange-400 border border-orange-500/30"
          : "bg-gray-800 text-gray-300 border border-gray-700"
        }
        ${pop ? "scale-110" : "scale-100"}
      `}
      title={`${streak.currentStreak}-day streak · Longest: ${streak.longestStreak}`}
    >
      <Flame
        className={`h-3.5 w-3.5 ${isHot ? "text-orange-400" : "text-gray-400"}`}
        fill={isHot ? "currentColor" : "none"}
      />
      <span>{streak.currentStreak}</span>
    </div>
  )
}
