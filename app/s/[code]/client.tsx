"use client"

/**
 * app/s/[code]/client.tsx
 *
 * Client shell for the share landing page.
 * Handles: visit recording, conversion tracking, CTA interactions.
 */

import { useEffect, useState } from "react"
import { MessageCircle, ExternalLink, Lightbulb, BookOpen, Clock, Newspaper } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface ArticleMeta {
  id: string
  title: string
  sourceName: string
  publishedAt: string
  categoryName: string | null
  categoryColor: string
  imageUrl: string | null
}

interface ShareLandingClientProps {
  shareId: string
  code: string
  article: ArticleMeta
  snippet: string
  whyItMatters: string
  explain: string
  articleUrl: string
  chatUrl: string
  explainUrl: string
}

export function ShareLandingClient({
  shareId,
  code,
  article,
  snippet,
  whyItMatters,
  explain,
  articleUrl,
  chatUrl,
  explainUrl,
}: ShareLandingClientProps) {
  const [visitId, setVisitId] = useState<string | null>(null)
  const [showExplain, setShowExplain] = useState(false)

  // Record visit on mount
  useEffect(() => {
    fetch("/api/growth/share/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId, code }),
    })
      .then((r) => r.json())
      .then((d: { visitId?: string }) => {
        if (d.visitId) setVisitId(d.visitId)
      })
      .catch(() => {})
  }, [shareId, code])

  const markConverted = () => {
    if (!visitId) return
    fetch("/api/growth/share/visit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitId }),
    }).catch(() => {})
  }

  const handleArticleOpen = () => {
    markConverted()
    window.open(articleUrl, "_blank", "noopener,noreferrer")
  }

  const handleChatOpen = () => {
    markConverted()
    window.open(chatUrl, "_blank", "noopener,noreferrer")
  }

  const handleExplainToggle = () => {
    markConverted()
    setShowExplain((v) => !v)
  }

  const timeAgo = (() => {
    const diff = Date.now() - new Date(article.publishedAt).getTime()
    const h = Math.floor(diff / 3_600_000)
    if (h < 1) return "just now"
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  })()

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-8">
      {/* ── NotiLab brand header ── */}
      <div className="w-full max-w-lg mb-6 flex items-center justify-between">
        <span className="text-lg font-bold text-white tracking-tight">
          Noti<span className="text-blue-400">Lab</span>
        </span>
        <Badge
          style={{ background: article.categoryColor + "22", color: article.categoryColor, borderColor: article.categoryColor + "44" }}
          className="text-xs font-medium border"
        >
          {article.categoryName ?? "News"}
        </Badge>
      </div>

      {/* ── Article card ── */}
      <div className="w-full max-w-lg bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 shadow-xl">
        {article.imageUrl && (
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-48 object-cover"
          />
        )}

        <div className="p-5">
          {/* Meta */}
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <Newspaper className="h-3.5 w-3.5" />
            <span>{article.sourceName}</span>
            <span>·</span>
            <Clock className="h-3.5 w-3.5" />
            <span>{timeAgo}</span>
          </div>

          {/* Title */}
          <h1 className="text-xl font-bold text-white leading-tight mb-4">
            {article.title}
          </h1>

          {/* AI Snippet */}
          {snippet && (
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              {snippet}
            </p>
          )}

          {/* Why it matters */}
          {whyItMatters && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1.5">
                Why it matters
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">{whyItMatters}</p>
            </div>
          )}

          {/* Explain like I'm 10 — expandable */}
          {explain && (
            <div className="mb-4">
              <button
                onClick={handleExplainToggle}
                className="flex items-center gap-2 text-sm font-medium text-yellow-400 hover:text-yellow-300 transition-colors w-full text-left"
              >
                <Lightbulb className="h-4 w-4 shrink-0" />
                {showExplain ? "Hide simple explanation" : "Explain this simply"}
              </button>
              {showExplain && (
                <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                  <p className="text-sm text-gray-300 leading-relaxed">{explain}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CTAs ── */}
        <div className="px-5 pb-5 flex flex-col gap-3">
          <Button
            onClick={handleArticleOpen}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold h-12 rounded-xl text-base"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Read full article
          </Button>

          <Button
            onClick={handleChatOpen}
            variant="outline"
            className="w-full border-gray-700 text-gray-200 hover:bg-gray-800 font-semibold h-12 rounded-xl text-base"
          >
            <MessageCircle className="h-4 w-4 mr-2 text-green-400" />
            Ask NotiBot about this
          </Button>
        </div>
      </div>

      {/* ── Footer nudge ── */}
      <p className="mt-6 text-xs text-gray-600 text-center max-w-xs">
        You arrived via a shared link.{" "}
        <a href="/" className="text-blue-500 underline underline-offset-2">
          Browse all news on NotiLab →
        </a>
      </p>
    </div>
  )
}
