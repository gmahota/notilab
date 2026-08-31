/**
 * lib/editorial/article-service.ts — The editorial business layer.
 *
 * Everything an agent can do to an article passes through here, and so should
 * anything a future admin UI does. This module — not a route handler, and never
 * the agent — owns:
 *
 *   - which fields are editable at all;
 *   - which status transitions are legal;
 *   - the publish gate (an article reaches PUBLISHED only from APPROVED);
 *   - the provenance rules that AGENTS.md § AI-Content Correctness makes
 *     invariant.
 *
 * The transition table below is `docs/memory/business-rules.md` § Article
 * lifecycle expressed in code, including the part that is easy to lose: an
 * article must not become publicly visible without having passed review, no
 * matter which caller asks. An external agent that has been granted
 * `article.publish` can publish an approved article; it cannot publish a draft,
 * because that is not a permission question.
 *
 * Nothing here deletes. `archiveArticle` is the strongest destructive action
 * available, and it is a status change — the row, its provenance and its
 * history survive.
 */

import { prisma } from "@/lib/prisma"
import { AgentError } from "@/lib/agent/errors"
import { normalizeSlug, slugify } from "@/lib/slug"

// ── Domain vocabulary ───────────────────────────────────────────────────────

export const ARTICLE_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
  "ARCHIVED",
] as const
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number]

export const ARTICLE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const
export type ArticlePriority = (typeof ARTICLE_PRIORITIES)[number]

/**
 * Legal status moves. Read as: from → the set it may become.
 *
 * REJECTED and ARCHIVED have no outgoing edges. `business-rules.md` calls them
 * terminal, and that file outranks a task prompt (AGENTS.md § Authority Order),
 * so the Agent API cannot resurrect an article. The consequence — an agent
 * cannot undo its own archive — is real and is written up in
 * docs/agent-api.md § Limitations rather than quietly designed around.
 */
const ALLOWED_TRANSITIONS: Record<ArticleStatus, readonly ArticleStatus[]> = {
  DRAFT: ["PENDING_REVIEW", "REJECTED", "ARCHIVED"],
  PENDING_REVIEW: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["PUBLISHED", "DRAFT", "REJECTED", "ARCHIVED"],
  // Unpublishing returns an article to APPROVED, not to DRAFT: it was reviewed,
  // and it stays republishable without a second trip through the workflow.
  PUBLISHED: ["APPROVED", "ARCHIVED"],
  REJECTED: [],
  ARCHIVED: [],
}

export function canTransition(from: ArticleStatus, to: ArticleStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

// ── Read shapes ─────────────────────────────────────────────────────────────

const SUMMARY_SELECT = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  imageUrl: true,
  sourceUrl: true,
  sourceName: true,
  status: true,
  priority: true,
  trending: true,
  tags: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  readTime: true,
  rankingScore: true,
  importanceScore: true,
  authorId: true,
  category: { select: { id: true, name: true, slug: true, color: true } },
} as const

export interface ArticleSummary {
  id: string
  title: string
  slug: string | null
  summary: string | null
  imageUrl: string | null
  hasImage: boolean
  sourceUrl: string
  sourceName: string
  status: string
  priority: string
  trending: boolean
  tags: string[]
  publishedAt: string
  createdAt: string
  updatedAt: string
  readTime: number | null
  rankingScore: number
  importanceScore: number
  authorId: string | null
  category: { id: string; name: string; slug: string; color: string } | null
}

export interface ArticleDetail extends ArticleSummary {
  content: string
  aiSummary: string | null
  sentiment: string | null
  articleAI: {
    titleTranslated: string | null
    summary: string | null
    tldr: string | null
    whyItMatters: string | null
    importanceScore: number
    processedAt: string | null
  } | null
  stats: { reactions: number; reads: number; saves: number }
}

type SummaryRow = {
  id: string
  title: string
  slug: string | null
  summary: string | null
  imageUrl: string | null
  sourceUrl: string
  sourceName: string
  status: string
  priority: string
  trending: boolean
  tags: string[]
  publishedAt: Date
  createdAt: Date
  updatedAt: Date
  readTime: number | null
  rankingScore: number
  importanceScore: number
  authorId: string | null
  category: { id: string; name: string; slug: string; color: string } | null
}

