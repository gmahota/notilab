"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { ArrowUpRight, Bookmark, Flame, Heart, Share2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn, timeAgo, trackGrowthEvent } from "@/lib/utils"
import type { FeedArticle } from "./types"

interface StoryCardProps {
  article: FeedArticle
  onOpenContext: () => void
}

function readFlag(key: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    if (value) window.localStorage.setItem(key, "1")
    else window.localStorage.removeItem(key)
  } catch {
    // private mode / storage full — optimistic UI still works for this session
  }
}

export function StoryCard({ article, onOpenContext }: StoryCardProps) {
  const likeKey = `notilab:liked:${article.id}`
  const saveKey = `notilab:saved:${article.id}`

  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [shareConfirmed, setShareConfirmed] = useState(false)

  useEffect(() => {
    setLiked(readFlag(likeKey))
    setSaved(readFlag(saveKey))
  }, [likeKey, saveKey])

  const toggleLike = useCallback(() => {
    setLiked((prev) => {
      const next = !prev
      writeFlag(likeKey, next)
      if (next) trackGrowthEvent("article_reacted", article.id, { type: "like" })
      return next
    })
  }, [likeKey, article.id])

  const toggleSave = useCallback(() => {
    setSaved((prev) => {
      const next = !prev
      writeFlag(saveKey, next)
      if (next) trackGrowthEvent("article_saved", article.id)
      return next
    })
  }, [saveKey, article.id])

  const handleShare = useCallback(async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/now?story=${article.slug}`
        : article.sourceUrl

    if (typeof window !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: article.title, text: article.tldr ?? article.summary, url })
        trackGrowthEvent("article_shared", article.id, { method: "native" })
        return
      } catch {
        // user cancelled the native share sheet — don't fall back to clipboard in that case
        return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setShareConfirmed(true)
      trackGrowthEvent("article_shared", article.id, { method: "clipboard" })
      setTimeout(() => setShareConfirmed(false), 2200)
    } catch {
      // clipboard unavailable (insecure context / permissions) — nothing else we can do
    }
  }, [article])

  const isLive = article.trending || article.priority === "URGENT"
  const teaser = article.tldr ?? article.summary

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <Image
        src={article.imageUrl || "/placeholder.svg"}
        alt={article.title}
        fill
        priority
        unoptimized
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-transparent" />

      {/* Top pills */}
      <div className="absolute top-4 left-4 right-16 flex flex-wrap items-center gap-2 md:left-24">
        <Badge
          className="border-0 text-xs font-semibold text-white"
          style={{ backgroundColor: `${article.category.color}cc` }}
        >
          {article.category.name}
        </Badge>
        {isLive && (
          <span className="glow-green-sm inline-flex items-center gap-1 rounded-full border border-[#39FF14]/35 bg-[#39FF14]/15 px-2.5 py-1 text-xs font-semibold text-[#39FF14]">
            <Flame className="h-3 w-3" />
            Em alta
          </span>
        )}
      </div>

      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-28 pt-16 md:pb-10 md:pl-24 md:pr-28">
        <div className="mb-2 flex items-center gap-2 text-xs text-white/60">
          <span className="font-medium text-white/85">{article.sourceName}</span>
          <span aria-hidden>·</span>
          <span>{timeAgo(article.publishedAt)}</span>
        </div>
        <h2 className="mb-2 line-clamp-3 text-2xl font-bold leading-tight text-white md:text-3xl">
          {article.title}
        </h2>
        {teaser && (
          <p className="mb-4 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/75 md:text-base">
            {teaser}
          </p>
        )}
        <Button onClick={onOpenContext} size="sm" className="glow-blue-sm gap-1.5">
          Ver contexto
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Action rail */}
      <div className="absolute bottom-28 right-3 flex flex-col items-center gap-4 md:bottom-16">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label={liked ? "Remover gosto" : "Gostar"}
          className="flex flex-col items-center gap-1 text-white"
        >
          <span
            className={cn(
              "glass flex h-11 w-11 items-center justify-center rounded-full transition-colors",
              liked && "border-[#39FF14]/40 text-[#39FF14]"
            )}
          >
            <Heart className={cn("h-5 w-5", liked && "fill-current")} />
          </span>
        </button>

        <button
          type="button"
          onClick={toggleSave}
          aria-pressed={saved}
          aria-label={saved ? "Remover dos guardados" : "Guardar"}
          className="flex flex-col items-center gap-1 text-white"
        >
          <span
            className={cn(
              "glass flex h-11 w-11 items-center justify-center rounded-full transition-colors",
              saved && "border-primary/50 text-primary"
            )}
          >
            <Bookmark className={cn("h-5 w-5", saved && "fill-current")} />
          </span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          aria-label="Partilhar"
          className="relative flex flex-col items-center gap-1 text-white"
        >
          <span className="glass flex h-11 w-11 items-center justify-center rounded-full">
            <Share2 className="h-5 w-5" />
          </span>
          {shareConfirmed && (
            <span className="absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/85 px-2 py-1 text-xs text-white">
              Link copiado
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
