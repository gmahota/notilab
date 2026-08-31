/**
 * lib/growth/share.ts
 *
 * Share engine — Phase 1 virality module.
 *
 * Responsibilities:
 *   1. Build platform share URLs (WhatsApp, Telegram, X, copy)
 *   2. Generate AI share snippets (punchy, shareable copy) with caching
 *   3. Log share actions to ShareHistory
 *
 * AI share snippet design:
 *   - Prefers cached `articleAI.shareText` to avoid repeated AI calls
 *   - Falls back to existing `articleAI.tldr` or `aiSummary`
 *   - Calls AI on-demand if nothing is cached (writes back for next time)
 */

import { prisma } from "../prisma"
import { BASE_URL } from "../base-url"
import { trackEvent } from "./events"

// ---------------------------------------------------------------------------
// PrismaExt
// ---------------------------------------------------------------------------

type PrismaExt = typeof prisma & {
  news: {
    findUnique: (a: Record<string, unknown>) => Promise<{
      id: string
      title: string
      slug: string | null
      aiSummary: string | null
      sourceUrl: string
      category: { name: string; slug: string } | null
      articleAI: {
        tldr: string | null
        whyItMatters: string | null
        shareText: string | null
      } | null
    } | null>
  }
  articleAI: {
    update: (a: { where: { articleId: string }; data: Record<string, unknown> }) => Promise<unknown>
  }
  shareHistory: {
    create: (a: { data: Record<string, unknown> }) => Promise<unknown>
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShareData {
  articleId: string
  title: string
  articleUrl: string
  snippet: string      // short text for the share preview
  whyItMatters: string // for the deep-link landing context
  shareUrls: ShareUrls
}

export interface ShareUrls {
  whatsapp: string
  telegram: string
  twitter: string
  copyText: string // plain text for clipboard
}

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

/**
 * Builds share URLs for all platforms.
 * referralUrl is used for link attribution (/s/[code]).
 * Falls back to articleUrl when no referral URL is available yet.
 */
export function buildShareUrls(
  title: string,
  snippet: string,
  articleUrl: string,
  referralUrl?: string,
): ShareUrls {
  const linkUrl = referralUrl ?? articleUrl
  const encodedUrl = encodeURIComponent(linkUrl)

  // WhatsApp-optimized: emoji header + punchy snippet + referral link
  // Groups respond better to conversational, curiosity-gap formats
  const waMessage = buildWhatsAppMessage(snippet, linkUrl)

  const tgText = encodeURIComponent(`${snippet}\n\n${linkUrl}`)
  const xText = encodeURIComponent(`${snippet} ${linkUrl}`)

  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(waMessage)}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${tgText}`,
    twitter: `https://twitter.com/intent/tweet?text=${xText}`,
    copyText: `${title}\n\n${snippet}\n\n${linkUrl}`,
  }
}

/**
 * Builds a WhatsApp-group-optimised message.
 * Format keeps the link on its own line so WhatsApp generates a rich preview.
 */
function buildWhatsAppMessage(snippet: string, url: string): string {
  return `📰 ${snippet}\n\n${url}`
}

// ---------------------------------------------------------------------------
// AI snippet generation (with cache)
// ---------------------------------------------------------------------------

async function callAIForSnippet(
  title: string,
  tldr: string | null,
  whyItMatters: string | null,
): Promise<string> {
  const context = tldr ?? whyItMatters ?? title
  const prompt = `Write a punchy, curiosity-driven 1-sentence share text for this news story. 
Make it sound natural for WhatsApp or Twitter — no hashtags, no quotes, no filler phrases.
Keep it under 120 characters. Return only the sentence, nothing else.
Story: "${title}"
Context: "${context.slice(0, 300)}"`

  const openAiKey = process.env.OPENAI_API_KEY
  const groqKey = process.env.GROQ_API_KEY

  if (!openAiKey && !groqKey) {
    return tldr ?? title
  }

  try {
    if (openAiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 80,
        }),
      })
      const data = await res.json() as { choices?: Array<{ message: { content: string } }> }
      const text = data.choices?.[0]?.message?.content?.trim()
      if (text) return text
    }

    if (groqKey) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 80,
        }),
      })
      const data = await res.json() as { choices?: Array<{ message: { content: string } }> }
      const text = data.choices?.[0]?.message?.content?.trim()
      if (text) return text
    }
  } catch {
    // Fall through to fallback
  }

  return tldr ?? title
}

// ---------------------------------------------------------------------------
// Main public functions
// ---------------------------------------------------------------------------

/**
 * Loads article data and returns everything the share panel needs.
 * Generates + caches the AI snippet if not already stored.
 */
export async function getShareData(articleId: string): Promise<ShareData | null> {
  const db = prisma as unknown as PrismaExt

  const article = await db.news.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      slug: true,
      aiSummary: true,
      sourceUrl: true,
      category: { select: { name: true, slug: true } },
      articleAI: {
        select: { tldr: true, whyItMatters: true, shareText: true },
      },
    },
  })

  if (!article) return null

  const articleUrl = article.slug
    ? `${BASE_URL}/article/${article.slug}`
    : `${BASE_URL}/news/${article.id}`

  // Determine snippet — prefer cached, then fallback chain
  let snippet = article.articleAI?.shareText ?? null

  if (!snippet) {
    snippet = await callAIForSnippet(
      article.title,
      article.articleAI?.tldr ?? null,
      article.articleAI?.whyItMatters ?? null,
    )

    // Cache it back so the next request is instant
    if (article.articleAI) {
      try {
        await db.articleAI.update({
          where: { articleId },
          data: { shareText: snippet },
        })
      } catch {
        // Non-critical — continue even if cache write fails
      }
    }
  }

  const whyItMatters = article.articleAI?.whyItMatters ?? article.aiSummary ?? ""

  return {
    articleId: article.id,
    title: article.title,
    articleUrl,
    snippet,
    whyItMatters,
    shareUrls: buildShareUrls(article.title, snippet, articleUrl),
  }
}

/**
 * Returns share data with referral-aware URLs injected.
 * Called after a referral code has been created for this share action.
 */
export function injectReferralUrl(data: ShareData, referralUrl: string): ShareData {
  return {
    ...data,
    shareUrls: buildShareUrls(data.title, data.snippet, data.articleUrl, referralUrl),
  }
}

/**
 * Logs a share action. Called from the API route after the share URL is opened.
 * Never throws.
 */
export async function logShare(
  articleId: string,
  channel: string,
  userId?: string,
  snippet?: string,
): Promise<void> {
  const db = prisma as unknown as PrismaExt
  try {
    await db.shareHistory.create({
      data: {
        articleId,
        channel,
        userId: userId ?? null,
        snippet: snippet?.slice(0, 300) ?? null,
      },
    })

    await trackEvent({
      event: "article_shared",
      userId,
      articleId,
      meta: { channel },
    })
  } catch (err) {
    console.error("[growth/share] Failed to log share:", err)
  }
}
