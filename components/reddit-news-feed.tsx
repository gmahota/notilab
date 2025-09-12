"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, MessageCircle, ThumbsUp, RefreshCw, Loader2, Globe } from "lucide-react"

interface RedditNewsItem {
  id: string
  title: string
  originalTitle: string
  translatedTitle: string
  summary: string
  imageUrl: string
  sourceUrl: string
  redditUrl: string
  author: string
  publishedAt: string
  score: number
  comments: number
  subreddit: string
}

interface RedditNewsResponse {
  success: boolean
  data: RedditNewsItem[]
  meta: {
    source: string
    subreddit: string
    count: number
    timestamp: string
  }
  error?: string
  message?: string
}

export function RedditNewsFeed() {
  const [news, setNews] = useState<RedditNewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRedditNews = async () => {
    try {
      setError(null)
      const response = await fetch("/api/reddit-news?limit=10&subreddit=worldnews")
      const data: RedditNewsResponse = await response.json()

      if (data.success) {
        setNews(data.data)
      } else {
        setError(data.message || "Failed to fetch Reddit news")
      }
    } catch (err) {
      setError("Network error while fetching news")
      console.error("Error fetching Reddit news:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchRedditNews()
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return "Há menos de 1 hora"
    if (diffInHours < 24) return `Há ${diffInHours} hora${diffInHours > 1 ? "s" : ""}`
    
    const diffInDays = Math.floor(diffInHours / 24)
    return `Há ${diffInDays} dia${diffInDays > 1 ? "s" : ""}`
  }

  useEffect(() => {
    fetchRedditNews()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando notícias do Reddit...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="text-destructive">❌ {error}</div>
          <Button onClick={() => { setLoading(true); fetchRedditNews(); }} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Notícias do Reddit</h2>
          <p className="text-muted-foreground">
            {news.length} notícias traduzidas de r/worldnews
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-background/80 backdrop-blur-sm border-border/50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* News Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {news.map((article, index) => (
          <Card
            key={article.id}
            className={`
              group overflow-hidden backdrop-blur-sm bg-background/80 border-border/50 
              hover:bg-background/90 transition-all duration-300 hover:scale-[1.02] 
              hover:shadow-lg ${index === 0 ? "md:col-span-2 lg:col-span-2" : ""}
            `}
          >
            {/* Image */}
            <div className="relative overflow-hidden">
              <img
                src={article.imageUrl}
                alt={article.title}
                className={`w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                  index === 0 ? "h-48 md:h-56" : "h-40"
                }`}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgdmlld0JveD0iMCAwIDgwMCA2MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjMWExYTFhIi8+CjxyZWN0IHg9IjM1MCIgeT0iMjUwIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjEwIiBmaWxsPSIjNzEzZjEyIi8+CjxjaXJjbGUgY3g9IjM4MCIgY3k9IjI3MCIgcj0iOCIgZmlsbD0iI2ZmNjUwMCIvPgo8cGF0aCBkPSJNMzcwIDMwMGgyMHYxMGgtMjB6IiBmaWxsPSIjZmY2NTAwIi8+CjxwYXRoIGQ9Ik0zODAgMzIwaDIwdjEwaDIwdi0xMGgxMHYzMGgtNjB2LTMweiIgZmlsbD0iI2ZmNjUwMCIvPgo8cGF0aCBkPSJNMzUwIDM2MGgxMDB2MjBIMzUweiIgZmlsbD0iIzQ0NDA0NCIvPgo8dGV4dCB4PSI0MDAiIHk9IjQwMCIgZmlsbD0iIzg4ODg4OCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Ob3TDrWNpYSBSZWRkaXQ8L3RleHQ+Cjwvc3ZnPgo="
                }}
              />
              
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              
              {/* Reddit badge */}
              <div className="absolute top-3 left-3">
                <Badge variant="secondary" className="bg-orange-500 text-white border-none">
                  <Globe className="h-3 w-3 mr-1" />
                  Reddit
                </Badge>
              </div>

              {/* Score badge */}
              <div className="absolute top-3 right-3">
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  {article.score}
                </Badge>
              </div>
            </div>

            {/* Content */}
            <CardHeader className="space-y-3">
              <CardTitle className={`leading-tight ${index === 0 ? "text-lg md:text-xl" : "text-base"}`}>
                {article.title}
              </CardTitle>
              
              {/* Summary */}
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                {article.summary}
              </p>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Meta info */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Por {article.author}</span>
                <span>{formatTimeAgo(article.publishedAt)}</span>
              </div>

              {/* Original title (smaller) */}
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">Título original</summary>
                <p className="mt-1 italic">{article.originalTitle}</p>
              </details>
            </CardContent>

            <CardFooter className="flex items-center justify-between pt-4 border-t border-border/50">
              <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                <span className="flex items-center">
                  <MessageCircle className="h-3 w-3 mr-1" />
                  {article.comments}
                </span>
                <span>r/{article.subreddit}</span>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 px-3 text-xs hover:bg-primary/10"
                >
                  <a
                    href={article.redditUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    Reddit
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 px-3 text-xs hover:bg-primary/10"
                >
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    Fonte
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Footer info */}
      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>Notícias traduzidas automaticamente do inglês para português</p>
        <p>Fonte: Reddit r/worldnews • Tradução: LibreTranslate</p>
      </div>
    </div>
  )
}