function toSummary(row: SummaryRow): ArticleSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    imageUrl: row.imageUrl,
    // Surfaced explicitly because "find articles without an image" is a first-class
    // editorial question, and an agent should not have to infer it from null.
    hasImage: Boolean(row.imageUrl && row.imageUrl.trim() && row.imageUrl !== "/placeholder.svg"),
    sourceUrl: row.sourceUrl,
    sourceName: row.sourceName,
    status: String(row.status),
    priority: String(row.priority),
    trending: row.trending,
    tags: row.tags ?? [],
    publishedAt: row.publishedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    readTime: row.readTime,
    rankingScore: row.rankingScore,
    importanceScore: row.importanceScore,
    authorId: row.authorId,
    category: row.category,
  }
}

// ── Search ──────────────────────────────────────────────────────────────────

export const ARTICLE_SORTS = ["recent", "oldest", "updated", "ranking", "importance"] as const
export type ArticleSort = (typeof ARTICLE_SORTS)[number]

/** Hard ceiling on a page, whatever the caller asks for. */
export const MAX_PAGE_SIZE = 50
export const DEFAULT_PAGE_SIZE = 20

export interface SearchArticlesInput {
  query?: string
  status?: ArticleStatus
  published?: boolean
  categorySlug?: string
  tag?: string
  sourceName?: string
  authorId?: string
  priority?: ArticlePriority
  trending?: boolean
  hasImage?: boolean
  publishedFrom?: Date
  publishedTo?: Date
  sortBy?: ArticleSort
  limit?: number
  offset?: number
}

export interface SearchArticlesResult {
  articles: ArticleSummary[]
  pagination: { limit: number; offset: number; total: number; hasMore: boolean }
}

/** Placeholder images count as "no image" — see toSummary.hasImage. */
const NO_IMAGE_CONDITION = {
  OR: [
    { imageUrl: null },
    { imageUrl: "" },
    { imageUrl: "/placeholder.svg" },
  ],
}

export async function searchArticles(input: SearchArticlesInput): Promise<SearchArticlesResult> {
  if (input.status && input.published !== undefined) {
    throw new AgentError(
      "VALIDATION_FAILED",
      "Use either `status` or `published`, not both — they can contradict each other.",
    )
  }
  if (input.publishedFrom && input.publishedTo && input.publishedFrom > input.publishedTo) {
    throw new AgentError("VALIDATION_FAILED", "`publishedFrom` must not be after `publishedTo`.")
  }

  const limit = Math.min(Math.max(input.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)
  const offset = Math.max(input.offset ?? 0, 0)

  const and: Record<string, unknown>[] = []

  if (input.query) {
    and.push({
      OR: [
        { title: { contains: input.query, mode: "insensitive" } },
        { summary: { contains: input.query, mode: "insensitive" } },
        { content: { contains: input.query, mode: "insensitive" } },
        { tags: { has: input.query } },
      ],
    })
  }

  if (input.status) and.push({ status: input.status })
  if (input.published !== undefined) {
    and.push(input.published ? { status: "PUBLISHED" } : { NOT: { status: "PUBLISHED" } })
  }
  if (input.categorySlug) and.push({ category: { slug: input.categorySlug } })
  if (input.tag) and.push({ tags: { has: input.tag } })
  if (input.sourceName) and.push({ sourceName: { contains: input.sourceName, mode: "insensitive" } })
  if (input.authorId) and.push({ authorId: input.authorId })
  if (input.priority) and.push({ priority: input.priority })
  if (input.trending !== undefined) and.push({ trending: input.trending })
  if (input.hasImage !== undefined) {
    and.push(input.hasImage ? { NOT: NO_IMAGE_CONDITION } : NO_IMAGE_CONDITION)
  }
  if (input.publishedFrom) and.push({ publishedAt: { gte: input.publishedFrom } })
  if (input.publishedTo) and.push({ publishedAt: { lte: input.publishedTo } })

  const where = and.length > 0 ? { AND: and } : {}

  const orderBy = ((): Record<string, unknown>[] => {
    switch (input.sortBy ?? "recent") {
      case "oldest":
        return [{ publishedAt: "asc" }]
      case "updated":
        return [{ updatedAt: "desc" }]
      case "ranking":
        return [{ rankingScore: "desc" }, { publishedAt: "desc" }]
      case "importance":
        return [{ importanceScore: "desc" }, { publishedAt: "desc" }]
      default:
        return [{ publishedAt: "desc" }]
    }
  })()

  const [rows, total] = await Promise.all([
    prisma.news.findMany({
      where: where as never,
      orderBy: orderBy as never,
      take: limit,
      skip: offset,
      select: SUMMARY_SELECT,
    }) as Promise<SummaryRow[]>,
    prisma.news.count({ where: where as never }),
  ])

  return {
    articles: rows.map(toSummary),
    pagination: { limit, offset, total, hasMore: offset + rows.length < total },
  }
}

// ── Single read ─────────────────────────────────────────────────────────────

/** Accepts an id or a slug, because an agent that saw a URL has the slug. */
export async function getArticle(idOrSlug: string): Promise<ArticleDetail> {
  const row = (await prisma.news.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: {
      ...SUMMARY_SELECT,
      content: true,
      aiSummary: true,
      sentiment: true,
      articleAI: {
        select: {
          titleTranslated: true,
          summary: true,
          tldr: true,
          whyItMatters: true,
          importanceScore: true,
          processedAt: true,
        },
      },
      _count: { select: { reactions: true, readHistory: true, savedBy: true } },
    },
  })) as
    | (SummaryRow & {
        content: string
        aiSummary: string | null
        sentiment: string | null
        articleAI: {
          titleTranslated: string | null
          summary: string | null
          tldr: string | null
          whyItMatters: string | null
          importanceScore: number
          processedAt: Date | null
        } | null
        _count: { reactions: number; readHistory: number; savedBy: number }
      })
    | null

  if (!row) {
    throw new AgentError("ARTICLE_NOT_FOUND", `No article matches "${idOrSlug}".`)
  }

  return {
    ...toSummary(row),
    content: row.content,
    aiSummary: row.aiSummary,
    sentiment: row.sentiment,
    articleAI: row.articleAI
      ? {
          titleTranslated: row.articleAI.titleTranslated,
          summary: row.articleAI.summary,
          tldr: row.articleAI.tldr,
          whyItMatters: row.articleAI.whyItMatters,
          importanceScore: row.articleAI.importanceScore,
          processedAt: row.articleAI.processedAt?.toISOString() ?? null,
        }
      : null,
    stats: {
      reactions: row._count.reactions,
      reads: row._count.readHistory,
      saves: row._count.savedBy,
    },
  }
}

