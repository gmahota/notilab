"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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

// Mock data - will be replaced with API calls
const mockNews = [
  {
    id: "1",
    title: "Nova Regulamentação de IA Aprovada na Europa",
    summary:
      "O Parlamento Europeu aprovou uma lei histórica que estabelece regras rigorosas para o desenvolvimento e uso de inteligência artificial, impactando empresas tecnológicas globalmente.",
    imageUrl: "/european-parliament-ai-law.png",
    sourceName: "TechNews EU",
    publishedAt: new Date("2024-01-15T10:30:00Z"),
    category: { name: "Política", color: "#ef4444" },
    trending: true,
    readTime: 4,
    views: 12500,
    author: "Ana Silva",
  },
  {
    id: "2",
    title: "Benfica Conquista Vitória Histórica na Champions",
    summary:
      "O Sport Lisboa e Benfica venceu por 3-1 no Estádio da Luz, garantindo classificação para as quartas de final da Liga dos Campeões após 10 anos.",
    imageUrl: "/benfica-football-stadium-celebration.png",
    sourceName: "Desporto Total",
    publishedAt: new Date("2024-01-15T22:45:00Z"),
    category: { name: "Desporto", color: "#22c55e" },
    trending: true,
    readTime: 3,
    views: 25600,
    author: "João Santos",
  },
  {
    id: "3",
    title: "Festival de Cinema de Lisboa Anuncia Programação 2024",
    summary:
      "O prestigiado festival apresenta uma seleção diversificada com filmes inéditos, documentários premiados e homenagens a cineastas portugueses.",
    imageUrl: "/lisbon-cinema-festival-red-carpet.png",
    sourceName: "Cultura Hoje",
    publishedAt: new Date("2024-01-15T14:20:00Z"),
    category: { name: "Cultura", color: "#8b5cf6" },
    trending: false,
    readTime: 5,
    views: 8900,
    author: "Maria Costa",
  },
  {
    id: "4",
    title: "Breakthrough in Quantum Computing Changes Everything",
    summary:
      "Scientists at MIT have achieved a new milestone in quantum error correction, bringing fault-tolerant quantum computing closer to practical reality.",
    imageUrl: "/quantum-computing-lab.png",
    sourceName: "Science Daily",
    publishedAt: new Date("2024-01-16T08:00:00Z"),
    category: { name: "Science", color: "#06b6d4" },
    trending: true,
    readTime: 6,
    views: 18200,
    author: "Dr. Sarah Chen",
  },
]

type Article = (typeof mockNews)[number]

function formatTimeAgo(date: Date): string {
  const diffH = Math.floor((Date.now() - date.getTime()) / 3_600_000)
  if (diffH < 1) return "Just now"
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.floor(diffH / 24)}d ago`
}

function formatViews(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return String(v)
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

function EmptyState() {
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
        No news yet. We&apos;re working on it.
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
              {formatViews(article.views)}
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
  const [articles, setArticles] = useState(mockNews)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setInitialLoading(false), 1000)
    return () => clearTimeout(t)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await new Promise((r) => setTimeout(r, 900))
    setRefreshing(false)
  }

  const loadMore = async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 900))
    setLoading(false)
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
          <EmptyState key="empty" />
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
      {!showSkeletons && !isEmpty && (
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
