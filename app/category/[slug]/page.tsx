"use client"

import { Navigation } from "@/components/navigation"
import { ChatWidget } from "@/components/chat-widget"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sparkles, Bookmark, Share2, Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"

interface FeedArticle {
  id: string
  title: string
  slug?: string
  summary: string
  imageUrl: string
  category: { name: string; slug: string; color: string }
  sourceName: string
  publishedAt: string
  readTime: number
  trending: boolean
  rankScore?: number
}

const CATEGORY_META: Record<string, { label: string; description: string; icon: string }> = {
  politica: { label: "Política", description: "News about national and international politics", icon: "🏛️" },
  desporto: { label: "Desporto", description: "Sports news, results, and analysis", icon: "⚽" },
  economia: { label: "Economia", description: "Markets, finance, and economic trends", icon: "📈" },
  cultura: { label: "Cultura", description: "Art, music, cinema, and cultural events", icon: "🎭" },
  leis: { label: "Leis", description: "Legislation and legal developments", icon: "⚖️" },
  tecnologia: { label: "Tecnologia", description: "Tech, innovation, and digital trends", icon: "💻" },
}

export default function CategoryPage() {
  const params = useParams()
  const slug = params.slug as string
  const [articles, setArticles] = useState<FeedArticle[]>([])
  const [loading, setLoading] = useState(true)

  const meta = CATEGORY_META[slug] || { label: slug, description: "", icon: "📰" }

  useEffect(() => {
    async function fetchCategoryNews() {
      try {
        const res = await fetch(`/api/news/feed?category=${slug}&limit=20`)
        if (res.ok) {
          const data = await res.json()
          setArticles(data.articles || [])
        }
      } catch {
        // fallback
      } finally {
        setLoading(false)
      }
    }
    fetchCategoryNews()
  }, [slug])

  const formatTimeAgo = (dateStr: string) => {
    const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000)
    if (hours < 1) return "Now"
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Back */}
        <Link href="/feed" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Feed
        </Link>

        {/* Category Header */}
        <div className="mb-10">
          <div className="text-5xl mb-3">{meta.icon}</div>
          <h1 className="text-4xl font-bold text-foreground mb-2">{meta.label}</h1>
          <p className="text-muted-foreground text-lg">{meta.description}</p>
        </div>

        {/* Articles */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No articles in this category yet.</p>
            <Link href="/feed">
              <Button variant="outline" className="mt-4">Browse All News</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {articles.map((article, i) => (
              <motion.article
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}
                className="glass rounded-2xl overflow-hidden border border-border/50 hover:border-primary/20 transition-all group"
              >
                <div className="flex flex-col sm:flex-row">
                  {article.imageUrl && article.imageUrl !== "/placeholder.svg" && (
                    <div className="relative sm:w-48 h-48 sm:h-auto shrink-0">
                      <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-5 flex-1 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{article.sourceName}</span>
                      <span>·</span>
                      <span>{formatTimeAgo(article.publishedAt)}</span>
                      <span>·</span>
                      <span>{article.readTime} min</span>
                      {article.trending && (
                        <Badge className="bg-secondary/20 text-secondary text-[10px]">Trending</Badge>
                      )}
                    </div>
                    <Link href={`/news/${article.id}`}>
                      <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors cursor-pointer">
                        {article.title}
                      </h3>
                    </Link>
                    <p className="text-sm text-muted-foreground line-clamp-2">{article.summary}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <Link href={`/explain/${article.id}`}>
                        <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Explain
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                        <Bookmark className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </main>
      <ChatWidget />
    </div>
  )
}