/** Minimal existence + status read, used before every mutation. */
async function loadForMutation(id: string): Promise<{
  id: string
  status: ArticleStatus
  title: string
  slug: string | null
  summary: string | null
  content: string
  imageUrl: string | null
  categoryId: string
  tags: string[]
  priority: ArticlePriority
  readTime: number | null
  publishedAt: Date
}> {
  const row = await prisma.news.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      title: true,
      slug: true,
      summary: true,
      content: true,
      imageUrl: true,
      categoryId: true,
      tags: true,
      priority: true,
      readTime: true,
      publishedAt: true,
    },
  })

  if (!row) throw new AgentError("ARTICLE_NOT_FOUND", `No article with id "${id}".`)
  return row as never
}

async function resolveCategoryId(slug: string): Promise<string> {
  const category = await prisma.category.findUnique({ where: { slug }, select: { id: true } })
  if (!category) {
    throw new AgentError("CATEGORY_NOT_FOUND", `No category with slug "${slug}".`)
  }
  return category.id
}

function assertHttpUrl(value: string, field: string): void {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new AgentError("VALIDATION_FAILED", `\`${field}\` must be an absolute URL.`)
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AgentError("VALIDATION_FAILED", `\`${field}\` must use http or https.`)
  }
}

// ── Create ──────────────────────────────────────────────────────────────────

export interface CreateArticleInput {
  title: string
  content: string
  categorySlug: string
  summary?: string
  tags?: string[]
  imageUrl?: string
  sourceUrl?: string
  sourceName?: string
  publishedAt?: Date
  readTime?: number
}

/**
 * Creates an article as a DRAFT. Always — there is no parameter that skips the
 * workflow, because AGENTS.md forbids AI-originated content going straight to
 * the public site.
 *
 * Provenance: `sourceUrl` and `sourceName` are required by the schema and must
 * never be faked into looking like someone else's reporting. When the agent
 * supplies no source, the article is stamped with an internal
 * `notilab:agent/<id>/...` URI and a byline that names the agent. That is
 * traceable and honest; inventing an outlet would not be.
 */
