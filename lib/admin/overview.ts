/**
 * lib/admin/overview.ts
 *
 * Server-side data queries for the admin dashboard overview page.
 * Called directly from the server component — no HTTP hop.
 * Uses the PrismaExt cast pattern for models not in the mock client.
 */

import { prisma } from "../prisma"

// ---------------------------------------------------------------------------
// PrismaExt: models beyond the mock
// ---------------------------------------------------------------------------

type PrismaExt = typeof prisma & {
  articleAI: {
    count: (a: Record<string, unknown>) => Promise<number>
  }
  trendingTopic: {
    count: (a?: Record<string, unknown>) => Promise<number>
  }
  newsSource: {
    count: (a?: Record<string, unknown>) => Promise<number>
    findMany: (a: Record<string, unknown>) => Promise<Array<{
      id: string
      name: string
      type: string
      isActive: boolean
      priority: number
    }>>
  }
  digestSubscription: {
    count: (a?: Record<string, unknown>) => Promise<number>
  }
  messagingSubscription: {
    count: (a?: Record<string, unknown>) => Promise<number>
  }
  digestIssue: {
    findFirst: (a: Record<string, unknown>) => Promise<{
      id: string
      frequency: string
      generatedAt: Date
      articleIds: string[]
    } | null>
  }
  news: {
    count: (a?: Record<string, unknown>) => Promise<number>
    findMany: (a: Record<string, unknown>) => Promise<Array<{
      id: string
      title: string
      status: string
      publishedAt: Date
      sourceName: string
      rankingScore: number
    }>>
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverviewStats {
  news: {
    total: number
    today: number
    thisWeek: number
    published: number
    draft: number
    pendingReview: number
  }
  ai: {
    pending: number   // articleAI rows with summary=null and attempts<3
    failed: number    // articleAI rows with attempts>=3
    processed: number // articleAI rows with processedAt != null
  }
  trending: {
    count: number
  }
  sources: {
    total: number
    active: number
  }
  subscriptions: {
    email: number
    messaging: number
  }
  lastDigest: {
    generatedAt: Date | null
    frequency: string | null
    articleCount: number
  }
  recentNews: Array<{
    id: string
    title: string
    status: string
    publishedAt: Date
    sourceName: string
    rankingScore: number
  }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfDay(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function startOfWeek(): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 7)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getOverviewStats(): Promise<OverviewStats> {
  const db = prisma as unknown as PrismaExt
  const today = startOfDay()
  const weekAgo = startOfWeek()

  // Run independent counts in parallel
  const [
    newsTotal,
    newsToday,
    newsWeek,
    newsPublished,
    newsDraft,
    newsPending,
    aiPending,
    aiFailed,
    aiProcessed,
    trendingCount,
    sourcesTotal,
    sourcesActive,
    emailSubs,
    messagingSubs,
    lastDigest,
    recentNews,
  ] = await Promise.all([
    db.news.count(),
    db.news.count({ where: { publishedAt: { gte: today } } }),
    db.news.count({ where: { publishedAt: { gte: weekAgo } } }),
    db.news.count({ where: { status: "PUBLISHED" } }),
    db.news.count({ where: { status: "DRAFT" } }),
    db.news.count({ where: { status: "PENDING_REVIEW" } }),

    // AI pending: has an ArticleAI row but summary is null and attempts < 3
    db.articleAI.count({
      where: { summary: null, attempts: { lt: 3 } },
    }),

    // AI failed: 3+ attempts and still no summary
    db.articleAI.count({
      where: { summary: null, attempts: { gte: 3 } },
    }),

    // AI processed: has a processedAt timestamp
    db.articleAI.count({
      where: { processedAt: { not: null } },
    }),

    db.trendingTopic.count(),

    db.newsSource.count(),
    db.newsSource.count({ where: { isActive: true } }),

    db.digestSubscription.count({ where: { isActive: true } }),
    db.messagingSubscription.count({ where: { isActive: true } }),

    db.digestIssue.findFirst({
      orderBy: { generatedAt: "desc" },
      select: { id: true, frequency: true, generatedAt: true, articleIds: true },
    }),

    db.news.findMany({
      orderBy: { publishedAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        status: true,
        publishedAt: true,
        sourceName: true,
        rankingScore: true,
      },
    }),
  ])

  return {
    news: {
      total: newsTotal ?? 0,
      today: newsToday ?? 0,
      thisWeek: newsWeek ?? 0,
      published: newsPublished ?? 0,
      draft: newsDraft ?? 0,
      pendingReview: newsPending ?? 0,
    },
    ai: {
      pending: aiPending ?? 0,
      failed: aiFailed ?? 0,
      processed: aiProcessed ?? 0,
    },
    trending: {
      count: trendingCount ?? 0,
    },
    sources: {
      total: sourcesTotal ?? 0,
      active: sourcesActive ?? 0,
    },
    subscriptions: {
      email: emailSubs ?? 0,
      messaging: messagingSubs ?? 0,
    },
    lastDigest: {
      generatedAt: lastDigest?.generatedAt ?? null,
      frequency: lastDigest?.frequency ?? null,
      articleCount: lastDigest?.articleIds?.length ?? 0,
    },
    recentNews: (recentNews ?? []).map((n: {
      id: string
      title: string
      status: string
      publishedAt: Date
      sourceName: string
      rankingScore: number
    }) => ({
      id: n.id,
      title: n.title,
      status: n.status,
      publishedAt: n.publishedAt,
      sourceName: n.sourceName,
      rankingScore: n.rankingScore,
    })),
  }
}
