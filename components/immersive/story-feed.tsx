"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PanInfo } from "framer-motion"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Loader2,
  Newspaper,
  Sparkles,
  Users,
  WifiOff,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { useBandejaStore } from "@/lib/immersive/bandeja-store"
import { PACE_DEFS, PACE_ORDER } from "@/lib/immersive/pace"
import { BandejaOverlay } from "./bandeja-overlay"
import { StoryCard } from "./story-card"
import { StoryContextPanel } from "./story-context-panel"
import type { ArticleDetail, FeedArticle } from "./types"

const PAGE_SIZE = 10
const PREFETCH_THRESHOLD = 3
const WHEEL_STEP_THRESHOLD = 60
const WHEEL_COOLDOWN_MS = 550
const DRAG_OFFSET_THRESHOLD = 90
const DRAG_VELOCITY_THRESHOLD = 500

const PARASI_COLOR = "#0A7FFF"

/** Category filter selected via the bandeja tray (built in the next phase). */
export type FeedFilter = { slug: string; name: string; color: string } | "parasi"

const PACE_ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  sparkles: Sparkles,
  users: Users,
}

interface FeedPageResponse {
  articles: FeedArticle[]
  total: number
  offset: number
  hasMore: boolean
}

type InitialStatus = "loading" | "ready" | "empty" | "error"

async function fetchFeedPage(offset: number, categorySlug?: string): Promise<FeedPageResponse> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
  if (categorySlug) params.set("category", categorySlug)
  const res = await fetch(`/api/news/feed?${params.toString()}`)
  if (!res.ok) throw new Error("Failed to load feed")
  return res.json()
}

function detailToFeedArticle(detail: ArticleDetail): FeedArticle {
  return {
    id: detail.id,
    title: detail.title,
    slug: detail.slug,
    summary: detail.summary,
    tldr: detail.tldr,
    whyItMatters: detail.whyItMatters,
    imageUrl: detail.imageUrl,
    sourceUrl: detail.sourceUrl,
    sourceName: detail.sourceName,
    publishedAt: detail.publishedAt,
    category: detail.category,
    tags: detail.tags,
    trending: detail.trending,
    priority: detail.priority,
    sentiment: detail.sentiment,
    readTime: detail.readTime,
    stats: detail.stats,
  }
}

