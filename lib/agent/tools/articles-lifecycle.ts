/**
 * lib/agent/tools/articles-lifecycle.ts — Moving an article through its states.
 *
 * There is one tool per legal move, rather than one `set_status` tool taking a
 * target. That is deliberate: a single status tool would put the whole
 * lifecycle behind one permission, and the difference between "may submit a
 * draft for review" and "may put a story on the front page" is exactly the
 * difference an operator needs to be able to grant separately.
 *
 * All of these are safe to retry. Publishing an already-published article
 * succeeds and reports `changed: []`, because an agent that lost a response
 * must not be pushed into a corrective action that was never needed.
 *
 * Note that granting one agent `article.review` *and* `article.publish` lets it
 * approve its own drafts and publish them. That is a real property of the
 * permission model and an operator's decision, not an oversight — it is called
 * out in docs/agent-api.md § Permissions.
 */

import { defineTool } from "../types"
import { f } from "../schema"
import { AUDIT_RESOURCE } from "../audit"
import { transitionArticle } from "@/lib/editorial/article-service"
import {
  getSchedule,
  scheduleArticle,
  unscheduleArticle,
} from "@/lib/editorial/schedule-service"
import { ARTICLE_MUTATION_SCHEMA } from "./shapes"

const idField = f.string({ description: "Article id.", maxLength: 200 })

export const submitArticleForReviewTool = defineTool({
  name: "submit_article_for_review",
  title: "Submit for review",
  description:
    "Move a DRAFT into PENDING_REVIEW, which is the first gate of NotiLab's editorial workflow. " +
    "This is the step that must happen before an article can be approved and published.",
  permissions: ["article.review"],
  mutating: true,
  audit: { action: "ARTICLE_SUBMIT_REVIEW", resource: AUDIT_RESOURCE.ARTICLE },
  input: { id: idField },
  output: ARTICLE_MUTATION_SCHEMA,
  async handler(input) {
    const result = await transitionArticle(input.id, "PENDING_REVIEW")
    return {
      data: { article: result.article, changed: Object.keys(result.changes) },
      audit: { resourceId: input.id, changes: result.changes },
    }
  },
})

export const approveArticleTool = defineTool({
  name: "approve_article",
  title: "Approve an article",
  description:
    "Approve an article that is PENDING_REVIEW, making it eligible for publication or scheduling. " +
    "Approving does not make an article public — call publish_article or schedule_article after.",
  permissions: ["article.review"],
  mutating: true,
  audit: { action: "ARTICLE_APPROVE", resource: AUDIT_RESOURCE.ARTICLE },
  input: { id: idField },
  output: ARTICLE_MUTATION_SCHEMA,
  async handler(input) {
    const result = await transitionArticle(input.id, "APPROVED")
    return {
      data: { article: result.article, changed: Object.keys(result.changes) },
      audit: { resourceId: input.id, changes: result.changes },
    }
  },
})

export const rejectArticleTool = defineTool({
  name: "reject_article",
  title: "Reject an article",
  description:
    "Reject an article under review, or a draft that should not proceed. REJECTED is a terminal " +
    "state in NotiLab — the article cannot be moved out of it through this API — so use it only " +
    "when the story is genuinely being abandoned.",
  permissions: ["article.review"],
  mutating: true,
  audit: { action: "ARTICLE_REJECT", resource: AUDIT_RESOURCE.ARTICLE },
  input: { id: idField },
  output: ARTICLE_MUTATION_SCHEMA,
  async handler(input) {
    const result = await transitionArticle(input.id, "REJECTED")
    return {
      data: { article: result.article, changed: Object.keys(result.changes) },
      audit: { resourceId: input.id, changes: result.changes },
    }
  },
})

export const publishArticleTool = defineTool({
  name: "publish_article",
  title: "Publish an article",
  description:
    "Make an APPROVED article publicly visible. It will fail with ARTICLE_NOT_APPROVED on a draft " +
    "or an article still under review — that gate is a business rule, not a permission, so run " +
    "submit_article_for_review and approve_article first. Publishing an already-published article " +
    "succeeds and changes nothing, so this is safe to retry. `publishedAt` is left as-is unless " +
    "you pass one; for a syndicated story that field is the original outlet's publication date.",
  permissions: ["article.publish"],
  mutating: true,
  audit: { action: "ARTICLE_PUBLISH", resource: AUDIT_RESOURCE.ARTICLE },
  input: {
    id: idField,
    publishedAt: f.optional(
      f.datetime("Overrides the article's publication date. Leave unset to keep the existing one."),
    ),
  },
  output: ARTICLE_MUTATION_SCHEMA,
  async handler(input) {
    const result = await transitionArticle(input.id, "PUBLISHED", {
      publishedAt: input.publishedAt,
    })
    return {
      data: { article: result.article, changed: Object.keys(result.changes) },
      audit: { resourceId: input.id, changes: result.changes },
    }
  },
})

