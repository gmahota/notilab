"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import Image from "next/image"
import { AlertCircle, Bookmark, ExternalLink, Eye, Heart, Loader2 } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { timeAgo } from "@/lib/utils"
import type { ArticleDetail } from "./types"

type PanelStatus = "idle" | "loading" | "ready" | "notfound" | "error"

interface StoryContextPanelProps {
  articleId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  side: "right" | "bottom"
  onSelectRelated: (id: string) => void
}

export function StoryContextPanel({
  articleId,
  open,
  onOpenChange,
  side,
  onSelectRelated,
}: StoryContextPanelProps) {
  const [detail, setDetail] = useState<ArticleDetail | null>(null)
  const [status, setStatus] = useState<PanelStatus>("idle")

  useEffect(() => {
    if (!open || !articleId) return

    let cancelled = false
    setStatus("loading")
    setDetail(null)

    fetch(`/api/news/${articleId}`)
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404) {
          setStatus("notfound")
          return
        }
        if (!res.ok) {
          setStatus("error")
          return
        }
        const data = (await res.json()) as ArticleDetail
        setDetail(data)
        setStatus("ready")
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [open, articleId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="overflow-y-auto p-0">
        {status !== "ready" && (
          <>
            <SheetTitle className="sr-only">Contexto da notícia</SheetTitle>
            <SheetDescription className="sr-only">
              Painel com o contexto completo da história selecionada.
            </SheetDescription>
          </>
        )}

        {status === "loading" && (
          <PanelState icon={<Loader2 className="h-6 w-6 animate-spin" />} title="A carregar contexto…" />
        )}

        {status === "notfound" && (
          <PanelState
            icon={<AlertCircle className="h-6 w-6" />}
            title="História não encontrada"
            description="Esta notícia pode ter sido despublicada ou removida."
          />
        )}

        {status === "error" && (
          <PanelState
            icon={<AlertCircle className="h-6 w-6" />}
            title="Não foi possível carregar"
            description="Verifica a tua ligação à internet e tenta novamente."
          />
        )}

        {status === "ready" && detail && (
          <div className="flex flex-col">
            <div className="relative h-48 w-full shrink-0">
              <Image src={detail.imageUrl || "/placeholder.svg"} alt={detail.title} fill unoptimized className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            </div>

            <SheetHeader className="px-5 pt-4">
              <Badge
                className="w-fit border-0 text-white"
                style={{ backgroundColor: `${detail.category.color}cc` }}
              >
                {detail.category.name}
              </Badge>
              <SheetTitle className="text-xl leading-tight">{detail.title}</SheetTitle>
              <SheetDescription>
                {detail.sourceName} · {timeAgo(detail.publishedAt)}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-5 pb-8 pt-4">
              <p className="text-sm leading-relaxed text-foreground/90">{detail.summary}</p>

              {detail.whyItMatters && (
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                    Porque é que importa
                  </p>
                  <p className="text-sm text-foreground/90">{detail.whyItMatters}</p>
                </div>
              )}

              <a
                href={detail.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Ver fonte original ({detail.sourceName})
                <ExternalLink className="h-3.5 w-3.5" />
              </a>

              {detail.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detail.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5" />
                  {detail.stats.reactions}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {detail.stats.reads}
                </span>
                <span className="flex items-center gap-1">
                  <Bookmark className="h-3.5 w-3.5" />
                  {detail.stats.saves}
                </span>
              </div>

              {detail.relatedStories.length > 0 && (
                <div className="pt-2">
                  <p className="mb-2 text-sm font-semibold">Histórias relacionadas</p>
                  <div className="space-y-2">
                    {detail.relatedStories.map((related) => (
                      <button
                        key={related.id}
                        type="button"
                        onClick={() => onSelectRelated(related.id)}
                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent"
                      >
                        <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md">
                          <Image
                            src={related.imageUrl || "/placeholder.svg"}
                            alt={related.title}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                        <p className="line-clamp-2 text-sm">{related.title}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function PanelState({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description?: string
}) {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
      {icon}
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="text-sm">{description}</p>}
    </div>
  )
}
