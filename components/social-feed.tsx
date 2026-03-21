"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { Sparkles, Bookmark, Share2, Loader2, BookmarkCheck } from "lucide-react"
import { motion } from "framer-motion"

interface FeedArticle {
  id: string
  title: string
  summary: string
  image: string
  category: string
  source: string
  timeAgo: string
}

const mockArticles: FeedArticle[] = [
  {
    id: "1",
    title: "Google Launches Gemini 3: The Most Capable AI Model Yet",
    summary: "Google reveals its most advanced AI system that can reason across text, images, audio, and video simultaneously with unprecedented accuracy.",
    image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&q=80",
    category: "Tech",
    source: "The Verge",
    timeAgo: "2h ago",
  },
  {
    id: "2",
    title: "Global Markets Rally After Central Banks Signal Rate Cuts",
    summary: "Stock markets worldwide surge as Federal Reserve and ECB hint at coordinated interest rate reductions in the coming months.",
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&q=80",
    category: "Economy",
    source: "Bloomberg",
    timeAgo: "4h ago",
  },
  {
    id: "3",
    title: "SpaceX Successfully Tests Starship for Mars Colony Mission",
    summary: "The fully reusable rocket completes its most ambitious test flight, bringing human Mars colonization one step closer to reality.",
    image: "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=600&q=80",
    category: "Science",
    source: "NASA",
    timeAgo: "5h ago",
  },
  {
    id: "4",
    title: "Champions League: Unexpected Quarter-Final Results Shake Europe",
    summary: "Underdogs advance as traditional powerhouses stumble in thrilling Champions League quarter-final matches across the continent.",
    image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&q=80",
    category: "Sports",
    source: "ESPN",
    timeAgo: "6h ago",
  },
  {
    id: "5",
    title: "Breakthrough in Renewable Energy: Solar Efficiency Hits 50%",
    summary: "MIT researchers achieve record-breaking solar panel efficiency that could revolutionize clean energy adoption worldwide.",
    image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&q=80",
    category: "Science",
    source: "Nature",
    timeAgo: "8h ago",
  },
  {
    id: "6",
    title: "New Study Reveals Surprising Benefits of Intermittent Fasting",
    summary: "Large-scale clinical trial shows significant cognitive improvements and cellular regeneration from structured eating patterns.",
    image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80",
    category: "Health",
    source: "The Lancet",
    timeAgo: "10h ago",
  },
]

export function SocialFeed() {
  const [articles, setArticles] = useState<FeedArticle[]>(mockArticles)
  const [loading, setLoading] = useState(false)
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

  const loadMore = async () => {
    setLoading(true)
    // simulate API load
    setTimeout(() => {
      setArticles((prev) => [
        ...prev,
        ...mockArticles.map((a, i) => ({
          ...a,
          id: `${prev.length + i + 1}`,
          timeAgo: `${12 + i * 2}h ago`,
        })),
      ])
      setLoading(false)
    }, 1000)
  }

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

      {/* Cards */}
      <div className="space-y-6">
        {articles.map((article, index) => (
          <motion.article
            key={article.id + "-" + index}
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
    </section>
  )
}
