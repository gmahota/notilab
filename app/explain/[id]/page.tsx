"use client"

import { Navigation } from "@/components/navigation"
import { ChatWidget } from "@/components/chat-widget"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Brain, Baby, Lightbulb, Zap, ArrowLeft, Share2, Bookmark, Copy } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

interface ArticleAI {
  tldr: string
  whyItMatters: string
  explainLikeIm10: string
  importanceScore: number
}

interface Article {
  id: string
  title: string
  summary: string
  content: string
  category: { name: string; color: string }
  publishedAt: string
  readTime: number
  articleAI: ArticleAI | null
}

export default function ExplainPage() {
  const params = useParams()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"tldr" | "why" | "eli10">("tldr")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchArticle() {
      try {
        const res = await fetch(`/api/news/feed?limit=50`)
        if (res.ok) {
          const data = await res.json()
          const found = data.articles?.find((a: Article) => a.id === params.id)
          if (found) setArticle(found)
        }
      } catch {
        // fallback
      } finally {
        setLoading(false)
      }
    }
    fetchArticle()
  }, [params.id])

  const handleCopy = () => {
    if (!article?.articleAI) return
    const text = activeTab === "tldr"
      ? article.articleAI.tldr
      : activeTab === "why"
        ? article.articleAI.whyItMatters
        : article.articleAI.explainLikeIm10
    navigator.clipboard.writeText(`${article.title}\n\n${text}\n\nvia NotiLab`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-3xl mx-auto px-4 py-10">
          <div className="space-y-4">
            <div className="h-8 w-64 bg-muted/20 rounded animate-pulse" />
            <div className="h-40 bg-muted/20 rounded-xl animate-pulse" />
            <div className="h-40 bg-muted/20 rounded-xl animate-pulse" />
          </div>
        </main>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-3xl mx-auto px-4 py-10 text-center">
          <Brain className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Article not found</h1>
          <p className="text-muted-foreground mb-4">We couldn&apos;t find AI analysis for this article.</p>
          <Link href="/feed">
            <Button variant="outline">Back to Feed</Button>
          </Link>
        </main>
      </div>
    )
  }

  const ai = article.articleAI
  const tabs = [
    { key: "tldr" as const, label: "TL;DR", icon: Zap, color: "text-primary", bg: "bg-primary/10" },
    { key: "why" as const, label: "Why It Matters", icon: Lightbulb, color: "text-secondary", bg: "bg-secondary/10" },
    { key: "eli10" as const, label: "Explain Like I'm 10", icon: Baby, color: "text-amber-400", bg: "bg-amber-400/10" },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 py-10">
        {/* Back link */}
        <Link href={`/news/${article.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to article
        </Link>

        {/* Article header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Badge style={{ backgroundColor: article.category?.color }} className="text-white text-xs">
              {article.category?.name}
            </Badge>
            {ai && (
              <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                <Brain className="h-3 w-3 mr-1" />
                AI Score: {ai.importanceScore}
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold mb-2">{article.title}</h1>
          <p className="text-muted-foreground">{article.summary}</p>
        </div>

        {ai ? (
          <>
            {/* Tab Switcher */}
            <div className="flex gap-2 mb-6">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? `${tab.bg} ${tab.color} border border-current/20`
                      : "bg-muted/10 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Active Content */}
            <Card className="glass border-primary/20 mb-6">
              <CardContent className="p-6">
                <p className="text-lg leading-relaxed">
                  {activeTab === "tldr" && ai.tldr}
                  {activeTab === "why" && ai.whyItMatters}
                  {activeTab === "eli10" && ai.explainLikeIm10}
                </p>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-1" />
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-1" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Bookmark className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </>
        ) : (
          <Card className="glass">
            <CardContent className="p-8 text-center">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">AI Analysis Not Available</h3>
              <p className="text-sm text-muted-foreground">
                Our AI hasn&apos;t processed this article yet. Check back later!
              </p>
            </CardContent>
          </Card>
        )}
      </main>
      <ChatWidget />
    </div>
  )
}
