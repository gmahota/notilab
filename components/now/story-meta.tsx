import { cn } from "@/lib/utils"
import type { StoryStatusView } from "@/lib/story-view"

/**
 * The `TOPIC · LOCATION · RECENCY` line and the status/breaking pills (spec
 * § 4, § 17, § 32).
 *
 * `recency` arrives as a formatted string rather than a timestamp on purpose:
 * the feed formats it on the client and the Brief formats it on the server, and
 * computing "12 min" inside a shared component would make those two disagree
 * across hydration.
 */

interface StoryMetaLineProps {
  topic: string
  location: string | null
  recency: string
  className?: string
}

export function StoryMetaLine({ topic, location, recency, className }: StoryMetaLineProps) {
  // Only the parts we actually have. A missing location collapses the separator
  // rather than leaving "POLITICS ·  · 12 min".
  const parts = [topic, location, recency].filter((p): p is string => Boolean(p && p.length > 0))

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[0.12em]",
        className,
      )}
    >
      {parts.map((part, i) => (
        <span key={`${part}-${i}`} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden>·</span>}
          {part}
        </span>
      ))}
    </p>
  )
}

const STATUS_LABEL: Record<StoryStatusView, string> = {
  developing: "Developing",
  confirmed: "Confirmed",
  updated: "Updated",
  closed: "Closed",
}

const STATUS_STYLE: Record<StoryStatusView, string> = {
  developing: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  confirmed: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  updated: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  closed: "border-white/20 bg-white/5 text-white/60",
}

/**
 * Spec § 17. Renders nothing when `status` is null — the service returns null
 * for stories we have no basis to label (see `statusOrNull` there), and an
 * invented "DEVELOPING" on every card would be worse than no badge at all.
 */
export function StoryStatusPill({ status }: { status: StoryStatusView | null }) {
  if (!status) return null

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
        STATUS_STYLE[status],
      )}
    >
      <span aria-hidden className="text-[8px] leading-none">
        ●
      </span>
      {STATUS_LABEL[status]}
    </span>
  )
}

/**
 * Spec § 32 — plain word, no sirens. "NotiLab deve transmitir confiança, não
 * ansiedade."
 */
export function BreakingPill() {
  return (
    <span className="inline-flex items-center rounded-full border border-red-500/45 bg-red-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300">
      Breaking
    </span>
  )
}
