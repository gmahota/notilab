"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { PanInfo } from "framer-motion"
import { motion } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Newspaper, WifiOff } from "lucide-react"

import { StoryCard } from "./story-card"
import { StoryContextPanel } from "./story-context-panel"
import type { ArticleDetail, FeedArticle } from "./types"

const PAGE_SIZE = 10
const PREFETCH_THRESHOLD = 3
const WHEEL_STEP_THRESHOLD = 60
const WHEEL_COOLDOWN_MS = 550
const DRAG_OFFSET_THRESHOLD = 90
const DRAG_VELOCITY_THRESHOLD = 500

interface FeedPageResponse {
  articles: FeedArticle[]
  total: number
  offset: number
  hasMore: boolean
}

type InitialStatus = "loading" | "ready" | "empty" | "error"

async function fetchFeedPage(offset: number): Promise<FeedPageResponse> {
  const res = await fetch(`/api/news/feed?limit=${PAGE_SIZE}&offset=${offset}`)
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

  const initialStoryParam = useRef(searchParams.get("story"))
  const wheelAccum = useRef(0)
  const wheelCooldown = useRef(false)

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

  // Initial load
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await fetchFeedPage(0)
        if (cancelled) return
        setArticles(data.articles)
        setHasMore(data.hasMore)
        setOffset(data.articles.length)

        if (data.articles.length === 0) {
          setInitialStatus("empty")
          return
        }

        setInitialStatus("ready")
        const wanted = initialStoryParam.current
        if (wanted) {
          const foundIndex = data.articles.findIndex((a) => a.id === wanted || a.slug === wanted)
          if (foundIndex >= 0) setIndex(foundIndex)
        }
      } catch {
        if (!cancelled) setInitialStatus("error")
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Prefetch the next page shortly before the user reaches the end
  useEffect(() => {
    if (!hasMore || loadingMore || articles.length === 0) return
    if (index < articles.length - PREFETCH_THRESHOLD) return

    setLoadingMore(true)
    fetchFeedPage(offset)
      .then((data) => {
        setArticles((prev) => [...prev, ...data.articles])
        setHasMore(data.hasMore)
        setOffset((prev) => prev + data.articles.length)
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false))
  }, [index, articles.length, hasMore, loadingMore, offset])

  // Keep the URL in sync with the current story (shareable + back/forward friendly)
  useEffect(() => {
    const current = articles[index]
    if (!current) return
    router.replace(`/now?story=${current.slug}`, { scroll: false })
  }, [index, articles, router])

  const goTo = useCallback(
    (next: number) => {
      setIndex((prev) => {
        if (articles.length === 0) return prev
        const clamped = Math.max(0, Math.min(next, articles.length - 1))
        return clamped
      })
    },
    [articles.length]
  )

  // Keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (panelOpen) return
      if (e.key === "ArrowDown") {
        e.preventDefault()
        goTo(index + 1)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        goTo(index - 1)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [index, goTo, panelOpen])

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
      const foundIndex = articles.findIndex((a) => a.id === id)
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
          setArticles((prev) => {
            const insertAt = index + 1
            if (prev.some((a) => a.id === injected.id)) return prev
            return [...prev.slice(0, insertAt), injected, ...prev.slice(insertAt)]
          })
          setIndex(index + 1)
          setPanelOpen(false)
        })
        .catch(() => {
          // leave the panel open — better than silently doing nothing
        })
    },
    [articles, index]
  )

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
        dragConstraints={{ top: -(articles.length - 1) * Math.max(viewportHeight, 1), bottom: 0 }}
        dragElastic={0.12}
        onDragEnd={handleDragEnd}
        animate={{ y: -index * viewportHeight }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
      >
        {articles.map((article) => (
          <div key={article.id} className="h-dvh w-full">
            <StoryCard article={article} onOpenContext={() => openContextFor(article.id)} />
          </div>
        ))}
      </motion.div>

      {loadingMore && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 text-white/60 md:bottom-6">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      <StoryContextPanel
        articleId={panelArticleId}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        side={isDesktop ? "right" : "bottom"}
        onSelectRelated={goToStory}
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