export async function createArticle(
  input: CreateArticleInput,
  agentId: string,
): Promise<ArticleDetail> {
  const categoryId = await resolveCategoryId(input.categorySlug)

  if (input.imageUrl) assertHttpUrl(input.imageUrl, "imageUrl")
  if (input.sourceUrl) assertHttpUrl(input.sourceUrl, "sourceUrl")

  const sourceUrl =
    input.sourceUrl ??
    `notilab:agent/${encodeURIComponent(agentId)}/${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`

  const sourceName = input.sourceName ?? `NotiLab (agent:${agentId})`

  try {
    const created = await prisma.news.create({
      data: {
        title: input.title,
        slug: slugify(input.title),
        content: input.content,
        summary: input.summary ?? null,
        imageUrl: input.imageUrl ?? null,
        sourceUrl,
        sourceName,
        publishedAt: input.publishedAt ?? new Date(),
        categoryId,
        tags: input.tags ?? [],
        readTime: input.readTime ?? null,
        // Not negotiable — see the doc comment above.
        status: "DRAFT",
      },
      select: { id: true },
    })

    return await getArticle(created.id)
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      throw new AgentError(
        "DUPLICATE_SOURCE_URL",
        "An article with this sourceUrl already exists. Update it instead of creating a duplicate.",
      )
    }
    throw err
  }
}

// ── Update ──────────────────────────────────────────────────────────────────

/**
 * The editable surface. Everything absent from this list is unreachable through
 * the service, which is what makes the guarantee structural rather than a
 * matter of the route remembering to filter:
 *
 *   status            → only through the transition functions below
 *   publishedAt       → only through publish / schedule
 *   sourceUrl/Name    → provenance, immutable once written
 *   trending          → derived by the ranking cron, never asserted
 *   rankingScore      → derived
 *   importanceScore   → derived
 *   authorId/reviewerId → identity of humans, not an agent's to assign
 */
export interface UpdateArticleInput {
  title?: string
  summary?: string
  content?: string
  categorySlug?: string
  tags?: string[]
  priority?: ArticlePriority
  readTime?: number
}

export interface MutationResult {
  article: ArticleDetail
  /** Per-field before/after, ready for the audit trail. */
  changes: Record<string, { before: unknown; after: unknown }>
}

export async function updateArticle(id: string, patch: UpdateArticleInput): Promise<MutationResult> {
  const current = await loadForMutation(id)

  const data: Record<string, unknown> = {}
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}

  const set = (field: string, previous: unknown, next: unknown) => {
    if (JSON.stringify(previous ?? null) === JSON.stringify(next ?? null)) return
    data[field] = next
    before[field] = previous ?? null
    after[field] = next ?? null
  }

  if (patch.title !== undefined) set("title", current.title, patch.title)
  if (patch.summary !== undefined) set("summary", current.summary, patch.summary)
  if (patch.content !== undefined) set("content", current.content, patch.content)
  if (patch.tags !== undefined) set("tags", current.tags, patch.tags)
  if (patch.priority !== undefined) set("priority", current.priority, patch.priority)
  if (patch.readTime !== undefined) set("readTime", current.readTime, patch.readTime)

  if (patch.categorySlug !== undefined) {
    const categoryId = await resolveCategoryId(patch.categorySlug)
    set("categoryId", current.categoryId, categoryId)
  }

  if (Object.keys(data).length === 0) {
    throw new AgentError(
      "NO_FIELDS_TO_UPDATE",
      "Nothing to change — every supplied field already holds that value.",
    )
  }

  await prisma.news.update({ where: { id }, data: data as never })

  return {
    article: await getArticle(id),
    changes: Object.fromEntries(
      Object.keys(after).map((key) => [key, { before: before[key], after: after[key] }]),
    ),
  }
}

// ── SEO ─────────────────────────────────────────────────────────────────────

export interface UpdateSeoInput {
  slug?: string
  /** Doubles as the meta description — NotiLab has no separate SEO column. */
  summary?: string
  title?: string
}

/**
 * Updates the fields that drive search presentation.
 *
 * NotiLab has no `seoTitle` / `seoDescription` columns and no `generateMetadata`
 * on the article page, so there is nothing dedicated to write to. Rather than
 * add inert columns, this maps the SEO vocabulary onto the fields that actually
 * reach a crawler today: the URL slug, the headline, and the summary that
 * serves as the description. The proper migration is proposed in
 * docs/agent-api.md § Limitations.
 */
