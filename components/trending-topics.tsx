"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Flame, Newspaper, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react"
import { motion } from "framer-motion"

import {
  fetchTrendingTopics,
  formatCompactNumber,
  trendVolumeLabel,
  type TrendMode,
  type TrendingTopic,
} from "@/lib/news-client"

// Keys cover both the short labels and the longer ones the trending endpoint
// actually sends (lib/trends.ts uses "Technology", "Politics", …). Anything
// unmatched falls back to the neutral style below.
const CATEGORY_COLORS: Record<string, string> = {
  Tech: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
  Technology: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
  World: "from-purple-500/20 to-purple-500/5 border-purple-500/30",
  Politics: "from-purple-500/20 to-purple-500/5 border-purple-500/30",
  Science: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30",
  Sports: "from-orange-500/20 to-orange-500/5 border-orange-500/30",
  Economy: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
  Laws: "from-pink-500/20 to-pink-500/5 border-pink-500/30",
}

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  Tech: "text-blue-400 border-blue-500/40",
  Technology: "text-blue-400 border-blue-500/40",
  World: "text-purple-400 border-purple-500/40",
  Politics: "text-purple-400 border-purple-500/40",
  Science: "text-cyan-400 border-cyan-500/40",
  Sports: "text-orange-400 border-orange-500/40",
  Economy: "text-emerald-400 border-emerald-500/40",
  Laws: "text-pink-400 border-pink-500/40",
}

const TOPIC_LIMIT = 10

function TopicSkeleton() {
  return (
    <div className="min-w-[280px] max-w-[280px] shrink-0">
      <div className="h-full rounded-2xl p-5 flex flex-col justify-between gap-4 bg-gradient-to-b from-white/5 to-white/0 border border-white/10">
        <div className="flex items-center justify-between">
          <div className="h-5 w-16 rounded-full bg-white/8 animate-pulse" />
          <div className="h-3 w-10 rounded-full bg-white/6 animate-pulse" />
        </div>
        <div className="space-y-2 flex-1">
          <div className="h-4 w-4/5 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-full rounded bg-white/6 animate-pulse" />
          <div className="h-3 w-3/5 rounded bg-white/6 animate-pulse" />
        </div>
        <div className="h-8 w-full rounded-xl bg-white/6 animate-pulse" />
      </div>
    </div>
  )
}

export function TrendingTopics() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const [topics, setTopics] = useState<TrendingTopic[]>([])
  const [mode, setMode] = useState<TrendMode>("coverage")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    fetchTrendingTopics({ limit: TOPIC_LIMIT, signal: controller.signal })
      .then((result) => {
        setTopics(result.topics)
        setMode(result.mode)
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return
        // Leave topics empty — the section hides itself rather than showing
        // stale placeholder trends.
        setTopics([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === "left" ? -340 : 340,
        behavior: "smooth",
      })
    }
  }

  // Trending topics are search keywords, not articles, so there is no article
  // id to explain — send the reader to the feed filtered by that keyword.
  const handleSeeNews = (topic: TrendingTopic) => {
    router.push(`/feed?search=${encodeURIComponent(topic.keyword)}`)
  }

  // Nothing trending and nothing loading: drop the whole section instead of
  // leaving a heading above an empty rail.
  if (!loading && topics.length === 0) return null

  return (
    <section className="relative w-full bg-[#060a14] py-16 overflow-hidden">
      {/* Top fade from hero */}
      <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-[#050810] to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/25">
              <Flame className="h-5 w-5 text-orange-400" />
            </span>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Trending Now</h2>
              {/* Cadence must match vercel.json — the Hobby plan caps crons at
                  one run per day (see DEPLOYMENT.md § Cron Jobs). */}
              <p className="text-xs text-white/35 mt-0.5">Updated daily</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => scroll("left")}
              aria-label="Scroll left"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => scroll("right")}
              aria-label="Scroll right"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </motion.div>

        {/* Horizontal scroll track */}
        <div
          ref={scrollRef}
          className="scroll-horizontal flex gap-4 pb-4"
        >
          {loading && Array.from({ length: 6 }).map((_, i) => <TopicSkeleton key={`skeleton-${i}`} />)}

          {!loading && topics.map((topic, index) => {
            const cardGradient = CATEGORY_COLORS[topic.category] ?? "from-white/5 to-white/0 border-white/10"
            const badgeColor = CATEGORY_BADGE_COLORS[topic.category] ?? "text-white/50 border-white/20"

            return (
              <motion.div
                key={topic.keyword}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.04, y: -4 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="min-w-[280px] max-w-[280px] shrink-0"
                style={{ transformOrigin: "center bottom" }}
              >
                <div
                  className={`
                    relative h-full rounded-2xl p-5 flex flex-col justify-between gap-4
                    bg-gradient-to-b ${cardGradient}
                    border backdrop-blur-sm
                    cursor-pointer
                    transition-shadow duration-300
                    hover:[box-shadow:0_0_28px_rgba(0,123,255,0.25),0_0_60px_rgba(57,255,20,0.08)]
                  `}
                >
                  {/* Top row: category badge + volume */}
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`text-xs font-medium border ${badgeColor} bg-transparent`}
                    >
                      {topic.category}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-white/40">
                      <TrendingUp className="h-3 w-3 text-[#39FF14]" />
                      <span>
                        {formatCompactNumber(topic.volume)} {trendVolumeLabel(mode, topic.volume)}
                      </span>
                    </div>
                  </div>

                  {/* Keyword + description */}
                  <div className="space-y-2 flex-1">
                    <h3 className="font-bold text-white text-base leading-snug">
                      {topic.keyword}
                    </h3>
                    {/* The endpoint's database branch returns no description
                        (only the external-API branch does), so keep this
                        conditional rather than rendering an empty line. */}
                    {topic.description && (
                      <p className="text-sm text-white/50 line-clamp-2 leading-relaxed">
                        {topic.description}
                      </p>
                    )}
                  </div>

                  {/* See related news */}
                  <Button
                    size="sm"
                    onClick={() => handleSeeNews(topic)}
                    className="w-full bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/40 text-white/70 hover:text-blue-300 rounded-xl transition-all duration-200"
                  >
                    <Newspaper className="h-3.5 w-3.5 mr-2" />
                    See news
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-[#060a14] to-transparent pointer-events-none" />
    </section>
  )
}
