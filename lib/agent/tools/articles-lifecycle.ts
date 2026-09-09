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
import { criticalActionConfirmation } from "../critical-actions"
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
    "Sign off an article that is PENDING_REVIEW, moving it to APPROVED. This is the editorial gate: " +
    "an article cannot be published or scheduled until it passes through here, so approving is the " +
    "act that makes a story publishable. It does NOT make it public — call publish_article or " +
    "schedule_article afterwards. " +
    "Required: id (article id or slug). No other field. " +
    "Fails with INVALID_STATUS_TRANSITION unless the article is PENDING_REVIEW or DRAFT-adjacent per " +
    "the state machine; approving an already-APPROVED article succeeds and reports changed: []. " +
    "CRITICAL ACTION — requires confirmation: the first call is refused with CONFIRMATION_REQUIRED " +
    "and a confirmationToken, and the identical call carrying that token proceeds. " +
    "Do NOT use it to fix an article: approval is a judgement that the text is ready as it stands, " +
    "so edit with update_article first and approve after. Do not approve your own drafts unattended " +
    "when a human is meant to review them.",
  permissions: ["article.review"],
  mutating: true,
  audit: { action: "ARTICLE_APPROVE", resource: AUDIT_RESOURCE.ARTICLE },
  confirmation: criticalActionConfirmation(
    "Approving clears this article for publication. Confirm that it has been read and is ready.",
  ),
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
    "Put an APPROVED article on the public site, immediately and for every reader. This is the only " +
    "tool that makes NotiLab content visible to the outside world. " +
    "Required: id (article id or slug). Optional: publishedAt (ISO-8601) — left as-is when omitted; " +
    "for a syndicated story that field is the original outlet's publication date, not now. " +
    "Fails with ARTICLE_NOT_APPROVED on a DRAFT or an article still under review, and that gate is a " +
    "business rule rather than a permission: no credential can skip it, so run " +
    "submit_article_for_review and approve_article first. Publishing an already-PUBLISHED article " +
    "succeeds and reports changed: [], so it is safe to retry. " +
    "CRITICAL ACTION — requires confirmation: the first call is refused with CONFIRMATION_REQUIRED " +
    "and a confirmationToken, and the identical call carrying that token proceeds. " +
    "Do NOT use it to correct a live story — the article is already public, so edit it with " +
    "update_article instead. Do NOT use it to schedule: for a future instant call schedule_article. " +
    "To take a story back down, use unpublish_article.",
  permissions: ["article.publish"],
  mutating: true,
  audit: { action: "ARTICLE_PUBLISH", resource: AUDIT_RESOURCE.ARTICLE },
  confirmation: criticalActionConfirmation(
    "Publishing makes this article visible to every reader of the public site. Confirm to proceed.",
  ),
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
    "Take a PUBLISHED article back off the public site. Readers stop seeing it immediately. " +
    "Required: id (article id or slug). No other field. " +
    "The article returns to APPROVED — already reviewed, and republishable with publish_article " +
    "without going through review again. Nothing is deleted and no history is lost. Unpublishing an " +
    "article that is not published succeeds and reports changed: []. " +
    "CRITICAL ACTION — requires confirmation: the first call is refused with CONFIRMATION_REQUIRED " +
    "and a confirmationToken, and the identical call carrying that token proceeds. " +
    "Use it when a live story is wrong or premature. Do NOT use it as a way to edit — update_article " +
    "works on a published article and leaves it up. Do NOT use it to retire a story permanently; " +
    "that is archive_article.",
  permissions: ["article.unpublish"],
  mutating: true,
  audit: { action: "ARTICLE_UNPUBLISH", resource: AUDIT_RESOURCE.ARTICLE },
  confirmation: criticalActionConfirmation(
    "Unpublishing removes this article from the public site immediately. Confirm to proceed.",
  ),
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
    "Retire an article permanently, from any status. It stops appearing anywhere — public site, " +
    "search, digests. This is NotiLab's alternative to deletion: the row, its provenance and its " +
    "history are kept, but ARCHIVED is TERMINAL. No tool in this API can bring it back; only a human " +
    "operator working directly on the database can. " +
    "Required: id (article id or slug). No other field. " +
    "CRITICAL ACTION — requires confirmation: the first call is refused with CONFIRMATION_REQUIRED " +
    "and a confirmationToken, and the identical call carrying that token proceeds. " +
    "Use it only when the story is genuinely finished with. Do NOT use it to hide a story " +
    "temporarily, to take a live story down, or to tidy up — unpublish_article is reversible and is " +
    "almost always what is wanted. Do NOT use it on an article you did not create unless the " +
    "operator asked for that article by name.",
  permissions: ["article.archive"],
  mutating: true,
  audit: { action: "ARTICLE_ARCHIVE", resource: AUDIT_RESOURCE.ARTICLE },
  confirmation: criticalActionConfirmation(
    "Archiving is permanent — nothing in this API can restore the article afterwards. Confirm to proceed.",
  ),
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
    "Record that an APPROVED article should be published at a future instant. This writes an " +
    "intent, not a publication: nothing becomes visible now. " +
    "Required: id (article id or slug) and publishAt (ISO-8601, must be in the future). A value " +
    "with no timezone offset is read as UTC, so state the offset when the operator spoke in local " +
    "time — Maputo is UTC+02:00. Fails with SCHEDULE_IN_THE_PAST for an instant that has passed, " +
    "and the article must already be APPROVED. Calling it again replaces the pending schedule " +
    "rather than adding a second one; the response carries previousSchedule so the replacement is " +
    "visible. " +
    "IMPORTANT: the cron job that fulfils schedules is not switched on by default on every " +
    "deployment. Where it is off, a scheduled article simply never goes live — check with the " +
    "operator before promising a story will publish unattended. " +
    "Do NOT use it to publish now: that is publish_article. To cancel, call unschedule_article; " +
    "there is no way to cancel by scheduling a past date.",
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