export const unpublishArticleTool = defineTool({
  name: "unpublish_article",
  title: "Unpublish an article",
  description:
    "Withdraw a published article from the public site. It returns to APPROVED — already reviewed, " +
    "and republishable with publish_article without going through review again. Nothing is deleted.",
  permissions: ["article.unpublish"],
  mutating: true,
  audit: { action: "ARTICLE_UNPUBLISH", resource: AUDIT_RESOURCE.ARTICLE },
  input: { id: idField },
  output: ARTICLE_MUTATION_SCHEMA,
  async handler(input) {
    const result = await transitionArticle(input.id, "APPROVED")
    return {
      data: { article: result.article, changed: Object.keys(result.changes) },
      audit: { resourceId: input.id, changes: result.changes },
    }
  },
})

export const archiveArticleTool = defineTool({
  name: "archive_article",
  title: "Archive an article",
  description:
    "Archive an article so it stops appearing anywhere. This is NotiLab's alternative to deletion — " +
    "the row, its provenance and its history are kept. ARCHIVED is terminal: an archived article " +
    "cannot be restored through this API, only by an operator. Prefer unpublish_article when the " +
    "intent is temporary.",
  permissions: ["article.archive"],
  mutating: true,
  audit: { action: "ARTICLE_ARCHIVE", resource: AUDIT_RESOURCE.ARTICLE },
  input: { id: idField },
  output: ARTICLE_MUTATION_SCHEMA,
  async handler(input) {
    const result = await transitionArticle(input.id, "ARCHIVED")
    return {
      data: { article: result.article, changed: Object.keys(result.changes) },
      audit: { resourceId: input.id, changes: result.changes },
    }
  },
})

export const scheduleArticleTool = defineTool({
  name: "schedule_article",
  title: "Schedule a publication",
  description:
    "Record that an APPROVED article should be published at a future instant. `publishAt` is " +
    "ISO-8601; a value with no timezone offset is read as UTC, so state the offset when the " +
    "request is in local time. Calling it again replaces the pending schedule. IMPORTANT: the job " +
    "that fulfils schedules is not switched on by default on every deployment — check with the " +
    "operator before promising a story will go live unattended.",
  permissions: ["article.schedule"],
  mutating: true,
  audit: { action: "ARTICLE_SCHEDULE", resource: AUDIT_RESOURCE.ARTICLE },
  input: {
    id: idField,
    publishAt: f.datetime("When to publish. Must be in the future."),
  },
  output: {
    type: "object",
    properties: {
      articleId: { type: "string" },
      publishAt: { type: "string", format: "date-time" },
      scheduledBy: { type: "string" },
      scheduledAt: { type: "string", format: "date-time" },
      previousSchedule: { type: ["object", "null"] },
    },
  },
  async handler(input, ctx) {
    const previous = await getSchedule(input.id)
    const schedule = await scheduleArticle(input.id, input.publishAt, ctx.agent.id, ctx.now)

    return {
      data: { ...schedule, previousSchedule: previous },
      audit: {
        resourceId: input.id,
        changes: {
          scheduledPublishAt: {
            before: previous?.publishAt ?? null,
            after: schedule.publishAt,
          },
        },
      },
    }
  },
})

export const unscheduleArticleTool = defineTool({
  name: "unschedule_article",
  title: "Cancel a scheduled publication",
  description:
    "Cancel an article's pending scheduled publication. The article keeps its current status — " +
    "cancelling a schedule does not unpublish anything, it only removes the future intent.",
  permissions: ["article.schedule"],
  mutating: true,
  audit: { action: "ARTICLE_UNSCHEDULE", resource: AUDIT_RESOURCE.ARTICLE },
  input: { id: idField },
  output: {
    type: "object",
    properties: {
      articleId: { type: "string" },
      cancelled: {
        type: "object",
        properties: {
          publishAt: { type: "string", format: "date-time" },
          scheduledBy: { type: "string" },
        },
      },
    },
  },
  async handler(input, ctx) {
    const result = await unscheduleArticle(input.id, ctx.agent.id)
    return {
      data: result,
      audit: {
        resourceId: input.id,
        changes: { scheduledPublishAt: { before: result.cancelled.publishAt, after: null } },
      },
    }
  },
})
