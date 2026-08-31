/**
 * lib/editorial/schedule-service.ts — Deferred publication.
 *
 * NotiLab has no scheduling today: no `scheduledFor` column, no SCHEDULED
 * status. The obvious move — add a column — was rejected on purpose. This
 * project's local environment points at the same Neon database as production
 * and its deploys do not run `prisma migrate deploy`, so a schema change is a
 * manual production operation dressed up as a code change. That is a decision
 * for the operator, not a side effect of adding an agent API.
 *
 * So a schedule is stored as intent, in the `AdminAction` table that already
 * records editorial decisions:
 *
 *   resource   ARTICLE_SCHEDULE
 *   resourceId <article id>
 *   action     ARTICLE_SCHEDULE_SET | _CANCEL | _FULFILLED | _FAILED
 *   details    { publishAt, agentId }
 *
 * The most recent row for an article is its current schedule state. Append-only,
 * so the history of "who scheduled this, and who moved it" is readable — which
 * a nullable column would not have given us.
 *
 * What turns intent into publication is `/api/cron/publish-scheduled`. That
 * endpoint exists but is deliberately **not** registered in `vercel.json`:
 * switching on an automation that publishes to the public site is the
 * operator's call. Until it is wired up, a schedule is a record of intent that
 * nothing acts on. See docs/agent-api.md § Scheduling.
 */

import { prisma } from "@/lib/prisma"
import { AgentError } from "@/lib/agent/errors"
import { AUDIT_RESOURCE } from "@/lib/agent/audit"

export const SCHEDULE_ACTION = {
  SET: "ARTICLE_SCHEDULE_SET",
  CANCEL: "ARTICLE_SCHEDULE_CANCEL",
  FULFILLED: "ARTICLE_SCHEDULE_FULFILLED",
  FAILED: "ARTICLE_SCHEDULE_FAILED",
} as const

export interface ArticleSchedule {
  articleId: string
  publishAt: string
  scheduledBy: string
  scheduledAt: string
}

interface ScheduleRow {
  action: string
  resourceId: string
  createdAt: Date
  details: unknown
}

/**
 * How many recent schedule rows the cron reads in one pass. A ceiling matters:
 * the table also carries every other audit row, and an unbounded read here is
 * how a cron that ran fine for a year starts timing out.
 */
const SCAN_LIMIT = 500

function readDetails(details: unknown): { publishAt?: string; agentId?: string } {
  if (typeof details !== "object" || details === null) return {}
  return details as { publishAt?: string; agentId?: string }
}

/** Reduces an ordered-desc row list to the newest row per article. */
function latestPerArticle(rows: ScheduleRow[]): Map<string, ScheduleRow> {
  const latest = new Map<string, ScheduleRow>()
  for (const row of rows) {
    if (!latest.has(row.resourceId)) latest.set(row.resourceId, row)
  }
  return latest
}

/** The article's active schedule, or null if it has none. */
export async function getSchedule(articleId: string): Promise<ArticleSchedule | null> {
  const row = (await prisma.adminAction.findFirst({
    where: { resource: AUDIT_RESOURCE.ARTICLE_SCHEDULE, resourceId: articleId },
    orderBy: { createdAt: "desc" },
    select: { action: true, resourceId: true, createdAt: true, details: true },
  })) as ScheduleRow | null

  if (!row || row.action !== SCHEDULE_ACTION.SET) return null

  const details = readDetails(row.details)
  if (!details.publishAt) return null

  return {
    articleId,
    publishAt: details.publishAt,
    scheduledBy: details.agentId ?? "unknown",
    scheduledAt: row.createdAt.toISOString(),
  }
}

/**
 * Records the intent to publish an article at a future instant.
 *
 * Requires APPROVED, the same gate `transitionArticle` applies to an immediate
 * publish. Scheduling is publishing with a delay; letting a draft be scheduled
 * would move the review gate to a moment when no human is watching.
 */
