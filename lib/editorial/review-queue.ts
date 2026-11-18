/**
 * lib/editorial/review-queue.ts — What the newsroom sees, and in what order.
 *
 * Phase 4(iii) of `docs/manager/strategy/ingestion-editorial-gate.md`. Two
 * reads, both shaped by one requirement from R4:
 *
 *   **A reviewer who cannot see the source cannot detect a hallucination.**
 *
 * So `getReviewArticle` returns the source's text and NotiLab's rewrite as two
 * fields of equal standing, never one merged "current body". The whole reason
 * `News.content` is immutable is that it is the evidence a fabrication claim is
 * checked against; hiding it behind the rewrite in the one screen where that
 * check happens would waste the guarantee.
 *
 * ── Ordering ────────────────────────────────────────────────────────────────
 *
 * The queue is ordered by `importanceScore`, not by date. Phase 0 measured
 * intake at 15.3 articles a day against a review capacity that has no headroom,
 * so the queue will not be emptied every day. Ordering by importance means an
 * uncleared queue loses the *least important* articles to the age-out rather
 * than the oldest — strategy R3(b). Ordering by date would mean the backlog
 * eats whatever happens to be at the bottom, which is a decision nobody made.
 */

import { prisma } from "@/lib/prisma"
import { AgentError } from "@/lib/agent/errors"
import { checkImageRights } from "@/lib/ingestion/image-rights"
import { submissionBlockers, type SubmissionBlocker } from "./article-service"
import { allowedTargetsForRole, canClearReview } from "./permissions"
import { ARTICLE_STATUSES, type ArticleStatus } from "./transitions"
import type { UserRole, WorkflowStage } from "@/lib/generated/prisma"

/**
 * Where the rewrite stands, as one word the CMS can filter and colour on.
 *
 *   none     — not an ingested article, so no rewrite is expected
 *   pending  — collected, the worker has not reached it yet
 *   failed   — attempted and failed; needs a human to write it or archive it
 *   ready    — NotiLab's text exists and the last attempt succeeded
 */
export type RewriteState = "none" | "pending" | "failed" | "ready"

export interface ReviewQueueItem {
  id: string
  /** The source's headline. Kept for traceability; never shown alone as ours. */
  sourceTitle: string
  /** NotiLab's headline, once a rewrite exists. */
  rewrittenTitle: string | null
  status: ArticleStatus
  stage: WorkflowStage | null
  rewriteState: RewriteState
  rewriteAttempts: number
  rewriteError: string | null
  sourceName: string
  sourceUrl: string
  imageUrl: string | null
  /** False for null, empty, placeholder, and any host the allowlist refuses. */
  imagePublishable: boolean
  category: { id: string; name: string; slug: string; color: string } | null
  author: { id: string; name: string } | null
  reviewer: { id: string; name: string } | null
  priority: string
  importanceScore: number
  /** The source's publication date — never the moment we published it. */
  publishedAt: string
  createdAt: string
}

export interface ReviewQueueInput {
  status?: ArticleStatus
  stage?: WorkflowStage
  rewriteState?: RewriteState
  query?: string
  limit?: number
  offset?: number
}

export const MAX_QUEUE_PAGE = 50
const DEFAULT_QUEUE_PAGE = 25

const QUEUE_SELECT = {
  id: true,
  title: true,
  status: true,
  sourceName: true,
  sourceUrl: true,
  imageUrl: true,
  priority: true,
  importanceScore: true,
  publishedAt: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true, color: true } },
  author: { select: { id: true, name: true } },
  reviewer: { select: { id: true, name: true } },
  articleAI: {
    select: {
      titleRewritten: true,
      contentRewritten: true,
      rewrittenAt: true,
      rewriteAttempts: true,
      rewriteError: true,
    },
  },
} as const

