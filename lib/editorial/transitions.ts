/**
 * lib/editorial/transitions.ts — The article lifecycle vocabulary.
 *
 * Extracted from `article-service.ts` so that `permissions.ts` can read the
 * transition table without importing the service, and the service can enforce
 * permissions without importing a module that imports it back. Nothing here
 * touches the database; it is the shape of the lifecycle, not its behaviour.
 *
 * `article-service.ts` re-exports every name below, so existing imports are
 * unaffected.
 */

import type { WorkflowStage } from "@/lib/generated/prisma"

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

export function isArticleStatus(value: unknown): value is ArticleStatus {
  return typeof value === "string" && (ARTICLE_STATUSES as readonly string[]).includes(value)
}

/**
 * Legal status moves. Read as: from → the set it may become.
 *
 * REJECTED and ARCHIVED have no outgoing edges. `business-rules.md` calls them
 * terminal, and that file outranks a task prompt (AGENTS.md § Authority Order),
 * so neither the Agent API nor the admin console can resurrect an article. The
 * consequence — nobody can undo their own archive — is real and is written up
 * in docs/agent-api.md § Limitations rather than quietly designed around.
 *
 * `docs/manager/strategy/ingestion-editorial-gate.md` § 6 invariant 14: this
 * table is **unchanged** by the editorial gate work. Widening it is a separate,
 * explicitly-argued decision.
 */
export const ALLOWED_TRANSITIONS: Record<ArticleStatus, readonly ArticleStatus[]> = {
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

// ── Status ↔ workflow stage ─────────────────────────────────────────────────

/**
 * `News.status` is the **legal gate** — may the public see this? — and
 * `ContentWorkflow.stage` is the **newsroom's view of the work** — where is it
 * and who owns it? Two different questions, which is why the editorial spec
 * (§ 1.2) refused to collapse them into one enum.
 *
 * The mapping is not one-to-one in either direction:
 *
 *   - `DRAFT` covers both `DRAFT` (collected, still the source's raw text) and
 *     `WRITING` (rewritten in NotiLab's voice, not yet submitted). Which one
 *     depends on whether a rewrite exists, so it cannot be read off the status.
 *   - `PENDING_REVIEW` deliberately spans `REVIEW` and `APPROVAL`. The REVISOR
 *     clears, the SUPERVISOR approves, and the status does not move between
 *     those two acts.
 *   - `ARCHIVED` has no stage of its own; an archived article keeps whatever
 *     stage it held, because the stage records where the work stopped.
 */
export function stageForStatus(
  status: ArticleStatus,
  options: { hasRewrite?: boolean } = {},
): WorkflowStage | null {
  switch (status) {
    case "DRAFT":
      return options.hasRewrite ? "WRITING" : "DRAFT"
    case "PENDING_REVIEW":
      return "REVIEW"
    case "APPROVED":
      return "APPROVAL"
    case "PUBLISHED":
      return "PUBLISHED"
    case "REJECTED":
      return "REJECTED"
    case "ARCHIVED":
      return null
  }
}