export async function scheduleArticle(
  articleId: string,
  publishAt: Date,
  agentId: string,
  now: Date = new Date(),
): Promise<ArticleSchedule> {
  const article = await prisma.news.findUnique({
    where: { id: articleId },
    select: { id: true, status: true },
  })

  if (!article) throw new AgentError("ARTICLE_NOT_FOUND", `No article with id "${articleId}".`)

  if (publishAt.getTime() <= now.getTime()) {
    throw new AgentError(
      "SCHEDULE_IN_THE_PAST",
      "`publishAt` must be in the future. To publish now, call publish_article.",
    )
  }

  if (String(article.status) !== "APPROVED") {
    throw new AgentError(
      "ARTICLE_NOT_APPROVED",
      `Only an APPROVED article can be scheduled. This one is ${String(article.status)}.`,
      { currentStatus: String(article.status) },
    )
  }

  await prisma.adminAction.create({
    data: {
      userId: `agent:${agentId}`,
      action: SCHEDULE_ACTION.SET,
      resource: AUDIT_RESOURCE.ARTICLE_SCHEDULE,
      resourceId: articleId,
      details: { publishAt: publishAt.toISOString(), agentId },
    },
  })

  return {
    articleId,
    publishAt: publishAt.toISOString(),
    scheduledBy: agentId,
    scheduledAt: now.toISOString(),
  }
}

/** Cancels a pending schedule. The article's status is untouched. */
export async function unscheduleArticle(
  articleId: string,
  agentId: string,
): Promise<{ articleId: string; cancelled: ArticleSchedule }> {
  const current = await getSchedule(articleId)
  if (!current) {
    throw new AgentError("ARTICLE_NOT_SCHEDULED", "This article has no pending schedule.")
  }

  await prisma.adminAction.create({
    data: {
      userId: `agent:${agentId}`,
      action: SCHEDULE_ACTION.CANCEL,
      resource: AUDIT_RESOURCE.ARTICLE_SCHEDULE,
      resourceId: articleId,
      details: { cancelledPublishAt: current.publishAt, agentId },
    },
  })

  return { articleId, cancelled: current }
}

/** Schedules whose moment has arrived. Ordered oldest-first so a backlog drains in order. */
export async function listDueSchedules(now: Date = new Date()): Promise<ArticleSchedule[]> {
  const rows = (await prisma.adminAction.findMany({
    where: { resource: AUDIT_RESOURCE.ARTICLE_SCHEDULE },
    orderBy: { createdAt: "desc" },
    take: SCAN_LIMIT,
    select: { action: true, resourceId: true, createdAt: true, details: true },
  })) as ScheduleRow[]

  const due: ArticleSchedule[] = []

  for (const [articleId, row] of latestPerArticle(rows)) {
    if (row.action !== SCHEDULE_ACTION.SET) continue

    const details = readDetails(row.details)
    if (!details.publishAt) continue

    const publishAt = new Date(details.publishAt)
    if (Number.isNaN(publishAt.getTime()) || publishAt.getTime() > now.getTime()) continue

    due.push({
      articleId,
      publishAt: details.publishAt,
      scheduledBy: details.agentId ?? "unknown",
      scheduledAt: row.createdAt.toISOString(),
    })
  }

  return due.sort((a, b) => a.publishAt.localeCompare(b.publishAt))
}

/** Closes out a schedule once the cron has acted on it, successfully or not. */
export async function closeSchedule(
  articleId: string,
  outcome: "fulfilled" | "failed",
  detail: Record<string, unknown>,
): Promise<void> {
  await prisma.adminAction.create({
    data: {
      userId: "system:cron",
      action: outcome === "fulfilled" ? SCHEDULE_ACTION.FULFILLED : SCHEDULE_ACTION.FAILED,
      resource: AUDIT_RESOURCE.ARTICLE_SCHEDULE,
      resourceId: articleId,
      details: detail as object,
    },
  })
}
