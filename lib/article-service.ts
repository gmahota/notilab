/**
 * lib/article-service.ts
 *
 * Server-side reads for the article detail page.
 *
 * This replaced `lib/news-data.tsx`, which returned one hardcoded article —
 * an EU AI-regulation story dated January 2024, complete with invented
 * reaction counts, a fabricated byline and three fake "related" articles —
 * for **every** id. Every card in the app links to that page, so the whole
 * product bottomed out in the same fictional story.
 *
 * Note `lib/news-service.ts` cannot be used here: despite the name it is a
 * client-side `fetch` wrapper around the API routes, so it has no meaning in a
 * server component. Server reads go through Prisma, per AGENTS.md § Prisma
 * rules.
 */

import { prisma } from "./prisma"

export interface ArticleReaction {
  type: string
  count: number
}

export interface RelatedArticle {
  id: string
  title: string
  imageUrl: string
  category: string
}

export interface ArticleDetail {
  id: string
  title: string
  summary: string
  content: string
  imageUrl: string
  sourceUrl: string
  sourceName: string
  publishedAt: Date
  category: { name: string; slug: string; color: string }
  tags: string[]
  trending: boolean
  priority: string
  sentiment: string
  readTime: number
  /**
   * Byline. The schema has no author relation, and syndicated articles are not
   * written by us — so this carries the originating outlet rather than a person.
   * The old mock invented "Ana Silva"; the feed API still returns a hardcoded
   * "NotiLab Team", which claims authorship of other outlets' reporting.
   */
  author: string
  views: number
  reactions: ArticleReaction[]
  articleAI: {
    tldr: string | null
    whyItMatters: string | null
    explainLikeIm10: string | null
    importanceScore: number
  } | null
  relatedNews: RelatedArticle[]
}

/** How many same-category articles to offer as related reading. */
const RELATED_LIMIT = 3

/**
 * Loads one article by id. Returns null when it does not exist, so the caller
 * can render a 404 instead of inventing content.
 */
export async function getArticleDetail(id: string): Promise<ArticleDetail | null> {
  const article = await prisma.news.findUnique({
    where: { id },
    include: {
      category: { select: { name: true, slug: true, color: true } },
      articleAI: {
        select: {
          titleTranslated: true,
          tldr: true,
          whyItMatters: true,
          explainLikeIm10: true,
          importanceScore: true,
        },
      },
      reactions: { select: { type: true } },
      _count: { select: { readHistory: true } },
    },
  })

  if (!article) return null

  // Collapse the reaction rows into per-type counts. The old mock hardcoded
  // 342 likes / 89 loves / 23 angry.
  const reactionCounts = new Map<string, number>()
  for (const reaction of article.reactions) {
    reactionCounts.set(reaction.type, (reactionCounts.get(reaction.type) ?? 0) + 1)
  }

  const relatedNews = article.categoryId
    ? await prisma.news.findMany({
        where: {
          status: "PUBLISHED",
          categoryId: article.categoryId,
          id: { not: article.id },
        },
        orderBy: { publishedAt: "desc" },
        take: RELATED_LIMIT,
        select: {
          id: true,
          title: true,
          imageUrl: true,
          category: { select: { name: true } },
        },
      })
    : []

  return {
    id: article.id,
    // Must match what the feed card showed, or clicking a Portuguese headline
    // would open a page titled in Spanish.
    title: article.articleAI?.titleTranslated || article.title,
    summary: article.summary ?? "",
    content: article.content,
    imageUrl: article.imageUrl ?? "/placeholder.svg",
    sourceUrl: article.sourceUrl,
    sourceName: article.sourceName,
    publishedAt: article.publishedAt,
    category: {
      name: article.category?.name ?? "",
      slug: article.category?.slug ?? "",
      color: article.category?.color ?? "#007BFF",
    },
    tags: article.tags ?? [],
    trending: article.trending,
    priority: String(article.priority),
    sentiment: article.sentiment ?? "neutral",
    readTime: article.readTime ?? 3,
    author: article.sourceName,
    views: article._count.readHistory,
    reactions: [...reactionCounts.entries()].map(([type, count]) => ({ type, count })),
    articleAI: article.articleAI
      ? {
          tldr: article.articleAI.tldr,
          whyItMatters: article.articleAI.whyItMatters,
          explainLikeIm10: article.articleAI.explainLikeIm10,
          importanceScore: article.articleAI.importanceScore,
        }
      : null,
    relatedNews: relatedNews.map((r: (typeof relatedNews)[number]) => ({
      id: r.id,
      title: r.title,
      imageUrl: r.imageUrl ?? "/placeholder.svg",
      category: r.category?.name ?? "",
    })),
  }
}
