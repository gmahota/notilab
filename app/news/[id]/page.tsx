import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Clock,
  Eye,
  Heart,
  Share,
  MessageCircle,
  Bookmark,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"
import { getNewsById } from "@/lib/news-data"

export default async function NewsDetailPage({ params }: { params: { id: string } }) {
  const news = await getNewsById(params.id)

  if (!news) {
    notFound()
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return "Agora mesmo"
    if (diffInHours < 24) return `${diffInHours}h`
    return `${Math.floor(diffInHours / 24)}d`
  }

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`
    return views.toString()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/feed">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Feed
              </Button>
            </Link>

            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Share className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Bookmark className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <article className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Article Header */}
        <header className="space-y-6 mb-8">
          {/* Badges */}
          <div className="flex items-center space-x-3">
            <Badge style={{ backgroundColor: news.category.color }} className="text-white">
              {news.category.name}
            </Badge>
            {news.trending && (
              <Badge className="bg-secondary text-secondary-foreground">
                <TrendingUp className="h-3 w-3 mr-1" />
                TRENDING
              </Badge>
            )}
            {news.priority === "HIGH" && (
              <Badge className="bg-destructive text-destructive-foreground">
                <Sparkles className="h-3 w-3 mr-1" />
                IMPORTANTE
              </Badge>
            )}
          </div>

          {/* Title */}
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight text-balance">{news.title}</h1>

          {/* Summary */}
          <p className="text-xl text-muted-foreground leading-relaxed text-pretty">{news.summary}</p>

          {/* Meta Info */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/journalist-avatar.png" />
                  <AvatarFallback>
                    {news.author
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{news.author}</span>
              </div>
              <span>•</span>
              <span>{news.sourceName}</span>
              <span>•</span>
              <span>{formatTimeAgo(news.publishedAt)}</span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>{news.readTime} min de leitura</span>
              </div>
              <div className="flex items-center space-x-1">
                <Eye className="h-4 w-4" />
                <span>{formatViews(news.views)} visualizações</span>
              </div>
            </div>
          </div>
        </header>

        {/* Featured Image */}
        <div className="relative mb-8 rounded-lg overflow-hidden">
          <img
            src={news.imageUrl || "/placeholder.svg"}
            alt={news.title}
            className="w-full h-64 lg:h-96 object-cover"
          />
        </div>

        {/* Article Body */}
        <div
          className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-a:text-primary hover:prose-a:text-primary/80"
          dangerouslySetInnerHTML={{ __html: news.content }}
        />

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-8 pt-8 border-t border-border">
          {news.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              #{tag}
            </Badge>
          ))}
        </div>

        {/* Reactions & Actions */}
        <div className="flex items-center justify-between mt-8 pt-8 border-t border-border">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-red-500">
                <Heart className="h-5 w-5" />
                <span className="ml-1">{news.reactions.find((r) => r.type === "LIKE")?.count}</span>
              </Button>
            </div>

            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <MessageCircle className="h-5 w-5" />
              <span className="ml-1">Comentar</span>
            </Button>

            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Share className="h-5 w-5" />
              <span className="ml-1">Partilhar</span>
            </Button>
          </div>

          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <ExternalLink className="h-4 w-4 mr-2" />
            Fonte Original
          </Button>
        </div>

        {/* Related News */}
        {news.relatedNews && news.relatedNews.length > 0 && (
          <section className="mt-12 pt-8 border-t border-border">
            <h2 className="text-2xl font-bold mb-6">Notícias Relacionadas</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {news.relatedNews.map((related) => (
                <Link key={related.id} href={`/news/${related.id}`}>
                  <div className="group cursor-pointer">
                    <div className="relative rounded-lg overflow-hidden mb-3">
                      <img
                        src={related.imageUrl || "/placeholder.svg"}
                        alt={related.title}
                        className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <Badge variant="outline" className="mb-2">
                      {related.category}
                    </Badge>
                    <h3 className="font-semibold group-hover:text-primary transition-colors">{related.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  )
}