type QueueRow = {
  id: string
  title: string
  status: string
  sourceName: string
  sourceUrl: string
  imageUrl: string | null
  priority: string
  importanceScore: number
  publishedAt: Date
  createdAt: Date
  category: { id: string; name: string; slug: string; color: string } | null
  author: { id: string; name: string | null } | null
  reviewer: { id: string; name: string | null } | null
  articleAI: {
    titleRewritten: string | null
    contentRewritten: string | null
    rewrittenAt: Date | null
    rewriteAttempts: number
    rewriteError: string | null
  } | null
}

function rewriteStateOf(ai: QueueRow["articleAI"]): RewriteState {
  // No ArticleAI row means the article never came through ingestion — it was
  // written by a human or by the Agent API, so there is nothing to rewrite.
  if (!ai) return "none"
  if (ai.rewrittenAt && ai.contentRewritten?.trim()) return "ready"
  if (ai.rewriteError) return "failed"
  return "pending"
}

function imagePublishableOf(imageUrl: string | null, sourceUrl: string): boolean {
  const candidate = imageUrl?.trim()
  if (!candidate || candidate === "/placeholder.svg") return false
  return checkImageRights(candidate, sourceUrl).url !== null
}

function toQueueItem(row: QueueRow, stage: WorkflowStage | null): ReviewQueueItem {
  return {
    id: row.id,
    sourceTitle: row.title,
    rewrittenTitle: row.articleAI?.titleRewritten ?? null,
    status: row.status as ArticleStatus,
    stage,
    rewriteState: rewriteStateOf(row.articleAI),
    rewriteAttempts: row.articleAI?.rewriteAttempts ?? 0,
    rewriteError: row.articleAI?.rewriteError ?? null,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    imageUrl: row.imageUrl,
    imagePublishable: imagePublishableOf(row.imageUrl, row.sourceUrl),
    category: row.category,
    author: row.author ? { id: row.author.id, name: row.author.name ?? "—" } : null,
    reviewer: row.reviewer ? { id: row.reviewer.id, name: row.reviewer.name ?? "—" } : null,
    priority: row.priority,
    importanceScore: row.importanceScore,
    publishedAt: row.publishedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

/** `ContentWorkflow` has no Prisma relation to `News`, so stages load separately. */
async function stagesFor(ids: string[]): Promise<Map<string, WorkflowStage>> {
  if (ids.length === 0) return new Map()
  const rows = (await prisma.contentWorkflow.findMany({
    where: { newsId: { in: ids } },
    select: { newsId: true, stage: true },
  })) as { newsId: string; stage: WorkflowStage }[]
  return new Map(rows.map((r) => [r.newsId, r.stage]))
}

export interface ReviewQueueResult {
  items: ReviewQueueItem[]
  pagination: { limit: number; offset: number; total: number; hasMore: boolean }
  /** One count per status, so the CMS tabs do not each need their own request. */
  counts: Record<ArticleStatus, number>
}

export async function getReviewQueue(input: ReviewQueueInput = {}): Promise<ReviewQueueResult> {
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_QUEUE_PAGE, 1), MAX_QUEUE_PAGE)
  const offset = Math.max(input.offset ?? 0, 0)

  const and: Record<string, unknown>[] = []
  if (input.status) and.push({ status: input.status })

  if (input.query) {
    and.push({
      OR: [
        { title: { contains: input.query, mode: "insensitive" } },
        { sourceName: { contains: input.query, mode: "insensitive" } },
      ],
    })
  }

  // Pushed into SQL rather than filtered in memory: a page of 25 taken before
  // the filter would return fewer than 25 rows and break pagination.
  if (input.rewriteState) {
    switch (input.rewriteState) {
      case "none":
        and.push({ articleAI: { is: null } })
        break
      case "ready":
        and.push({ articleAI: { rewrittenAt: { not: null }, contentRewritten: { not: null } } })
        break
      case "failed":
        and.push({ articleAI: { rewrittenAt: null, rewriteError: { not: null } } })
        break
      case "pending":
        and.push({ articleAI: { rewrittenAt: null, rewriteError: null } })
        break
    }
  }

  if (input.stage) {
    const scoped = (await prisma.contentWorkflow.findMany({
      where: { stage: input.stage },
      select: { newsId: true },
    })) as { newsId: string }[]
    and.push({ id: { in: scoped.map((r) => r.newsId) } })
  }

  const where = and.length > 0 ? { AND: and } : {}

  const [rows, total, grouped] = await Promise.all([
    prisma.news.findMany({
      where: where as never,
      // Importance first — see the ordering note at the top of this file.
      orderBy: [{ importanceScore: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
      select: QUEUE_SELECT,
    }) as Promise<QueueRow[]>,
    prisma.news.count({ where: where as never }),
    prisma.news.groupBy({ by: ["status"], _count: { _all: true } }) as unknown as Promise<
      { status: string; _count: { _all: number } }[]
    >,
  ])

  const stages = await stagesFor(rows.map((r) => r.id))

  const counts = Object.fromEntries(ARTICLE_STATUSES.map((s) => [s, 0])) as Record<
    ArticleStatus,
    number
  >
  for (const g of grouped) {
    if (g.status in counts) counts[g.status as ArticleStatus] = g._count._all
  }

  return {
    items: rows.map((row) => toQueueItem(row, stages.get(row.id) ?? null)),
    pagination: { limit, offset, total, hasMore: offset + rows.length < total },
    counts,
  }
}

// ── The review screen ───────────────────────────────────────────────────────

export interface ReviewArticle extends ReviewQueueItem {
  /** The source's literal text. Immutable since ingestion wrote it. */
  sourceContent: string
  sourceSummary: string | null
  /** NotiLab's retelling. Null until the rewrite worker succeeds. */
  rewrittenContent: string | null
  rewrittenAt: string | null
  /** Why this article may not yet be submitted. Empty means it may. */
  blockers: SubmissionBlocker[]
  /** Lifecycle moves this viewer may make, already filtered by their role. */
  availableTransitions: ArticleStatus[]
  /** Whether this viewer may make the REVIEW → APPROVAL handoff. */
  canClearReview: boolean
}

/**
 * Everything the review screen needs, in one request, for one viewer.
 *
 * `role` is taken rather than inferred because the available actions are part
 * of the payload: a CMS that renders every button and lets the API refuse the
 * forbidden ones teaches editors that the system is arbitrary. The API still
 * refuses them — this just stops them being offered.
 */
export async function getReviewArticle(id: string, role: UserRole): Promise<ReviewArticle> {
  const row = (await prisma.news.findUnique({
    where: { id },
    select: { ...QUEUE_SELECT, content: true, summary: true },
  })) as (QueueRow & { content: string; summary: string | null }) | null

  if (!row) throw new AgentError("ARTICLE_NOT_FOUND", `No article with id "${id}".`)

  const [stages, blockers] = await Promise.all([
    stagesFor([id]),
    // Only meaningful before submission; computing it afterwards would show a
    // reviewer conditions that no longer apply to anything they can do.
    row.status === "DRAFT" ? submissionBlockers(id) : Promise.resolve([]),
  ])

  const aiRow = (await prisma.articleAI.findUnique({
    where: { articleId: id },
    select: { contentRewritten: true, rewrittenAt: true },
  })) as { contentRewritten: string | null; rewrittenAt: Date | null } | null

  return {
    ...toQueueItem(row, stages.get(id) ?? null),
    sourceContent: row.content,
    sourceSummary: row.summary,
    rewrittenContent: aiRow?.contentRewritten ?? null,
    rewrittenAt: aiRow?.rewrittenAt?.toISOString() ?? null,
    blockers,
    availableTransitions: allowedTargetsForRole(role, row.status as ArticleStatus),
    canClearReview: row.status === "PENDING_REVIEW" && canClearReview(role),
  }
}
