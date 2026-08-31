"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, type PanInfo } from "framer-motion"
import { ChevronDown, Compass, Loader2, Sparkles, WifiOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { trackStoryEvent } from "@/lib/utils"
import { storyShareText, type FeedLane, type NowFeedPage, type NowStory } from "@/lib/story-view"
import { AskNotiBot } from "./ask-notibot"
import { NowHeader } from "./now-header"
import { StorySlide } from "./story-slide"
import { useSavedStories } from "./use-saved-stories"

/**
 * The NOW V2 vertical feed (spec § 3, § 8, § 27, § 30, § 31).
 *
 * Swipe/keyboard/wheel navigation, one story per viewport, three stories kept
 * warm so advancing feels instant, and the URL kept in step with the current
 * story so every card is shareable.
 */

const PAGE_SIZE = 10

/** Fetch the next page this many cards before the end. */
const PREFETCH_THRESHOLD = 3

/** Cards to keep image-priority on: the current one and its two neighbours. */
const PRELOAD_RADIUS = 2

const WHEEL_STEP_THRESHOLD = 60
const WHEEL_COOLDOWN_MS = 550
const DRAG_OFFSET_THRESHOLD = 90
const DRAG_VELOCITY_THRESHOLD = 500

/** Held this long, a card counts as read (spec § 35 `story_read_30s`). */
const READ_MS = 30_000

/** Left faster than this without opening the Brief, it counts as a skip. */
const SKIP_MS = 5_000

type Status = "loading" | "ready" | "empty" | "error"

interface NowFeedProps {
  lane: FeedLane
  /** Story to open on first paint, from `/now/[slug]`. */
  initialSlug?: string
}

async function fetchPage(lane: FeedLane, offset: number): Promise<NowFeedPage> {
  const res = await fetch(`/api/now/feed?lane=${lane}&limit=${PAGE_SIZE}&offset=${offset}`)
  if (!res.ok) throw new Error(`feed failed: ${res.status}`)
  return res.json()
}

export function NowFeed({ lane: initialLane, initialSlug }: NowFeedProps) {
  const router = useRouter()
  const { isSaved, toggle: toggleSaved } = useSavedStories()

  const [lane, setLane] = useState<FeedLane>(initialLane)
  const [stories, setStories] = useState<NowStory[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [status, setStatus] = useState<Status>("loading")
  const [index, setIndex] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [isDesktop, setIsDesktop] = useState(false)
  const [askOpen, setAskOpen] = useState(false)

  const wantedSlug = useRef(initialSlug)
  const wheelAccum = useRef(0)
  const wheelCooldown = useRef(false)
  /** Dwell bookkeeping for the card currently on screen. */
  const dwell = useRef<{ slug: string; enteredAt: number; opened: boolean } | null>(null)
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const current = stories[index]

  // Exact pixel offsets: a percentage transform would be relative to the
  // stacked container, which is N viewports tall.
  useEffect(() => {
    const update = () => setViewportHeight(window.innerHeight)
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)")
    setIsDesktop(mql.matches)
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener("change", listener)
    return () => mql.removeEventListener("change", listener)
  }, [])

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false

    setStatus("loading")
    setStories([])
    setIndex(0)
    setOffset(0)
    setHasMore(true)

    async function load() {
      try {
        const page = await fetchPage(lane, 0)
        if (cancelled) return

        let loaded = page.stories
        let startIndex = 0

        // A deep link may point at a story the ranked first page does not
        // contain. Fetch it on its own and lead with it, so the link opens what
        // it promised instead of the top of the feed.
        const wanted = wantedSlug.current
        if (wanted) {
          const found = loaded.findIndex((s) => s.slug === wanted || s.id === wanted)
          if (found >= 0) {
            startIndex = found
          } else {
            const res = await fetch(`/api/stories/${encodeURIComponent(wanted)}`)
            if (cancelled) return
            if (res.ok) {
              const story = (await res.json()) as NowStory
              loaded = [story, ...loaded.filter((s) => s.id !== story.id)]
              startIndex = 0
            }
          }
          wantedSlug.current = undefined
        }

        setStories(loaded)
        setOffset(page.stories.length)
        setHasMore(page.hasMore)
        setIndex(startIndex)
        setStatus(loaded.length === 0 ? "empty" : "ready")
      } catch {
        if (!cancelled) setStatus("error")
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [lane])

  useEffect(() => {
    if (!hasMore || loadingMore || stories.length === 0) return
    if (index < stories.length - PREFETCH_THRESHOLD) return

    setLoadingMore(true)
    fetchPage(lane, offset)
      .then((page) => {
        setStories((prev) => {
          const seen = new Set(prev.map((s) => s.id))
          return [...prev, ...page.stories.filter((s) => !seen.has(s.id))]
        })
        setOffset((prev) => prev + page.stories.length)
        setHasMore(page.hasMore)
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false))
  }, [index, stories.length, hasMore, loadingMore, offset, lane])

  // ---------------------------------------------------------------------------
  // URL + analytics for the card on screen
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!current) return

    // `history.replaceState` rather than `router.replace`: a soft navigation to
    // /now/[slug] would remount this component and reset the feed. Next.js
    // supports the native call for exactly this case.
    window.history.replaceState(null, "", `/now/${current.slug}`)

    trackStoryEvent("story_impression", current.slug, { lane, position: index })

    dwell.current = { slug: current.slug, enteredAt: Date.now(), opened: false }
    if (readTimer.current) clearTimeout(readTimer.current)
    readTimer.current = setTimeout(() => {
      trackStoryEvent("story_read_30s", current.slug, { lane })
    }, READ_MS)

    return () => {
      if (readTimer.current) clearTimeout(readTimer.current)
      const record = dwell.current
      if (record && record.slug === current.slug && !record.opened) {
        const heldMs = Date.now() - record.enteredAt
        if (heldMs < SKIP_MS) {
          trackStoryEvent("story_skip", record.slug, { lane, heldMs })
        }
      }
    }
  }, [current, index, lane])

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const goTo = useCallback(
    (next: number, reason: "next" | "previous" | "jump") => {
      setIndex((prev) => {
        if (stories.length === 0) return prev
        const clamped = Math.max(0, Math.min(next, stories.length - 1))
        if (clamped === prev) return prev
        const target = stories[clamped]
        if (target && reason !== "jump") {
          trackStoryEvent(reason === "next" ? "story_next" : "story_previous", target.slug, { lane })
        }
        return clamped
      })
    },
    [stories, lane],
  )

  const openBrief = useCallback(() => {
    if (!current) return
    if (dwell.current) dwell.current.opened = true
    trackStoryEvent("story_open", current.slug, { lane })
    router.push(`/story/${current.slug}`)
  }, [current, lane, router])

  const openAsk = useCallback(() => {
    if (!current) return
    if (dwell.current) dwell.current.opened = true
    setAskOpen(true)
  }, [current])

  const handleToggleSave = useCallback(() => {
    if (!current) return
    const nowSaved = toggleSaved(current.slug)
    if (nowSaved) trackStoryEvent("story_save", current.slug, { lane })
  }, [current, toggleSaved, lane])

  const handleShare = useCallback(async () => {
    if (!current) return
    const url = `${window.location.origin}/now/${current.slug}`
    const text = storyShareText(current)

    if (navigator.share) {
      try {
        await navigator.share({ title: current.headline, text, url })
        trackStoryEvent("story_share", current.slug, { lane, method: "native" })
      } catch {
        // Cancelled the native sheet — not a failure, and not a share either.
      }
      return
    }

    try {
      await navigator.clipboard.writeText(`${text}\n\n${url}`)
      trackStoryEvent("story_share", current.slug, { lane, method: "clipboard" })
    } catch {
      // Clipboard blocked (insecure context). Nothing further to try.
    }
  }, [current, lane])

  const handleOpenSource = useCallback(() => {
    if (!current) return
    trackStoryEvent("story_source_open", current.slug, { lane, from: "card" })
    router.push(`/story/${current.slug}#sources`)
  }, [current, lane, router])

  // Keyboard shortcuts (spec § 27)
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (askOpen) return

      // Never hijack keys the user is typing into a field.
      const target = event.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return
      if (target?.isContentEditable) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      switch (event.key) {
        case "ArrowDown":
        case "j":
        case "J":
          event.preventDefault()
          goTo(index + 1, "next")
          break
        case "ArrowUp":
        case "k":
        case "K":
          event.preventDefault()
          goTo(index - 1, "previous")
          break
        case "Enter":
          event.preventDefault()
          openBrief()
          break
        case "s":
        case "S":
          event.preventDefault()
          handleToggleSave()
          break
        case "a":
        case "A":
          event.preventDefault()
          openAsk()
          break
        default:
          break
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [index, goTo, openBrief, openAsk, handleToggleSave, askOpen])

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (askOpen || wheelCooldown.current) return
      wheelAccum.current += event.deltaY
      if (Math.abs(wheelAccum.current) <= WHEEL_STEP_THRESHOLD) return

      const direction = wheelAccum.current > 0 ? 1 : -1
      wheelAccum.current = 0
      wheelCooldown.current = true
      goTo(index + direction, direction > 0 ? "next" : "previous")
      setTimeout(() => {
        wheelCooldown.current = false
      }, WHEEL_COOLDOWN_MS)
    },
    [index, goTo, askOpen],
  )

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y < -DRAG_OFFSET_THRESHOLD || info.velocity.y < -DRAG_VELOCITY_THRESHOLD) {
        goTo(index + 1, "next")
      } else if (info.offset.y > DRAG_OFFSET_THRESHOLD || info.velocity.y > DRAG_VELOCITY_THRESHOLD) {
        goTo(index - 1, "previous")
      }
    },
    [index, goTo],
  )

  const laneChrome = (
    <NowHeader
      lane={lane}
      onLaneChange={(next) => {
        if (next === lane) return
        setLane(next)
        window.history.replaceState(null, "", next === "for-you" ? "/now" : `/now?lane=${next}`)
      }}
    />
  )

  if (status === "loading") {
    return (
      <div className="relative h-dvh w-full bg-black">
        {laneChrome}
        <FeedSkeleton />
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="relative h-dvh w-full bg-black">
        {laneChrome}
        <CenteredState
          icon={<WifiOff className="h-7 w-7" />}
          title="Could not load the feed"
          body="Check your connection and try again."
        />
      </div>
    )
  }

  if (status === "empty") {
    return (
      <div className="relative h-dvh w-full bg-black">
        {laneChrome}
        {lane === "following" ? <FollowingUnavailable /> : <CaughtUp />}
      </div>
    )
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black" onWheel={handleWheel}>
      {laneChrome}

      <motion.div
        className="w-full"
        drag="y"
        dragConstraints={{
          top: -(stories.length - 1) * Math.max(viewportHeight, 1),
          bottom: 0,
        }}
        dragElastic={0.12}
        onDragEnd={handleDragEnd}
        animate={{ y: -index * viewportHeight }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
      >
        {stories.map((story, i) => (
          <div key={story.id} className="h-dvh w-full">
            <StorySlide
              story={story}
              active={i === index}
              preload={Math.abs(i - index) <= PRELOAD_RADIUS}
              saved={isSaved(story.slug)}
              onOpenBrief={openBrief}
              onAsk={openAsk}
              onToggleSave={handleToggleSave}
              onShare={handleShare}
              onOpenSource={handleOpenSource}
            />
          </div>
        ))}
      </motion.div>

      {/* Desktop affordance (spec § 26) — the swipe is not discoverable with a
          mouse, so say what the next gesture is. */}
      {isDesktop && index < stories.length - 1 && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 items-center gap-1.5 text-xs text-white/40 md:flex">
          <ChevronDown className="h-3.5 w-3.5" />
          Next story
          <kbd className="ml-1 rounded border border-white/20 px-1 font-sans text-[10px]">J</kbd>
        </div>
      )}

      {loadingMore && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 text-white/60 md:bottom-14">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      <AskNotiBot
        open={askOpen}
        onOpenChange={setAskOpen}
        storySlug={current?.slug ?? null}
        storyHeadline={current?.headline ?? ""}
        side={isDesktop ? "right" : "bottom"}
      />
    </div>
  )
}