export async function updateArticleSeo(id: string, patch: UpdateSeoInput): Promise<MutationResult> {
  const current = await loadForMutation(id)

  const data: Record<string, unknown> = {}
  const changes: Record<string, { before: unknown; after: unknown }> = {}

  if (patch.slug !== undefined) {
    const slug = normalizeSlug(patch.slug)
    if (slug.length < 3) {
      throw new AgentError("VALIDATION_FAILED", "`slug` must contain at least 3 usable characters.")
    }
    if (slug !== current.slug) {
      const clash = await prisma.news.findFirst({
        where: { slug, NOT: { id } },
        select: { id: true },
      })
      if (clash) {
        throw new AgentError(
          "VALIDATION_FAILED",
          `The slug "${slug}" is already used by another article.`,
        )
      }
      data.slug = slug
      changes.slug = { before: current.slug, after: slug }
    }
  }

  if (patch.title !== undefined && patch.title !== current.title) {
    data.title = patch.title
    changes.title = { before: current.title, after: patch.title }
  }

  if (patch.summary !== undefined && patch.summary !== current.summary) {
    data.summary = patch.summary
    changes.summary = { before: current.summary, after: patch.summary }
  }

  if (Object.keys(data).length === 0) {
    throw new AgentError("NO_FIELDS_TO_UPDATE", "Nothing to change — the SEO fields already match.")
  }

  await prisma.news.update({ where: { id }, data: data as never })
  return { article: await getArticle(id), changes }
}

// ── Media ───────────────────────────────────────────────────────────────────

/** `imageUrl: null` clears the lead image, which is how an agent flags one for replacement. */
export async function setArticleImage(
  id: string,
  imageUrl: string | null,
): Promise<MutationResult> {
  const current = await loadForMutation(id)
  if (imageUrl) assertHttpUrl(imageUrl, "imageUrl")

  if ((current.imageUrl ?? null) === imageUrl) {
    throw new AgentError("NO_FIELDS_TO_UPDATE", "The article already has this image.")
  }

  await prisma.news.update({ where: { id }, data: { imageUrl } })

  return {
    article: await getArticle(id),
    changes: { imageUrl: { before: current.imageUrl ?? null, after: imageUrl } },
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

export interface TransitionOptions {
  /** Only honoured by the PUBLISHED transition. */
  publishedAt?: Date
}

/**
 * The single door to `News.status`. Every lifecycle tool goes through it, so
 * the transition table cannot be bypassed by adding another tool later.
 *
 * Moving to the status an article already holds is a success, not an error:
 * that is what makes `publish_article` safe for an agent to retry.
 */
export async function transitionArticle(
  id: string,
  target: ArticleStatus,
  options: TransitionOptions = {},
): Promise<MutationResult & { alreadyInState: boolean }> {
  const current = await loadForMutation(id)

  if (current.status === target) {
    return { article: await getArticle(id), changes: {}, alreadyInState: true }
  }

  if (!canTransition(current.status, target)) {
    // The publish gate gets its own code: it is the transition an agent is most
    // likely to attempt, and "approve it first" is actionable where a generic
    // "invalid transition" is not.
    if (target === "PUBLISHED") {
      throw new AgentError(
        "ARTICLE_NOT_APPROVED",
        `An article must be APPROVED before publishing. This one is ${current.status}. ` +
          "Use submit_article_for_review and approve_article first.",
        { currentStatus: current.status },
      )
    }
    throw new AgentError(
      "INVALID_STATUS_TRANSITION",
      `Cannot move an article from ${current.status} to ${target}.`,
      { currentStatus: current.status, target, allowed: [...ALLOWED_TRANSITIONS[current.status]] },
    )
  }

  const data: Record<string, unknown> = { status: target }
  const changes: Record<string, { before: unknown; after: unknown }> = {
    status: { before: current.status, after: target },
  }

  // publishedAt is left alone unless explicitly given. For a syndicated article
  // it is the source's publication date, and silently rewriting it to "now"
  // would reorder the public feed on every republish.
  if (target === "PUBLISHED" && options.publishedAt) {
    data.publishedAt = options.publishedAt
    changes.publishedAt = {
      before: current.publishedAt.toISOString(),
      after: options.publishedAt.toISOString(),
    }
  }

  await prisma.news.update({ where: { id }, data: data as never })

  return { article: await getArticle(id), changes, alreadyInState: false }
}
