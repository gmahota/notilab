/**
 * GET /api/cron/publish-scheduled
 *
 * Publishes articles whose scheduled moment has passed.
 *
 * DELIBERATELY NOT REGISTERED IN vercel.json.
 *
 * Every other cron in this project reads, enriches or sends. This one would put
 * stories on the public site with no human in the loop, which AGENTS.md treats
 * as the project's core risk. Switching that on is an operator's decision, made
 * once, knowingly — not something an agent-API commit should turn on as a side
 * effect. Until the entry is added, `schedule_article` records intent that
 * nothing acts on, and the tool's own description says so.
 *
 * To enable, add to vercel.json (note the Hobby plan's once-a-day frequency cap
 * — see DEPLOYMENT.md):
 *
 *   { "path": "/api/cron/publish-scheduled", "schedule": "0 8 * * *" }
 *
 * Manual run:
 *
 *   curl -H "Authorization: Bearer <CRON_SECRET>" \
 *        https://notilab.vercel.app/api/cron/publish-scheduled
 *
 * Safety properties:
 *   - Only articles already APPROVED are published; the review gate in
 *     `transitionArticle` applies to this caller like any other.
 *   - Each schedule is closed out whether it succeeded or failed, so a story
 *     whose article was archived in the meantime is not retried forever.
 *   - Every publication writes an audit row attributed to `system:cron`.
 */

import { type NextRequest, NextResponse } from "next/server"
import { transitionArticle } from "@/lib/editorial/article-service"
import { closeSchedule, listDueSchedules } from "@/lib/editorial/schedule-service"
import { recordAgentAction, AUDIT_RESOURCE } from "@/lib/agent/audit"
import { isAgentError } from "@/lib/agent/errors"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[cron/publish-scheduled] CRON_SECRET is not set")
    return NextResponse.json(
      { ok: false, error: "Server misconfiguration: CRON_SECRET not set" },
      { status: 500 },
    )
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const due = await listDueSchedules(now)

  let published = 0
  const failures: Array<{ articleId: string; reason: string }> = []

  for (const schedule of due) {
    try {
      const result = await transitionArticle(schedule.articleId, "PUBLISHED")

      await recordAgentAction({
        agentId: "system:cron",
        tool: "publish_scheduled",
        action: "ARTICLE_PUBLISH",
        resource: AUDIT_RESOURCE.ARTICLE,
        resourceId: schedule.articleId,
        outcome: "success",
        requestId: `cron-${now.toISOString()}`,
        durationMs: 0,
        input: { scheduledPublishAt: schedule.publishAt, scheduledBy: schedule.scheduledBy },
        changes: result.changes,
      })

      await closeSchedule(schedule.articleId, "fulfilled", {
        publishAt: schedule.publishAt,
        alreadyPublished: result.alreadyInState,
      })

      published += 1
    } catch (err) {
      const reason = isAgentError(err) ? `${err.code}: ${err.message}` : "unexpected error"
      if (!isAgentError(err)) {
        console.error(`[cron/publish-scheduled] ${schedule.articleId} failed`, err)
      }

      // Closed rather than left pending: a story whose article was archived or
      // rejected after scheduling would otherwise be retried on every run.
      await closeSchedule(schedule.articleId, "failed", {
        publishAt: schedule.publishAt,
        reason,
      })

      failures.push({ articleId: schedule.articleId, reason })
    }
  }

  return NextResponse.json(
    { ok: true, due: due.length, published, failures },
    { status: failures.length > 0 ? 207 : 200 },
  )
}
