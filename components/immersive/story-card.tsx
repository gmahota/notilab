"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import dynamic from "next/dynamic"
import { ArrowUpRight, Bookmark, Box, EyeOff, Flame, Heart, Info, Newspaper, Share2 } from "lucide-react"

import { useBandejaStore } from "@/lib/immersive/bandeja-store"
import { PACE_DEFS } from "@/lib/immersive/pace"
import { cn, timeAgo, trackGrowthEvent } from "@/lib/utils"
import type { FeedArticle } from "./types"

// Heavy interactive-only viewer for the (currently dormant) "Entrar na cena"
// feature — no article in production has `spatialAsset` yet, so this must
// never bloat the initial bundle for a feature nobody can reach today.
const SpatialStoryViewer = dynamic(
  () => import("./spatial-story-viewer").then((m) => m.SpatialStoryViewer),
  { ssr: false }
)

interface StoryCardProps {
  article: FeedArticle
  onOpenContext: () => void
  onOpenBandeja: () => void
  onHideCategory: (slug: string, name: string) => void
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

/**
 * "Porque vejo isto?" reasons — pure, computed from data already on the
 * article + the store's followed list. No backend call, no schema change.
 */
function getWhyReasons(article: FeedArticle, followed: string[]): string[] {
  const reasons: string[] = []
  if (article.trending) reasons.push("Em alta agora")
  if (article.priority === "URGENT") reasons.push("Notícia urgente")
  if (followed.includes(article.category.slug)) {
    reasons.push(`Segues o tema ${article.category.name}`)
  }
  if (reasons.length === 0) reasons.push(`Fonte: ${article.sourceName}`)
  return reasons.slice(0, 3)
}

export function StoryCard({
  article,
  onOpenContext,
  onOpenBandeja,
  onHideCategory,
}: StoryCardProps) {
  const { pace, followed } = useBandejaStore()
  const paceDef = PACE_DEFS[pace]

  const likeKey = `notilab:liked:${article.id}`
  const saveKey = `notilab:saved:${article.id}`

  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [shareConfirmed, setShareConfirmed] = useState(false)
  const [whyOpen, setWhyOpen] = useState(false)
  const [sceneOpen, setSceneOpen] = useState(false)

  const whyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLiked(readFlag(likeKey))
    setSaved(readFlag(saveKey))
  }, [likeKey, saveKey])

  useEffect(() => {
    if (!whyOpen) return
    function onPointerDown(e: MouseEvent) {
      if (whyRef.current && !whyRef.current.contains(e.target as Node)) {
        setWhyOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setWhyOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [whyOpen])

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

  const handleHideCategory = useCallback(() => {
    onHideCategory(article.category.slug, article.category.name)
  }, [onHideCategory, article.category.slug, article.category.name])

  const hasImage = !!article.imageUrl && article.imageUrl !== "/placeholder.svg"
  const isUrgent = article.priority === "URGENT"
  const teaser = paceDef.longTeaser ? article.summary : article.tldr ?? article.summary
  const whyReasons = getWhyReasons(article, followed)
  const color = article.category.color

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "#050508" }}>
      {hasImage ? (
        <>
          <Image
            src={article.imageUrl}
            alt={article.title}
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(100% 60% at 50% 100%, rgba(0,0,0,.25), transparent)" }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,.7) 0%, rgba(0,0,0,.35) 45%, rgba(0,0,0,.05) 100%)",
            }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: [
              `radial-gradient(130% 90% at 75% 15%, ${color}2e, transparent 60%)`,
              `radial-gradient(90% 70% at 15% 90%, ${color}1f, transparent 55%)`,
              "linear-gradient(165deg, #0B0B0F 0%, #101018 55%, #0B0B0F 100%)",
            ].join(", "),
          }}
        >
          <div
            className="pointer-events-none absolute"
            style={{
              top: "50%",
              right: "-4%",
              width: "min(420px, 55vw)",
              height: "min(420px, 55vw)",
              transform: "translateY(-60%) rotate(-8deg)",
              opacity: 0.1,
              color,
            }}
          >
            <Newspaper className="h-full w-full" strokeWidth={1} />
          </div>
        </div>
      )}

      {/* Top scrim — both modes */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.5) 0%, transparent 30%)" }}
      />

      {/* Top pills — sit below the top bar (which occupies ~0-64px) */}
      <div
        className="absolute z-10 flex flex-wrap items-center gap-2"
        style={{ top: 76, left: 24, right: 24 }}
      >
        <span
          className="rounded-full px-2.5 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: `${color}d9` }}
        >
          {article.category.name}
        </span>
        {isUrgent && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-white"
            style={{ background: "#E11D2E", fontSize: 11, fontWeight: 800, letterSpacing: ".08em" }}
          >
            <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-white" />
            AO VIVO
          </span>
        )}
        {article.trending && (
          <span className="glow-green-sm inline-flex items-center gap-1 rounded-full border border-[#39FF14]/35 bg-[#39FF14]/12 px-2.5 py-1 text-xs font-semibold text-[#39FF14]">
            <Flame className="h-3 w-3" />
            Em alta
          </span>
        )}
      </div>

      {/* Bottom editorial block */}
      <div className="absolute inset-x-0 bottom-0 max-w-[720px] px-5 pb-28 pt-16 md:pb-[108px] md:pl-6 md:pr-[88px] md:pt-[80px]">
        <div className="mb-2 flex items-center gap-2 text-[13px] text-white/60">
          <span className="font-medium text-white/85">{article.sourceName}</span>
          <span aria-hidden>·</span>
          <span>{timeAgo(article.publishedAt)}</span>
        </div>
        <h2
          className="mb-2 font-extrabold text-white"
          style={{
            fontSize: paceDef.titleSize,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            textWrap: "balance",
            textShadow: "0 2px 24px rgba(0,0,0,.5)",
          }}
        >
          {article.title}
        </h2>
        {teaser && (
          <p
            className="mb-4 max-w-[560px] text-white/82"
            style={{ fontSize: paceDef.teaserSize, lineHeight: 1.6 }}
          >
            {teaser}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenContext}
            className="glow-blue-sm flex h-10 items-center gap-1.5 rounded-xl px-[13px] text-[13px] font-semibold text-white transition-transform hover:-translate-y-0.5"
            style={{ background: "#0A7FFF" }}
          >
            Ver contexto
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>

          {article.spatialAsset && (
            <button
              type="button"
              onClick={() => setSceneOpen(true)}
              className="flex h-10 items-center gap-1.5 rounded-xl border px-[13px] text-[13px] font-semibold text-white transition-transform hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(57,255,20,.45)]"
              style={{
                background: "linear-gradient(135deg, rgba(57,255,20,.18), rgba(10,127,255,.18))",
                backdropFilter: "blur(20px)",
                borderColor: "rgba(57,255,20,.45)",
                boxShadow: "0 0 14px rgba(57,255,20,.25)",
              }}
            >
              <Box className="h-3.5 w-3.5" />
              Entrar na cena
            </button>
          )}

          <div ref={whyRef} className="relative">
            <button
              type="button"
              onClick={() => setWhyOpen((v) => !v)}
              aria-expanded={whyOpen}
              className="glass flex h-10 items-center gap-1.5 rounded-xl px-[13px] text-[13px] font-semibold text-white/85"
              style={{ backdropFilter: "blur(20px)" }}
            >
              <Info className="h-3.5 w-3.5" />
              Porque vejo isto?
            </button>

            {whyOpen && (
              <div
                className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-xl border p-4 text-sm shadow-2xl"
                style={{
                  background: "rgba(16,16,20,.96)",
                  backdropFilter: "blur(24px)",
                  borderColor: "rgba(255,255,255,.12)",
                }}
              >
                <ul className="mb-3 flex flex-col gap-2">
                  {whyReasons.map((reason) => (
                    <li key={reason} className="flex items-start gap-2 text-white/85">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/50" />
                      {reason}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setWhyOpen(false)
                    onOpenBandeja()
                  }}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Ajustar a minha bandeja →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action rail */}
      <div className="absolute bottom-28 right-3 z-10 flex flex-col items-center gap-3.5 md:bottom-[108px] md:right-5">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label={liked ? "Remover gosto" : "Gostar"}
          className="flex flex-col items-center text-white"
        >
          <span
            className={cn(
              "glass flex h-[46px] w-[46px] items-center justify-center rounded-full transition-colors",
              liked && "border-[#39FF14]/50 text-[#39FF14]"
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
          className="flex flex-col items-center text-white"
        >
          <span
            className={cn(
              "glass flex h-[46px] w-[46px] items-center justify-center rounded-full transition-colors",
              saved && "border-[#4da3ff]/55 text-[#4da3ff]"
            )}
          >
            <Bookmark className={cn("h-5 w-5", saved && "fill-current")} />
          </span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          aria-label="Partilhar"
          className="relative flex flex-col items-center text-white"
        >
          <span className="glass flex h-[46px] w-[46px] items-center justify-center rounded-full">
            <Share2 className="h-5 w-5" />
          </span>
          {shareConfirmed && (
            <span className="absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/85 px-2 py-1 text-xs text-white">
              Link copiado
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleHideCategory}
          aria-label={`Ver menos de ${article.category.name}`}
          className="flex flex-col items-center text-white/55 transition-colors hover:text-[#ff6b6b]"
        >
          <span
            className="flex h-[46px] w-[46px] items-center justify-center rounded-full border transition-colors hover:border-[#ff6b6b]/50"
            style={{ background: "rgba(255,255,255,.03)", borderColor: "rgba(255,255,255,.08)" }}
          >
            <EyeOff className="h-5 w-5" />
          </span>
        </button>
      </div>

      {article.spatialAsset && sceneOpen && (
        <SpatialStoryViewer
          asset={article.spatialAsset}
          open={sceneOpen}
          onClose={() => setSceneOpen(false)}
        />
      )}
    </div>
  )
}
