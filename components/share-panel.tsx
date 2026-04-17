"use client"

/**
 * components/share-panel.tsx
 *
 * Phase 1 share UI — replaces the basic SocialShare component.
 *
 * Features:
 *   - Loads AI-generated share snippet from /api/growth/share/[id]
 *   - WhatsApp, Telegram, X, Copy Link actions
 *   - Logs each share to /api/growth/share/[id] (POST)
 *   - Tracks share_panel_opened event on mount
 *   - Compact inline mode for NewsCard / expanded modal mode for article page
 */

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { MessageCircle, Send, Twitter, Link2, Check, Share2, Loader2 } from "lucide-react"

interface SharePanelProps {
  articleId: string
  title: string
  slug?: string | null
  userId?: string
  /** compact = icon buttons only (for cards), full = shows snippet text */
  mode?: "compact" | "full"
}

interface ShareData {
  articleId: string
  title: string
  articleUrl: string
  snippet: string
  whyItMatters: string
  shareUrls: {
    whatsapp: string
    telegram: string
    twitter: string
    copyText: string
  }
}

// ---------------------------------------------------------------------------
// Event tracking helper (fire and forget)
// ---------------------------------------------------------------------------

function track(
  event: string,
  articleId: string,
  userId?: string,
  meta?: Record<string, unknown>,
) {
  fetch("/api/growth/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, userId, articleId, meta }),
  }).catch(() => {})
}

/**
 * Creates a referral code and returns the platform-specific share URL.
 * Falls back to the current shareUrls if the API call fails.
 */
async function createReferralShare(
  articleId: string,
  channel: string,
  snippet: string,
  userId?: string,
): Promise<{ url: string | null; code: string | null }> {
  try {
    const res = await fetch(`/api/growth/share/${articleId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, userId, snippet }),
    })
    if (res.ok) {
      const data = await res.json() as {
        shareUrls?: { whatsapp: string; telegram: string; twitter: string; copyText: string }
        referralUrl?: string
        code?: string
      }
      const url = data.shareUrls?.[channel as keyof typeof data.shareUrls] ?? null
      return { url, code: data.code ?? null }
    }
  } catch {
    // network error — fall through
  }
  return { url: null, code: null }
}

// ---------------------------------------------------------------------------
// Share buttons config
// ---------------------------------------------------------------------------

const PLATFORMS = [
  {
    id: "whatsapp" as const,
    label: "WhatsApp",
    Icon: MessageCircle,
    color: "#25D366",
    hoverClass:
      "hover:text-[#25D366] hover:bg-[#25D366]/10 hover:border-[#25D366]/30",
  },
  {
    id: "telegram" as const,
    label: "Telegram",
    Icon: Send,
    color: "#2AABEE",
    hoverClass:
      "hover:text-[#2AABEE] hover:bg-[#2AABEE]/10 hover:border-[#2AABEE]/30",
  },
  {
    id: "twitter" as const,
    label: "X",
    Icon: Twitter,
    color: "#ffffff",
    hoverClass: "hover:text-white hover:bg-white/10 hover:border-white/25",
  },
] as const

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SharePanel({ articleId, title, userId, mode = "compact" }: SharePanelProps) {
  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  const loadShareData = useCallback(async () => {
    if (shareData) return
    setLoading(true)
    try {
      const res = await fetch(`/api/growth/share/${articleId}`)
      if (res.ok) {
        setShareData(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [articleId, shareData])

  useEffect(() => {
    if (open && !shareData) {
      loadShareData()
      track("share_panel_opened", articleId, userId)
    }
  }, [open, articleId, userId, shareData, loadShareData])

  const handlePlatformShare = async (platform: typeof PLATFORMS[number]["id"]) => {
    if (!shareData) return
    // Create referral code first — the returned URL embeds /s/[code]
    const { url: referralUrl } = await createReferralShare(
      articleId,
      platform,
      shareData.snippet,
      userId,
    )
    const url = referralUrl ?? shareData.shareUrls[platform]
    window.open(url, "_blank", "noopener,noreferrer")
    track("article_shared", articleId, userId, { channel: platform })
    setOpen(false)
  }

  const handleCopy = async () => {
    if (!shareData) return
    try {
      // Generate referral copy text so even clipboard shares are attributed
      const { url: referralUrl } = await createReferralShare(
        articleId,
        "copy",
        shareData.snippet,
        userId,
      )
      const copyText = referralUrl
        ? `${shareData.snippet}\n\n${referralUrl}`
        : shareData.shareUrls.copyText
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      track("share_snippet_copied", articleId, userId)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available (e.g. insecure context)
    }
  }

  const trigger =
    mode === "compact" ? (
      <button
        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/35 border border-transparent hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200"
        aria-label="Share article"
      >
        <Share2 className="h-3.5 w-3.5" />
      </button>
    ) : (
      <Button variant="outline" size="sm" className="gap-2 border-gray-700 bg-transparent text-gray-300 hover:text-white">
        <Share2 className="h-4 w-4" />
        Share
      </Button>
    )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>

      <PopoverContent
        className="w-72 bg-gray-900 border-gray-800 p-0"
        side="top"
        align="end"
      >
        {/* AI snippet preview */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
            Share snippet
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generating...
            </div>
          ) : shareData ? (
            <p className="text-gray-200 text-sm leading-snug line-clamp-3">
              {shareData.snippet}
            </p>
          ) : (
            <p className="text-gray-400 text-sm line-clamp-2">{title}</p>
          )}
        </div>

        {/* Platform buttons */}
        <div className="p-3 space-y-1">
          {PLATFORMS.map(({ id, label, Icon, hoverClass }) => (
            <button
              key={id}
              onClick={() => handlePlatformShare(id)}
              disabled={!shareData}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-lg
                text-gray-300 border border-transparent text-sm font-medium
                transition-all duration-150
                disabled:opacity-40 disabled:cursor-not-allowed
                ${hoverClass}
              `}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}

          {/* Copy link */}
          <button
            onClick={handleCopy}
            disabled={!shareData}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 border border-transparent text-sm font-medium transition-all duration-150 hover:text-white hover:bg-white/8 hover:border-white/15 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 shrink-0 text-green-400" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 shrink-0" />
                Copy link
              </>
            )}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
