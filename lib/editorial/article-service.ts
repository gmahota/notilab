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
import {
  ALLOWED_TRANSITIONS,
  ARTICLE_PRIORITIES,
  ARTICLE_STATUSES,
  canTransition,
  stageForStatus,
  type ArticlePriority,
  type ArticleStatus,
} from "./transitions"
import { canClearReview, canRoleTransition } from "./permissions"
import { checkImageRights } from "@/lib/ingestion/image-rights"
import type { UserRole } from "@/lib/generated/prisma"

// ── Domain vocabulary ───────────────────────────────────────────────────────

// The lifecycle vocabulary lives in ./transitions so that ./permissions can
// read the transition table without importing this module — which imports
// ./permissions, and would otherwise close the cycle. Re-exported here because
// every existing caller imports these names from this file.
export {
  ALLOWED_TRANSITIONS,
  ARTICLE_PRIORITIES,
  ARTICLE_STATUSES,
  canTransition,
  stageForStatus,
}
export type { ArticlePriority, ArticleStatus }

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

/**
 * The human making the move.
 *
 * Optional on `TransitionOptions`, and the asymmetry is deliberate. Supplying
 * an actor turns on three things at once — the per-edge role check, the
 * submission preconditions, and the `AdminAction` audit row — because all
 * three are properties of *a person acting in the CMS*. The Agent API and the
 * scheduler cron pass no actor: they are gated by their own permission scopes
 * and write their own audit trail, and both already sit behind the same
 * `ALLOWED_TRANSITIONS` table, which is the part that must hold for everyone.
 */
export interface TransitionActor {
  id: string
  name: string
  role: UserRole
}

export interface TransitionOptions {
  /** Only honoured by the PUBLISHED transition. */
  publishedAt?: Date
  /** The signed-in human. See TransitionActor — its presence changes behaviour. */
  actor?: TransitionActor
  /** Free text from the reviewer, kept on the workflow row and in the audit. */
  note?: string
}

/**
 * Why an article may not yet be submitted for review.
 *
 * Returned rather than thrown so the CMS can render every unmet condition at
 * once — a reviewer told to fix one thing, who then hits the next refusal, is
 * a reviewer who stops trusting the queue.
 */
export interface SubmissionBlocker {
  code:
    | "NO_REWRITE"
    | "REWRITE_FAILED"
    | "MISSING_PROVENANCE"
    | "IMAGE_NOT_ALLOWED"
    | "NO_AUTHOR"
  /** Portuguese, actionable, naming what to do — not what went wrong. */
  message: string
}

/**
 * The § 3.3 gate: what must hold before an ingested article may be submitted.
 *
 * Only ingested articles are held to the rewrite condition, and the test for
 * "ingested" is the presence of an `ArticleAI` row: `lib/ingestion/ai-queue.ts`
 * creates one for every collected article, and `createArticle` creates none.
 * An article written by a human or by the Agent API is already NotiLab's own
 * text, so demanding a rewrite of it would be asking us to rewrite ourselves.
 */