export function StoryFeed() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { pace, hidden, toggleHidden, setPace } = useBandejaStore()

  const [articles, setArticles] = useState<FeedArticle[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [initialStatus, setInitialStatus] = useState<InitialStatus>("loading")
  const [index, setIndex] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [isDesktop, setIsDesktop] = useState(false)
  const [panelArticleId, setPanelArticleId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  // Lifted state for the bandeja tray + category filter — the tray itself
  // (BandejaOverlay) is built in the next phase. See prop contract in the
  // task report: onSelectFilter(cat), onClose().
  const [trayOpen, setTrayOpen] = useState(false)
  const [filter, setFilter] = useState<FeedFilter>("parasi")

  const [gestureDismissed, setGestureDismissed] = useState(false)
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null)
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastKeyRef = useRef(0)

  const initialStoryParam = useRef(searchParams.get("story"))
  const isFirstLoad = useRef(true)
  const wheelAccum = useRef(0)
  const wheelCooldown = useRef(false)

  const showToast = useCallback((message: string) => {
    toastKeyRef.current += 1
    setToast({ message, key: toastKeyRef.current })
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    toastTimeout.current = setTimeout(() => setToast(null), 2400)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current)
    }
  }, [])

  // Viewport height, tracked in JS so the drag/animate offsets are exact pixels
  // (percentage transforms are relative to the stacked container's own height,
  // which would be N × viewport tall here — not what we want).
  useEffect(() => {
    function updateHeight() {
      setViewportHeight(window.innerHeight)
    }
    updateHeight()
    window.addEventListener("resize", updateHeight)
    return () => window.removeEventListener("resize", updateHeight)
  }, [])

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)")
    setIsDesktop(mql.matches)
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener("change", listener)
    return () => mql.removeEventListener("change", listener)
  }, [])

  const activeCategorySlug = filter === "parasi" ? undefined : filter.slug

  // Load (or reload) page 0 whenever the category filter changes — per the
  // task's data-reality constraints, category switches always refetch fresh
  // from offset 0 rather than reordering the already-loaded window.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setInitialStatus("loading")
      setArticles([])
      setIndex(0)
      try {
        const data = await fetchFeedPage(0, activeCategorySlug)
        if (cancelled) return
        setArticles(data.articles)
        setHasMore(data.hasMore)
        setOffset(data.articles.length)

        if (data.articles.length === 0) {
          setInitialStatus("empty")
          return
        }

        setInitialStatus("ready")

        if (isFirstLoad.current) {
          isFirstLoad.current = false
          const wanted = initialStoryParam.current
          if (wanted) {
            const foundIndex = data.articles.findIndex((a) => a.id === wanted || a.slug === wanted)
            if (foundIndex >= 0) setIndex(foundIndex)
          }
        }
      } catch {
        if (!cancelled) setInitialStatus("error")
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [activeCategorySlug])

  // Categories the user chose to see less of are excluded client-side from
  // whatever is currently loaded, regardless of which filter is active.
  const visibleArticles = useMemo(
    () => articles.filter((a) => !hidden.includes(a.category.slug)),
    [articles, hidden]
  )

  // Prefetch the next page shortly before the user reaches the end of the
  // currently visible (post-hidden-filter) window.
  useEffect(() => {
    if (!hasMore || loadingMore || visibleArticles.length === 0) return
    if (index < visibleArticles.length - PREFETCH_THRESHOLD) return

    setLoadingMore(true)
    fetchFeedPage(offset, activeCategorySlug)
      .then((data) => {
        setArticles((prev) => [...prev, ...data.articles])
        setHasMore(data.hasMore)
        setOffset((prev) => prev + data.articles.length)
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false))
  }, [index, visibleArticles.length, hasMore, loadingMore, offset, activeCategorySlug])

  // Keep the URL in sync with the current story (shareable + back/forward friendly)
  useEffect(() => {
    const current = visibleArticles[index]
    if (!current) return
    router.replace(`/now?story=${current.slug}`, { scroll: false })
  }, [index, visibleArticles, router])

  const goTo = useCallback(
    (next: number) => {
      setGestureDismissed(true)
      setIndex((prev) => {
        if (visibleArticles.length === 0) return prev
        const clamped = Math.max(0, Math.min(next, visibleArticles.length - 1))
        return clamped
      })
    },
    [visibleArticles.length]
  )

  const openTray = useCallback(() => setTrayOpen(true), [])

  // Keyboard navigation + "G" shortcut for the bandeja tray
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (panelOpen) return
      if (trayOpen && e.key === "Escape") {
        e.preventDefault()
        setTrayOpen(false)
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        goTo(index + 1)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        goTo(index - 1)
      } else if (e.key.toLowerCase() === "g") {
        setTrayOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [index, goTo, panelOpen, trayOpen])

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (panelOpen || wheelCooldown.current) return
      wheelAccum.current += e.deltaY
      if (Math.abs(wheelAccum.current) > WHEEL_STEP_THRESHOLD) {
        const direction = wheelAccum.current > 0 ? 1 : -1
        wheelAccum.current = 0
        wheelCooldown.current = true
        goTo(index + direction)
        setTimeout(() => {
          wheelCooldown.current = false
        }, WHEEL_COOLDOWN_MS)
      }
    },
    [index, goTo, panelOpen]
  )

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y < -DRAG_OFFSET_THRESHOLD || info.velocity.y < -DRAG_VELOCITY_THRESHOLD) {
        goTo(index + 1)
      } else if (info.offset.y > DRAG_OFFSET_THRESHOLD || info.velocity.y > DRAG_VELOCITY_THRESHOLD) {
        goTo(index - 1)
      }
    },
    [index, goTo]
  )

  const openContextFor = useCallback((id: string) => {
    setPanelArticleId(id)
    setPanelOpen(true)
  }, [])

  const goToStory = useCallback(
    (id: string) => {
      const foundIndex = visibleArticles.findIndex((a) => a.id === id)
      if (foundIndex >= 0) {
        setIndex(foundIndex)
        setPanelOpen(false)
        return
      }

      // Related story isn't in the loaded window yet — fetch it and splice it
      // in right after the current card so the feed stays scrollable.
      fetch(`/api/news/${id}`)
        .then(async (res) => {
          if (!res.ok) return
          const detail = (await res.json()) as ArticleDetail
          const injected = detailToFeedArticle(detail)
          const currentId = visibleArticles[index]?.id
          setArticles((prev) => {
            if (prev.some((a) => a.id === injected.id)) return prev
            const rawCurrentIndex = prev.findIndex((a) => a.id === currentId)
            const insertAt = rawCurrentIndex >= 0 ? rawCurrentIndex + 1 : prev.length
            return [...prev.slice(0, insertAt), injected, ...prev.slice(insertAt)]
          })
          setIndex(index + 1)
          setPanelOpen(false)
        })
        .catch(() => {
          // leave the panel open — better than silently doing nothing
        })
    },
    [visibleArticles, index]
  )

  const handleHideCategory = useCallback(
    (slug: string, name: string) => {
      toggleHidden(slug)
      showToast(`Vais ver menos de ${name}. Podes repor na bandeja.`)
      setIndex(0)
    },
    [toggleHidden, showToast]
  )

  const cyclePace = useCallback(() => {
    const currentIdx = PACE_ORDER.indexOf(pace)
    const next = PACE_ORDER[(currentIdx + 1) % PACE_ORDER.length]
    setPace(next)
    showToast(`Ritmo: ${PACE_DEFS[next].label}`)
  }, [pace, setPace, showToast])

  const filterName = filter === "parasi" ? "Para si" : filter.name
  const filterColor = filter === "parasi" ? PARASI_COLOR : filter.color
  const PaceIcon = PACE_ICONS[PACE_DEFS[pace].icon] ?? Sparkles

  const showGestureHint =
    initialStatus === "ready" && index === 0 && !gestureDismissed && !trayOpen && !panelOpen

  if (initialStatus === "loading") {
    return <FeedSkeleton />
  }

  if (initialStatus === "error") {
    return <FeedErrorState />
  }

  if (initialStatus === "empty") {
    return <FeedEmptyState />
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black" onWheel={handleWheel}>
      <motion.div
        className="w-full"
        drag="y"
        dragConstraints={{ top: -(visibleArticles.length - 1) * Math.max(viewportHeight, 1), bottom: 0 }}
        dragElastic={0.12}
        onDragEnd={handleDragEnd}
        animate={{ y: -index * viewportHeight }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
      >
        {visibleArticles.map((article) => (
          <div key={article.id} className="h-dvh w-full">
            <StoryCard
              article={article}
              onOpenContext={() => openContextFor(article.id)}
              onOpenBandeja={openTray}
              onHideCategory={handleHideCategory}
            />
          </div>
        ))}
      </motion.div>

      {loadingMore && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 text-white/60 md:bottom-6">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="pointer-events-auto flex items-center gap-2.5 text-white">
          <div className="relative h-6 w-6 shrink-0">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <span
            className="border-l pl-2.5"
            style={{ fontSize: 12, color: "rgba(255,255,255,.5)", borderColor: "rgba(255,255,255,.15)" }}
          >
            {index + 1} / {visibleArticles.length}
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={cyclePace}
            className="flex items-center gap-1.5 rounded-xl font-semibold text-white transition-colors"
            style={{
              background: "rgba(255,255,255,.06)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,.12)",
              height: 38,
              padding: "0 13px",
              fontSize: 13,
            }}
          >
            <PaceIcon className="h-3.5 w-3.5" />
            {PACE_DEFS[pace].label}
          </button>

          <button
            type="button"
            onClick={openTray}
            className="flex items-center gap-1.5 rounded-xl font-semibold text-white transition-colors"
            style={{
              background: "rgba(255,255,255,.06)",
              backdropFilter: "blur(24px)",
              border: `1px solid ${filterColor}66`,
              boxShadow: `0 0 14px ${filterColor}33`,
              height: 38,
              padding: "0 13px",
              fontSize: 13,
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: filterColor, boxShadow: `0 0 8px ${filterColor}` }}
            />
            {filterName}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={openTray}
            className="flex items-center gap-1.5 rounded-xl font-semibold text-white transition-colors hover:border-primary/50"
            style={{
              background: "rgba(255,255,255,.06)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,.12)",
              height: 38,
              padding: "0 13px",
              fontSize: 13,
            }}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Bandeja
            <span
              className="rounded"
              style={{
                fontSize: 10,
                border: "1px solid rgba(255,255,255,.2)",
                padding: "1px 5px",
              }}
            >
              G
            </span>
          </button>
        </div>
      </div>

      {/* Progress dots */}
      <div className="pointer-events-none absolute right-2 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-1.5">
        {visibleArticles.map((article, i) => (
          <span
            key={article.id}
            className="rounded-full transition-all duration-[.35s]"
            style={{
              width: i === index ? 6 : 4,
              height: i === index ? 22 : 4,
              background: i === index ? filterColor : "rgba(255,255,255,.25)",
              boxShadow: i === index ? `0 0 10px ${filterColor}80` : "none",
              transitionTimingFunction: "cubic-bezier(.22,1,.36,1)",
            }}
          />
        ))}
      </div>

      {/* Gesture hint */}
      {showGestureHint && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-1 text-white/55"
          style={{ bottom: 84 }}
        >
          <ChevronUp className="h-4 w-4 animate-float" />
          <span style={{ fontSize: 12 }}>Desliza para a próxima história</span>
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <div
            className="pointer-events-none absolute inset-x-0 z-30 flex justify-center"
            style={{ bottom: 78 }}
          >
            <motion.div
              key={toast.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="rounded-full px-4 py-2 text-white"
              style={{
                background: "rgba(16,16,20,.94)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,.12)",
                fontSize: 13,
              }}
            >
              {toast.message}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <StoryContextPanel
        articleId={panelArticleId}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        side={isDesktop ? "right" : "bottom"}
        onSelectRelated={goToStory}
      />

      <BandejaOverlay
        open={trayOpen}
        filter={filter}
        onSelectFilter={(cat) => {
          setFilter(cat)
          setTrayOpen(false)
          showToast(`Bandeja: ${cat === "parasi" ? "Para si" : cat.name}`)
        }}
        onClose={() => setTrayOpen(false)}
        onToast={showToast}
      />
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="flex h-dvh w-full flex-col justify-end gap-4 bg-black p-6 pb-28 md:pl-24 md:pr-28">
      <div className="h-4 w-32 rounded-full bg-white/10 shimmer" />
      <div className="h-8 w-3/4 rounded-lg bg-white/10 shimmer" />
      <div className="h-8 w-1/2 rounded-lg bg-white/10 shimmer" />
      <div className="h-4 w-full max-w-md rounded bg-white/8 shimmer" />
      <div className="h-9 w-36 rounded-md bg-white/10 shimmer" />
    </div>
  )
}

function FeedErrorState() {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-black px-8 text-center text-white/70">
      <WifiOff className="h-8 w-8" />
      <p className="font-medium text-white">Não foi possível carregar o feed</p>
      <p className="text-sm text-white/50">Verifica a tua ligação e tenta novamente.</p>
    </div>
  )
}

function FeedEmptyState() {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-black px-8 text-center text-white/70">
      <Newspaper className="h-8 w-8" />
      <p className="font-medium text-white">Sem notícias por agora</p>
      <p className="text-sm text-white/50">Volta mais tarde — estamos a trabalhar nisso.</p>
    </div>
  )
}
