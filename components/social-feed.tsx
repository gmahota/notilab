"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { Newspaper, Sparkles, Bookmark, Share2, Loader2, BookmarkCheck } from "lucide-react"
import { motion } from "framer-motion"

import {
  fetchFeedPage,
  formatTimeAgo,
  type FeedArticle as ApiFeedArticle,
} from "@/lib/news-client"

const PAGE_SIZE = 6

/** View model for one card — flattened from the API's FeedArticle. */
interface FeedCard {
  id: string
  title: string
  summary: string
  image: string
  category: string
  source: string
  timeAgo: string
}

function toCard(article: ApiFeedArticle): FeedCard {
  return {
    id: article.id,
    title: article.title,
    summary: article.tldr || article.summary,
    image: article.imageUrl || "/placeholder.svg",
    category: article.category?.name || "News",
    source: article.sourceName,
    timeAgo: formatTimeAgo(article.publishedAt),
  }
}

export function SocialFeed() {
  const router = useRouter()
  const [articles, setArticles] = useState<FeedCard[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [saved, setSaved] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("notilab-saved")
      return stored ? new Set(JSON.parse(stored)) : new Set()
    }
    return new Set()
  })

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("notilab-saved", JSON.stringify([...saved]))
    }
  }, [saved])

  const toggleSave = useCallback((id: string) => {
    setSaved((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // First page
  useEffect(() => {
    const controller = new AbortController()

    fetchFeedPage({ limit: PAGE_SIZE, signal: controller.signal })
      .then((page) => {
        setArticles(page.articles.map(toCard))
        setHasMore(page.hasMore)
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return
        setFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setInitialLoading(false)
      })

    return () => controller.abort()
  }, [])

  const loadMore = useCallback(async () => {
    setLoading(true)
    try {
      const page = await fetchFeedPage({ limit: PAGE_SIZE, offset: articles.length })
      // Guard against the same article arriving twice — the ranked feed can
      // reorder between requests, which would otherwise duplicate React keys.
      setArticles((prev) => {
        const seen = new Set(prev.map((a) => a.id))
        return [...prev, ...page.articles.map(toCard).filter((a) => !seen.has(a.id))]
      })
      setHasMore(page.hasMore)
    } catch {
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [articles.length])

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex items-center gap-3 mb-8"
      >
        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-secondary" />
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Feed</h2>
      </motion.div>

      {/* Loading skeletons */}
      {initialLoading && (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="glass rounded-2xl overflow-hidden border border-border/50"
            >
              <div className="h-48 sm:h-56 bg-muted/20 animate-pulse" />
              <div className="p-5 space-y-3">
                <div className="h-5 w-4/5 rounded-lg bg-muted/25 animate-pulse" />
                <div className="h-3.5 w-full rounded bg-muted/15 animate-pulse" />
                <div className="h-3.5 w-3/5 rounded bg-muted/15 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty / error */}
      {!initialLoading && articles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-muted/10 border border-border/50 flex items-center justify-center">
            <Newspaper className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">
            {failed
              ? "Couldn't load the feed. Please try again in a moment."
              : "No stories yet. New articles arrive as sources are synced."}
          </p>
        </div>
      )}

      {/* Cards */}
      <div className="space-y-6">
        {articles.map((article, index) => (
          <motion.article
            key={article.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: Math.min(index * 0.05, 0.3) }}
            className="glass rounded-2xl overflow-hidden border border-border/50 hover:border-primary/20 transition-all duration-300 group"
          >
            {/* Image */}
            <div className="relative h-48 sm:h-56 overflow-hidden">
              <Image
                src={article.image}
                alt={article.title}
                fill
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
              <div className="absolute top-3 left-3">
                <Badge className="bg-background/60 backdrop-blur-sm text-foreground/80 border-none text-xs">
                  {article.category}
                </Badge>
              </div>
              <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs text-foreground/70">
                <span>{article.source}</span>
                <span>·</span>
                <span>{article.timeAgo}</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-3">
              <h3 className="font-semibold text-lg text-foreground leading-tight group-hover:text-primary transition-colors">
                {article.title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">{article.summary}</p>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/explain/${article.id}`)}
                  className="text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Explain
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={saved.has(article.id) ? "text-secondary" : "text-muted-foreground hover:text-foreground"}
                    onClick={() => toggleSave(article.id)}
                  >
                    {saved.has(article.id) ? (
                      <BookmarkCheck className="h-4 w-4" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: article.title,
                          text: article.summary,
                          url: `/news/${article.id}`,
                        })
                      }
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center mt-10">
          <Button
            onClick={loadMore}
            disabled={loading}
            variant="outline"
            className="rounded-full glass border-border/50 hover:border-primary/30 px-8"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </section>
  )
}