export async function submissionBlockers(id: string): Promise<SubmissionBlocker[]> {
  const row = (await prisma.news.findUnique({
    where: { id },
    select: {
      sourceUrl: true,
      sourceName: true,
      imageUrl: true,
      authorId: true,
      articleAI: {
        select: { contentRewritten: true, rewrittenAt: true, rewriteError: true },
      },
    },
  })) as {
    sourceUrl: string | null
    sourceName: string | null
    imageUrl: string | null
    authorId: string | null
    articleAI: {
      contentRewritten: string | null
      rewrittenAt: Date | null
      rewriteError: string | null
    } | null
  } | null

  if (!row) throw new AgentError("ARTICLE_NOT_FOUND", `No article with id "${id}".`)

  const blockers: SubmissionBlocker[] = []

  if (!row.sourceUrl?.trim() || !row.sourceName?.trim()) {
    blockers.push({
      code: "MISSING_PROVENANCE",
      message: "O artigo perdeu a fonte (ligação ou nome). Não pode seguir para revisão.",
    })
  }

  // Only articles that came through ingestion carry an ArticleAI row.
  if (row.articleAI) {
    const hasRewrite = Boolean(
      row.articleAI.rewrittenAt && row.articleAI.contentRewritten?.trim(),
    )
    if (!hasRewrite) {
      // A failed attempt and a never-attempted article need different actions
      // from the editor, so they are different blockers.
      blockers.push(
        row.articleAI.rewriteError
          ? {
              code: "REWRITE_FAILED",
              message:
                "A redacção automática falhou. Escreva o texto à mão ou arquive o artigo.",
            }
          : {
              code: "NO_REWRITE",
              message:
                "Ainda não existe texto da NotiLab para este artigo — só o texto da fonte.",
            },
      )
    }
  }

  // § 4: a rejected image is never a blocker — the article runs without one.
  // What *is* refused is a persisted URL that the allowlist would not accept,
  // which can only mean the row predates the rule or was written around it.
  const image = row.imageUrl?.trim()
  if (
    image &&
    image !== "/placeholder.svg" &&
    checkImageRights(image, row.sourceUrl ?? "").url === null
  ) {
    blockers.push({
      code: "IMAGE_NOT_ALLOWED",
      message:
        "A imagem não vem de um domínio licenciado. Remova-a — publicar sem imagem é uma escolha normal.",
    })
  }

  if (!row.authorId) {
    blockers.push({
      code: "NO_AUTHOR",
      message: "Falta o autor. Um artigo em revisão tem de ter alguém responsável por ele.",
    })
  }

  return blockers
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

  const actor = options.actor

  // ── The person ──────────────────────────────────────────────────────────
  //
  // Checked per edge against an explicit role list. Never `role >= SUPERVISOR`
  // — see the note at the top of ./permissions for why that comparison hands
  // publish rights to the marketing team.
  if (actor && !canRoleTransition(actor.role, current.status, target)) {
    throw new AgentError(
      "FORBIDDEN",
      `O papel ${actor.role} não pode mover um artigo de ${current.status} para ${target}.`,
      { role: actor.role, currentStatus: current.status, target },
    )
  }

  // ── The § 3.3 gate ──────────────────────────────────────────────────────
  //
  // Submission is where an ingested article stops being raw source text and
  // becomes something we stand behind, so it is the one edge with conditions
  // beyond the transition table.
  if (actor && target === "PENDING_REVIEW" && current.status === "DRAFT") {
    const blockers = await submissionBlockers(id)
    if (blockers.length > 0) {
      throw new AgentError(
        "VALIDATION_FAILED",
        `Este artigo ainda não pode seguir para revisão: ${blockers
          .map((b) => b.message)
          .join(" ")}`,
        { blockers },
      )
    }
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

  // No actor — the Agent API or the scheduler cron. Unchanged behaviour, and
  // deliberately a single statement: those callers keep their own audit trail,
  // and widening this path would mean every mocked test grows a transaction.
  if (!actor) {
    await prisma.news.update({ where: { id }, data: data as never })
    return { article: await getArticle(id), changes, alreadyInState: false }
  }

  // ── Accountability ──────────────────────────────────────────────────────
  //
  // `reviewerId` records who vouched for the article. It is written once, by
  // whoever first takes responsibility — the REVISOR who clears the review, or
  // the SUPERVISOR who approves where no separate review happened. It is never
  // overwritten afterwards, because the question it answers is "who cleared
  // this", not "who touched it last".
  //
  // `current.status === "PENDING_REVIEW"` is load-bearing, and its absence was
  // a defect: the target alone does not tell you a review happened. Two legal
  // edges reach these targets from somewhere nobody reviewed anything, and both
  // were stamping an actor who had reviewed nothing:
  //
  //   PUBLISHED -> APPROVED   the unpublish act. A SUPERVISOR taking down a
  //                           legacy article nobody ever reviewed was recorded
  //                           as its reviewer.
  //   DRAFT -> REJECTED       killing a draft before it was ever submitted.
  //                           The review it is being credited for never began.
  //
  // This is not cosmetic. A false stamp silently satisfies invariant 12 — a
  // mocambique/africa-do-sul story never reaches PUBLISHED without a human
  // reviewer — which is the one rule reviewerId exists to make checkable.
  // Rejecting from APPROVED with a null reviewerId now leaves it null, which is
  // the honest answer: nobody reviewed it.
  const stampsReviewer =
    current.status === "PENDING_REVIEW" && (target === "APPROVED" || target === "REJECTED")
  if (stampsReviewer) {
    const existing = (await prisma.news.findUnique({
      where: { id },
      select: { reviewerId: true },
    })) as { reviewerId: string | null } | null

    if (!existing?.reviewerId) {
      data.reviewerId = actor.id
      changes.reviewerId = { before: null, after: actor.id }
    }
  }

  const stage = stageForStatus(target, { hasRewrite: true })

  // One transaction. An audit row that can be lost independently of the status
  // change it describes is not an audit trail — invariant 10 says *every*
  // transition names its actor, and "every" has to survive a failed write.
  await prisma.$transaction([
    prisma.news.update({ where: { id }, data: data as never }),

    prisma.adminAction.create({
      data: {
        userId: actor.id,
        action: `TRANSITION_${target}`,
        resource: "NEWS",
        resourceId: id,
        details: {
          from: current.status,
          to: target,
          actorName: actor.name,
          actorRole: actor.role,
          // Recorded explicitly so a later audit can tell a two-person review
          // from a supervisor who did both halves — the row looks identical
          // otherwise, and the difference is the whole point of the two roles.
          reviewerStampedHere: Boolean(data.reviewerId),
          note: options.note ?? null,
          changes,
        } as never,
      },
    }),

    ...(stage
      ? [
          prisma.contentWorkflow.upsert({
            where: { newsId: id },
            create: { newsId: id, stage, assignedTo: actor.id, notes: options.note ?? null },
            update: { stage, assignedTo: actor.id, notes: options.note ?? null },
          }),
        ]
      : []),
  ])

  return { article: await getArticle(id), changes, alreadyInState: false }
}

/**
 * The `REVIEW → APPROVAL` handoff — the REVISOR's act.
 *
 * It moves no status, which is exactly why it needs to exist as its own
 * function: `News.status` stays `PENDING_REVIEW` across both halves of the
 * review, so the transition table cannot express it. What it records is that
 * a reviewer has read the article and is passing it to an approver.
 *
 * This is the structural reason REVISOR and SUPERVISOR are two roles. A
 * REVISOR who could reach APPROVED alone would make the second role decorative.
 */
export async function clearReview(
  id: string,
  actor: TransitionActor,
  note?: string,
): Promise<{ stage: string; reviewerId: string }> {
  const row = (await prisma.news.findUnique({
    where: { id },
    select: { status: true, reviewerId: true },
  })) as { status: string; reviewerId: string | null } | null

  if (!row) throw new AgentError("ARTICLE_NOT_FOUND", `No article with id "${id}".`)

  if (row.status !== "PENDING_REVIEW") {
    throw new AgentError(
      "INVALID_STATUS_TRANSITION",
      `Só se pode concluir a revisão de um artigo em revisão. Este está em ${row.status}.`,
      { currentStatus: row.status },
    )
  }

  if (!canClearReview(actor.role)) {
    throw new AgentError("FORBIDDEN", `O papel ${actor.role} não pode concluir uma revisão.`, {
      role: actor.role,
    })
  }

  const reviewerId = row.reviewerId ?? actor.id

  await prisma.$transaction([
    prisma.news.update({ where: { id }, data: { reviewerId } as never }),

    prisma.contentWorkflow.upsert({
      where: { newsId: id },
      create: { newsId: id, stage: "APPROVAL", assignedTo: null, notes: note ?? null },
      update: { stage: "APPROVAL", assignedTo: null, notes: note ?? null },
    }),

    prisma.adminAction.create({
      data: {
        userId: actor.id,
        action: "CLEAR_REVIEW",
        resource: "NEWS",
        resourceId: id,
        details: {
          actorName: actor.name,
          actorRole: actor.role,
          stage: { from: "REVIEW", to: "APPROVAL" },
          note: note ?? null,
        } as never,
      },
    }),
  ])

  return { stage: "APPROVAL", reviewerId }
}