/** Spec § 30 — a shape close to the real card, never a full-screen spinner. */
function FeedSkeleton() {
  return (
    <div className="flex h-dvh w-full flex-col">
      <div className="shimmer h-[38svh] w-full shrink-0 bg-white/[0.06] md:h-[42svh]" />
      <div className="flex flex-1 flex-col gap-3 px-5 pt-5 md:mx-auto md:w-full md:max-w-[820px] md:px-8">
        <div className="shimmer h-3 w-40 rounded-full bg-white/10" />
        <div className="shimmer h-7 w-11/12 rounded-lg bg-white/10" />
        <div className="shimmer h-7 w-2/3 rounded-lg bg-white/10" />
        <div className="shimmer h-4 w-full rounded bg-white/[0.07]" />
        <div className="shimmer h-4 w-4/5 rounded bg-white/[0.07]" />
        <div className="shimmer mt-3 h-16 w-full rounded-xl bg-white/[0.05]" />
        <div className="shimmer mt-auto mb-24 h-11 w-48 rounded-md bg-white/10" />
      </div>
    </div>
  )
}

/**
 * Spec § 31. Never "No news found" — an empty feed means the user is up to
 * date, which is good news, and the copy should say so.
 */
function CaughtUp() {
  return (
    <CenteredState
      icon={<Sparkles className="h-7 w-7 text-primary" />}
      title="You’re caught up."
      body="No major new stories right now."
      action={
        <Button asChild variant="outline" className="gap-1.5">
          <Link href="/feed">
            Explore other topics
            <Compass className="h-4 w-4" />
          </Link>
        </Button>
      }
    />
  )
}

function FollowingUnavailable() {
  return (
    <CenteredState
      icon={<Sparkles className="h-7 w-7 text-white/50" />}
      title="Following isn’t available yet"
      body="Following topics and sources needs an account, and NotiLab has no sign-in on this surface yet."
      action={
        <Button asChild variant="outline" className="gap-1.5">
          <Link href="/now">Back to For You</Link>
        </Button>
      }
    />
  )
}

function CenteredState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-3 px-8 pb-20 text-center">
      {icon}
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="max-w-sm text-sm text-white/55">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
