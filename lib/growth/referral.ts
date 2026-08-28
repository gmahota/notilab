/**
 * lib/growth/referral.ts
 *
 * Referral attribution engine for the WhatsApp viral loop.
 *
 * Responsibilities:
 *   - Generate a unique 8-char referral code per share action
 *   - Load ArticleShare + its article for the landing page
 *   - Record a visit from a share link (dedup by ipHash within 1h)
 *   - Mark a visitor as converted (engaged with content)
 *   - Increment counters on ArticleShare atomically
 *
 * No external dependencies — uses crypto.randomBytes for code generation.
 */

import { createHash, randomBytes } from "crypto"
import { prisma } from "../prisma"
import { BASE_URL } from "../base-url"

// ---------------------------------------------------------------------------
// PrismaExt — only the tables we need here
// ---------------------------------------------------------------------------

type ArticleShareRow = {
  id: string
  code: string
  articleId: string
  sharedByUserId: string | null
  channel: string
  snippet: string | null
  visitCount: number
  newUserCount: number
  createdAt: Date
}

type ShareVisitRow = {
  id: string
  shareId: string
  visitorUserId: string | null
  isNewUser: boolean
  converted: boolean
}

type ArticleForLanding = {
  id: string
  title: string
  slug: string | null
  summary: string | null
  imageUrl: string | null
  sourceUrl: string
  sourceName: string
  publishedAt: Date
  category: { name: string; color: string } | null
  articleAI: {
    tldr: string | null
    whyItMatters: string | null
    explainLikeIm10: string | null
    shareText: string | null
  } | null
}

type PrismaExt = typeof prisma & {
  articleShare: {
    create: (a: { data: Record<string, unknown> }) => Promise<ArticleShareRow>
    findUnique: (a: Record<string, unknown>) => Promise<(ArticleShareRow & {
      article: ArticleForLanding | null
    }) | null>
    update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<ArticleShareRow>
  }
  shareVisit: {
    findFirst: (a: Record<string, unknown>) => Promise<ShareVisitRow | null>
    create: (a: { data: Record<string, unknown> }) => Promise<ShareVisitRow>
    update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<ShareVisitRow>
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReferralShareResult {
  code: string
  referralUrl: string
}

export interface LandingPageData {
  share: ArticleShareRow
  article: ArticleForLanding
  referralUrl: string
}

export interface VisitResult {
  visitId: string
  isNewVisit: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generates a cryptographically random 8-char URL-safe code. */
function generateCode(): string {
  // 6 bytes → 12 hex chars → first 8 used (collision probability negligible at this scale)
  return randomBytes(6).toString("hex").slice(0, 8)
}

/** One-way hash of IP for deduplication. Never store raw IPs. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip + (process.env.IP_HASH_SALT ?? "notilab")).digest("hex").slice(0, 32)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a new ArticleShare row and returns the unique referral code + URL.
 * Call this when a user initiates a share.
 */
export async function createShareCode(input: {
  articleId: string
  channel: string
  snippet?: string
  sharedByUserId?: string
}): Promise<ReferralShareResult> {
  const db = prisma as unknown as PrismaExt
  const code = generateCode()

  await db.articleShare.create({
    data: {
      code,
      articleId: input.articleId,
      channel: input.channel,
      snippet: input.snippet ?? null,
      sharedByUserId: input.sharedByUserId ?? null,
    },
  })

  return { code, referralUrl: `${BASE_URL}/s/${code}` }
}

/**
 * Loads the ArticleShare + full article for the landing page.
 * Returns null if code doesn't exist.
 */
export async function getLandingData(code: string): Promise<LandingPageData | null> {
  const db = prisma as unknown as PrismaExt

  const share = await db.articleShare.findUnique({
    where: { code },
    include: {
      article: {
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          imageUrl: true,
          sourceUrl: true,
          sourceName: true,
          publishedAt: true,
          category: { select: { name: true, color: true } },
          articleAI: {
            select: {
              tldr: true,
              whyItMatters: true,
              explainLikeIm10: true,
              shareText: true,
            },
          },
        },
      },
    },
  })

  if (!share?.article) return null

  return {
    share,
    article: share.article,
    referralUrl: `${BASE_URL}/s/${code}`,
  }
}

/**
 * Records a visit to a share landing page.
 * Deduplicates by ipHash within a 1-hour window to avoid count inflation.
 * Increments ArticleShare.visitCount atomically.
 * Returns the visit id and whether this was a new (non-dedup) visit.
 */
export async function recordVisit(input: {
  shareId: string
  visitorUserId?: string
  isNewUser?: boolean
  ipHash?: string
}): Promise<VisitResult> {
  const db = prisma as unknown as PrismaExt

  // Dedup: same IP hash within the last hour
  if (input.ipHash) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const existing = await db.shareVisit.findFirst({
      where: {
        shareId: input.shareId,
        ipHash: input.ipHash,
        createdAt: { gte: oneHourAgo },
      },
    })
    if (existing) {
      return { visitId: existing.id, isNewVisit: false }
    }
  }

  const visit = await db.shareVisit.create({
    data: {
      shareId: input.shareId,
      visitorUserId: input.visitorUserId ?? null,
      isNewUser: input.isNewUser ?? false,
      converted: false,
      ipHash: input.ipHash ?? null,
    },
  })

  // Increment counters
  const updateData: Record<string, unknown> = {
    visitCount: { increment: 1 },
  }
  if (input.isNewUser) {
    updateData.newUserCount = { increment: 1 }
  }

  await db.articleShare.update({
    where: { id: input.shareId },
    data: updateData,
  })

  return { visitId: visit.id, isNewVisit: true }
}

/**
 * Marks a share visit as converted (user engaged: liked, saved, opened chat, etc.).
 * Idempotent — safe to call multiple times.
 */
export async function markConverted(visitId: string): Promise<void> {
  const db = prisma as unknown as PrismaExt
  await db.shareVisit.update({
    where: { id: visitId },
    data: { converted: true },
  })
}
