"use client"

import { Navigation } from "@/components/navigation"
import { ChatWidget } from "@/components/chat-widget"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, Flame, Clock, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { trendVolumeLabel, type TrendMode } from "@/lib/news-client"

interface TrendingTopic {
  keyword: string
  volume: number
  category: string
  description?: string
  region?: string
}

interface TrendingArticle {
  id: string
  title: string
  summary: string
  slug: string
  category: { name: string; color: string }
  publishedAt: string
  readTime: number
  /** GET /api/news/feed sends the composite ranking as `rankScore`. */
  rankScore: number | null
}

/** Articles below this ranking score are not "top ranked" enough to list. */
const RANK_THRESHOLD = 70

export default function TrendingPage() {
  const [topics, setTopics] = useState<TrendingTopic[]>([])
  const [mode, setMode] = useState<TrendMode>("coverage")
  const [articles, setArticles] = useState<TrendingArticle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [topicsRes, articlesRes] = await Promise.all([
          fetch("/api/news/trending"),
          fetch("/api/news/feed?limit=20"),
        ])
        if (topicsRes.ok) {
          const data = await topicsRes.json()
          setTopics(data.topics || [])
          setMode(data.mode === "engagement" ? "engagement" : "coverage")
        }
        if (articlesRes.ok) {
          const data = await articlesRes.json()
          setArticles(
            (data.articles || []).filter(
              (a: TrendingArticle) => (a.rankScore ?? 0) >= RANK_THRESHOLD,
            ),
          )
        }
      } catch {
        // fallback: empty
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const formatVolume = (v: number) => {
    if (v == null) return "0"
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
    return v.toString()
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-xl bg-primary/10">
            <Flame className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gradient">Trending Now</h1>
            <p className="text-muted-foreground">What the world is searching for right now</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Trending Topics Grid */}
            <section className="mb-12">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-secondary" />
                Top Searches
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {topics.map((topic, i) => (
                  <Card key={topic.keyword} className="glass hover:border-primary/30 transition-all cursor-pointer group">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-primary/40">#{i + 1}</span>
                        <div>
                          <p className="font-medium group-hover:text-primary transition-colors">{topic.keyword}</p>
                          <p className="text-xs text-muted-foreground">{topic.category}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {formatVolume(topic.volume)} {trendVolumeLabel(mode, topic.volume)}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Trending Articles */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Top Ranked Articles
              </h2>
              <div className="space-y-3">
                {articles.map((article) => (
                  <Link key={article.id} href={`/news/${article.id}`}>
                    <Card className="glass hover:border-primary/30 transition-all group">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              style={{ backgroundColor: article.category?.color || "#007BFF" }}
                              className="text-white text-[10px]"
                            >
                              {article.category?.name}
                            </Badge>
                            {(article.rankScore ?? 0) >= 85 && (
                              <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                                Rank: {Math.round(article.rankScore ?? 0)}
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                            {article.title}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">{article.summary}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors ml-4 shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
      <ChatWidget />
    </div>
  )
}
