"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import Image from "next/image"
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, X } from "lucide-react"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { cn, timeAgo } from "@/lib/utils"
import type { ArticleDetail } from "./types"

type PanelStatus = "idle" | "loading" | "ready" | "notfound" | "error"

interface StoryContextPanelProps {
  articleId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  side: "right" | "bottom"
  onSelectRelated: (id: string) => void
}

const SECTION_LABEL_STYLE = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".1em",
  textTransform: "uppercase" as const,
  color: "rgba(255,255,255,.45)",
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

  const hasImage = !!detail?.imageUrl && detail.imageUrl !== "/placeholder.svg"

  const facts = detail
    ? [
        { value: detail.stats.reactions, label: "Reações" },
        { value: detail.stats.reads, label: "Leituras" },
        { value: detail.stats.saves, label: "Guardados" },
        { value: `${detail.readTime} min`, label: "Leitura" },
      ]
    : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        showCloseButton={false}
        className={cn(
          "overflow-y-auto border-white/[0.09] p-0 shadow-[-24px_0_80px_rgba(0,0,0,.55)]",
          "ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:duration-[550ms] data-[state=open]:duration-[550ms]"
        )}
        style={{ background: "rgba(16,16,20,.97)", backdropFilter: "blur(30px)" }}
      >
        {status !== "ready" && (
          <>
            <SheetTitle className="sr-only">Contexto da notícia</SheetTitle>
            <SheetDescription className="sr-only">
              Painel com o contexto completo da história selecionada.
            </SheetDescription>
          </>
        )}

        <SheetClose
          className="absolute z-20 flex items-center justify-center rounded-full text-white transition-opacity hover:opacity-80"
          style={{
            top: 14,
            right: 14,
            width: 34,
            height: 34,
            background: "rgba(0,0,0,.5)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,.12)",
          }}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </SheetClose>

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
            <div className="relative w-full shrink-0" style={{ height: 180 }}>
              {hasImage ? (
                <Image
                  src={detail.imageUrl}
                  alt={detail.title}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 480px"
                  className="object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(120% 100% at 70% 20%, ${detail.category.color}38, transparent 60%), #101014`,
                  }}
                />
              )}
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, #101014 0%, transparent 70%)" }}
              />
            </div>

            <div className="flex flex-col" style={{ padding: "20px 24px 32px", gap: 18 }}>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full text-white"
                  style={{
                    backgroundColor: `${detail.category.color}d9`,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 999,
                  }}
                >
                  {detail.category.name}
                </span>
                <SheetDescription
                  className="m-0"
                  style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}
                >
                  {detail.sourceName} · {timeAgo(detail.publishedAt)}
                </SheetDescription>
              </div>

              <SheetTitle
                className="m-0"
                style={{
                  fontSize: 22,
                  lineHeight: 1.2,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  color: "#fff",
                }}
              >
                {detail.title}
              </SheetTitle>

              <div>
                <p style={{ ...SECTION_LABEL_STYLE, marginBottom: 6 }}>O que aconteceu</p>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(255,255,255,.85)" }}>
                  {detail.summary}
                </p>
              </div>

              {detail.whyItMatters && (
                <div
                  style={{
                    border: "1px solid rgba(10,127,255,.25)",
                    background: "rgba(10,127,255,.06)",
                    borderRadius: 14,
                    padding: "14px 16px",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      color: "#4da3ff",
                      marginBottom: 6,
                    }}
                  >
                    Porque é que importa
                  </p>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,.85)" }}>
                    {detail.whyItMatters}
                  </p>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {facts.map((fact) => (
                  <div
                    key={fact.label}
                    style={{
                      background: "rgba(255,255,255,.04)",
                      border: "1px solid rgba(255,255,255,.07)",
                      borderRadius: 12,
                      padding: "12px 14px",
                    }}
                  >
                    <p style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{fact.value}</p>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginTop: 2 }}>
                      {fact.label}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <p style={{ ...SECTION_LABEL_STYLE, marginBottom: 8 }}>Fontes (1)</p>
                <div
                  className="flex items-center gap-2"
                  style={{
                    background: "rgba(255,255,255,.03)",
                    border: "1px solid rgba(255,255,255,.06)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 13,
                    color: "rgba(255,255,255,.8)",
                  }}
                >
                  <CheckCircle2
                    className="shrink-0"
                    style={{ width: 13, height: 13, color: "#39FF14" }}
                  />
                  <span>{detail.sourceName}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,.4)" }}>
                    {timeAgo(detail.publishedAt)}
                  </span>
                </div>

                <a
                  href={detail.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                  style={{ color: "#4da3ff" }}
                >
                  Ver fonte original
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              {detail.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detail.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}

              {detail.relatedStories.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-white">Histórias relacionadas</p>
                  <div className="space-y-2">
                    {detail.relatedStories.map((related) => (
                      <button
                        key={related.id}
                        type="button"
                        onClick={() => onSelectRelated(related.id)}
                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/5"
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
                        <p className="line-clamp-2 text-sm text-white/85">{related.title}</p>
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
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center text-white/60">
      {icon}
      <p className="font-medium text-white">{title}</p>
      {description && <p className="text-sm">{description}</p>}
    </div>
  )
}
