"use client"

import { useCallback, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { SocialShare } from "@/components/social-share"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import {
  Loader2,
  RefreshCw,
  Sparkles,
  Bookmark,
  TrendingUp,
  Clock,
  Eye,
  Newspaper,
} from "lucide-react"

import {
  fetchFeedPage,
  formatCompactNumber,
  formatTimeAgo,
  type FeedArticle,
} from "@/lib/news-client"

const PAGE_SIZE = 10

/** View model for one card — flattened from the API's FeedArticle. */
interface Article {
  id: string
  title: string
  summary: string
  imageUrl: string
  sourceName: string
  publishedAt: string
  category: { name: string; color: string }
  trending: boolean
  readTime: number
  views: number
}

function toArticle(article: FeedArticle): Article {
  return {
    id: article.id,
    title: article.title,
    summary: article.tldr || article.summary,
    imageUrl: article.imageUrl || "/placeholder.svg",
    sourceName: article.sourceName,
    publishedAt: article.publishedAt,
    category: {
      name: article.category?.name || "News",
      color: article.category?.color || "#007BFF",
    },
    trending: article.trending,
    readTime: article.readTime,
    views: article.stats?.reads ?? 0,
  }
}

// ─── Skeleton Card ───────────────────────────────────────────────────────────

function SkeletonCard({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className="rounded-2xl overflow-hidden bg-[#0c1120] border border-white/8"
    >
      {/* Image area */}
      <div className="w-full aspect-[16/9] bg-white/6 animate-pulse" />

      {/* Content */}
      <div className="px-5 pt-4 pb-5 space-y-3">
        {/* Source row */}
        <div className="flex items-center justify-between">
          <div className="h-3 w-24 rounded-full bg-white/8 animate-pulse" />
          <div className="h-3 w-32 rounded-full bg-white/6 animate-pulse" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="h-5 w-full rounded-lg bg-white/10 animate-pulse" />
          <div className="h-5 w-4/5 rounded-lg bg-white/8 animate-pulse" />
        </div>

        {/* Summary */}
        <div className="space-y-1.5">
          <div className="h-3.5 w-full rounded bg-white/6 animate-pulse" />
          <div className="h-3.5 w-5/6 rounded bg-white/6 animate-pulse" />
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 pt-1">
          <div className="h-7 w-20 rounded-lg bg-white/6 animate-pulse" />
          <div className="h-7 w-16 rounded-lg bg-white/6 animate-pulse" />
          <div className="h-7 w-14 rounded-lg bg-white/6 animate-pulse" />
        </div>
      </div>
    </motion.div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center justify-center py-24 text-center space-y-4"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center"
      >
        <Newspaper className="h-7 w-7 text-white/25" />
      </motion.div>
      <p className="text-white/40 text-sm font-medium">
        {message ?? "No news yet. We're working on it."}
      </p>
    </motion.div>
  )
}

// ─── Social Card ──────────────────────────────────────────────────────────────

function SocialCard({ article, index }: { article: Article; index: number }) {
  const router = useRouter()
  const [saved, setSaved] = useState(false)

  const handleExplain = () => router.push(`/explain/${article.id}`)

  const handleSave = () => setSaved((s) => !s)

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: "easeOut" }}
      whileHover={{ scale: 1.015, y: -3 }}
      style={{ transformOrigin: "center bottom" }}
      className="group relative rounded-2xl overflow-hidden bg-[#0c1120] border border-white/8 cursor-pointer transition-shadow duration-300 hover:[box-shadow:0_0_32px_rgba(0,123,255,0.18),0_8px_32px_rgba(0,0,0,0.5)]"
      onClick={() => router.push(`/news/${article.id}`)}
    >
      {/* ── Image ── */}
      <div className="relative w-full aspect-[16/9] overflow-hidden">
        <Image
          src={article.imageUrl || "/placeholder.svg"}
          alt={article.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          unoptimized
        />
        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1120] via-[#0c1120]/30 to-transparent" />

        {/* Trending badge */}
        {article.trending && (
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#39FF14]/15 border border-[#39FF14]/35 text-[#39FF14]">
              <TrendingUp className="h-3 w-3" />
              Trending
            </span>
          </div>
        )}

        {/* Category */}
        <div className="absolute top-3 right-3">
          <Badge
            className="text-white text-xs font-semibold border-0"
            style={{ backgroundColor: `${article.category.color}cc` }}
          >
            {article.category.name}
          </Badge>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-5 pt-4 pb-5 space-y-3">
        {/* Source row */}
        <div className="flex items-center justify-between text-xs text-white/40">
          <span className="font-medium text-white/60">{article.sourceName}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatCompactNumber(article.views)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {article.readTime} min
            </span>
            <span>{formatTimeAgo(article.publishedAt)}</span>
          </div>
        </div>

        {/* Title — max 2 lines */}
        <h3 className="font-bold text-white text-base sm:text-lg leading-snug line-clamp-2">
          {article.title}
        </h3>

        {/* Summary — max 2 lines */}
        <p className="text-sm text-white/50 leading-relaxed line-clamp-2">
          {article.summary}
        </p>

        {/* ── Action row ── */}
        <div
          className="flex items-center gap-2 pt-1"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Explain */}
          <button
            onClick={handleExplain}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/12 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 hover:border-blue-500/55 hover:[box-shadow:0_0_14px_rgba(0,123,255,0.35)] transition-all duration-200 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Explain
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 cursor-pointer ${
              saved
                ? "bg-yellow-400/15 border-yellow-400/40 text-yellow-400"
                : "bg-white/5 border-white/12 text-white/50 hover:bg-yellow-400/10 hover:border-yellow-400/30 hover:text-yellow-400"
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />
            {saved ? "Saved" : "Save"}
          </button>

          {/* Share */}
          <SocialShare title={article.title} url={`/news/${article.id}`} />
        </div>
      </div>
    </motion.article>
  )
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export function NewsFeed() {
  const searchParams = useSearchParams()
  const search = searchParams.get("search") ?? undefined
  const category = searchParams.get("category") ?? undefined

  const [articles, setArticles] = useState<Article[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)

  const loadFirstPage = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const page = await fetchFeedPage({ limit: PAGE_SIZE, search, category, signal })
        setArticles(page.articles.map(toArticle))
        setHasMore(page.hasMore)
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return
        // Fall through to the empty state — never show placeholder articles.
        setArticles([])
        setHasMore(false)
      }
    },
    [search, category],
  )

  // Reload whenever the search/category in the URL changes.
  useEffect(() => {
    const controller = new AbortController()
    setInitialLoading(true)

    loadFirstPage(controller.signal).finally(() => {
      if (!controller.signal.aborted) setInitialLoading(false)
    })

    return () => controller.abort()
  }, [loadFirstPage])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadFirstPage()
    setRefreshing(false)
  }

  const loadMore = async () => {
    setLoading(true)
    try {
      const page = await fetchFeedPage({
        limit: PAGE_SIZE,
        offset: articles.length,
        search,
        category,
      })
      // The ranked feed can reorder between requests, so drop ids we already
      // render instead of duplicating React keys.
      setArticles((prev) => {
        const seen = new Set(prev.map((a) => a.id))
        return [...prev, ...page.articles.map(toArticle).filter((a) => !seen.has(a.id))]
      })
      setHasMore(page.hasMore)
    } catch {
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  const showSkeletons = initialLoading || refreshing
  const isEmpty = !showSkeletons && articles.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white/80">
          {showSkeletons ? (
            <span className="inline-block h-5 w-24 rounded-lg bg-white/8 animate-pulse" />
          ) : (
            `${articles.length} stories`
          )}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing || initialLoading}
          className="text-white/50 hover:text-white border border-white/10 hover:border-white/25 rounded-xl transition-all duration-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Cards / Skeletons / Empty */}
      <AnimatePresence mode="wait">
        {showSkeletons ? (
          <motion.div
            key="skeletons"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </motion.div>
        ) : isEmpty ? (
          <EmptyState
            key="empty"
            message={search ? `No stories match “${search}”.` : undefined}
          />
        ) : (
          <motion.div
            key="articles"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="space-y-5"
          >
            {articles.map((article, i) => (
              <SocialCard key={article.id} article={article} index={i} />
            ))}
            {loading &&
              Array.from({ length: 2 }).map((_, i) => (
                <SkeletonCard key={`load-${i}`} index={i} />
              ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Load more */}
      {!showSkeletons && !isEmpty && hasMore && (
        <div className="text-center pt-2">
          <Button
            variant="ghost"
            onClick={loadMore}
            disabled={loading}
            className="w-full sm:w-56 border border-white/10 hover:border-white/25 text-white/50 hover:text-white rounded-xl transition-all duration-200"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "More stories"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
