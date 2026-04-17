"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { SocialShare } from "@/components/social-share"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Clock,
  Eye,
  Heart,
  MessageCircle,
  Bookmark,
  Sparkles,
  TrendingUp,
  ExternalLink,
  Volume2,
  VolumeX,
  Timer,
} from "lucide-react"

interface NewsCardProps {
  news: {
    id: string
    title: string
    summary: string
    imageUrl: string
    sourceName: string
    publishedAt: Date
    category: { name: string; slug: string; color: string }
    tags: string[]
    trending: boolean
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"
    aiSummary: string
    sentiment: string
    readTime: number
    reactions: Array<{ type: string; count: number }>
    views: number
    author: string
  }
  priority?: "featured" | "normal"
}

export function NewsCard({ news, priority = "normal" }: NewsCardProps) {
  const [isLiked, setIsLiked] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [showAISummary, setShowAISummary] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const router = useRouter()

  const handleExplain = (e: React.MouseEvent) => {
    e.preventDefault()
    router.push(`/explain/${news.id}`)
  }

  const handleSummary = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowAISummary((prev) => !prev)
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

  const isFeatured = priority === "featured"

  return (
    <Link href={`/news/${news.id}`} className="block">
      <Card
        className={`overflow-hidden cursor-pointer card-hover ${
          isFeatured ? "border-primary/50 bg-primary/5" : ""
        } ${news.trending ? "ring-1 ring-secondary/30" : ""}`}
      >
        <div className={`grid ${isFeatured ? "lg:grid-cols-2" : "grid-cols-1"} gap-0`}>
          {/* Image Section */}
          <div className="relative">
            <Image
              src={news.imageUrl || "/placeholder.svg"}
              alt={news.title}
              width={800}
              height={400}
              className={`w-full object-cover ${isFeatured ? "h-64 lg:h-full" : "h-48 sm:h-56"}`}
              unoptimized
            />

            {/* Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            {/* Priority Badge */}
            {news.priority === "URGENT" && (
              <div className="absolute top-3 left-3">
                <Badge className="bg-destructive text-destructive-foreground animate-pulse">
                  <Sparkles className="h-3 w-3 mr-1" />
                  URGENTE
                </Badge>
              </div>
            )}

            {/* Trending Badge */}
            {news.trending && (
              <div className="absolute top-3 right-3">
                <Badge className="bg-secondary text-secondary-foreground">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  TRENDING
                </Badge>
              </div>
            )}

            {/* Category Badge */}
            <div className="absolute bottom-3 left-3">
              <Badge style={{ backgroundColor: news.category.color }} className="text-white">
                {news.category.name}
              </Badge>
            </div>

            {/* Audio Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault()
                setAudioEnabled(!audioEnabled)
              }}
              className="absolute bottom-3 right-3 bg-black/50 hover:bg-black/70 text-white"
            >
              {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          </div>

          {/* Content Section */}
          <div className="p-6 space-y-4">
            {/* Header */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <span>{news.sourceName}</span>
                  <span>•</span>
                  <span>{formatTimeAgo(news.publishedAt)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>{news.readTime} min</span>
                </div>
              </div>

              <h3 className={`font-bold leading-tight ${isFeatured ? "text-xl lg:text-2xl" : "text-lg"}`}>
                {news.title}
              </h3>
            </div>

            {/* Summary */}
            <p className="text-muted-foreground leading-relaxed">{showAISummary ? news.aiSummary : news.summary}</p>

            {/* AI Actions Strip */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExplain}
                className="
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                  bg-blue-500/10 border border-blue-500/25 text-blue-400
                  hover:bg-blue-500/20 hover:border-blue-500/50
                  transition-all duration-200
                  hover:[box-shadow:0_0_14px_rgba(0,123,255,0.35)]
                  cursor-pointer
                "
              >
                <Sparkles className="h-3.5 w-3.5" />
                Explain
              </button>

              <button
                onClick={handleSummary}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                  border transition-all duration-200 cursor-pointer
                  hover:[box-shadow:0_0_14px_rgba(57,255,20,0.25)]
                  ${
                    showAISummary
                      ? "bg-[#39FF14]/15 border-[#39FF14]/40 text-[#39FF14]"
                      : "bg-white/5 border-white/15 text-white/60 hover:bg-[#39FF14]/10 hover:border-[#39FF14]/30 hover:text-[#39FF14]"
                  }
                `}
              >
                <Timer className="h-3.5 w-3.5" />
                {showAISummary ? "Hide" : "30s Summary"}
              </button>

              <SocialShare title={news.title} url={`/news/${news.id}`} />
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {news.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <Eye className="h-4 w-4" />
                  <span>{formatViews(news.views)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Heart className="h-4 w-4" />
                  <span>{news.reactions.find((r) => r.type === "LIKE")?.count || 0}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex items-center space-x-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src="/journalist-avatar.png" />
                  <AvatarFallback className="text-xs">
                    {news.author
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">{news.author}</span>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    setIsLiked(!isLiked)
                  }}
                  className={isLiked ? "text-red-500" : "text-muted-foreground"}
                >
                  <Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
                </Button>

                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={(e) => e.preventDefault()}>
                  <MessageCircle className="h-4 w-4" />
                </Button>

                <span onClick={(e) => e.preventDefault()}>
                  <SocialShare title={news.title} url={`/news/${news.id}`} />
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    setIsBookmarked(!isBookmarked)
                  }}
                  className={isBookmarked ? "text-yellow-500" : "text-muted-foreground"}
                >
                  <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />
                </Button>

                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={(e) => e.preventDefault()}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
