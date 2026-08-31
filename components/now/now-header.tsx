"use client"

import Link from "next/link"

import { cn } from "@/lib/utils"
import type { FeedLane } from "@/lib/story-view"

/**
 * Spec § 6. Three lanes, selected state clearly visible.
 *
 * `Following` is rendered but disabled: it needs user accounts and a
 * subscription model that do not exist yet. Showing it greyed out with a reason
 * is more honest than hiding it (the roadmap is public) or wiring it to the
 * "For You" data and pretending.
 */

const LANES: ReadonlyArray<{ id: FeedLane; label: string; enabled: boolean }> = [
  { id: "for-you", label: "For You", enabled: true },
  { id: "world", label: "World", enabled: true },
  { id: "following", label: "Following", enabled: false },
]

interface NowHeaderProps {
  lane: FeedLane
  onLaneChange: (lane: FeedLane) => void
}

export function NowHeader({ lane, onLaneChange }: NowHeaderProps) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-3 md:flex-row md:items-center md:gap-8 md:px-8 md:pb-10 md:pt-5">
      <Link
        href="/"
        className="pointer-events-auto text-base font-bold tracking-tight text-white md:text-lg"
      >
        NotiLab
      </Link>

      <nav aria-label="Feed lanes" className="pointer-events-auto flex items-center gap-1">
        {LANES.map(({ id, label, enabled }) => {
          const active = enabled && id === lane
          return (
            <button
              key={id}
              type="button"
              disabled={!enabled}
              aria-current={active ? "true" : undefined}
              title={enabled ? undefined : "Following needs an account — not available yet"}
              onClick={() => enabled && onLaneChange(id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                active && "bg-white text-black",
                !active && enabled && "text-white/60 hover:text-white",
                !enabled && "cursor-not-allowed text-white/25",
              )}
            >
              {label}
            </button>
          )
        })}
      </nav>
    </header>
  )
}
