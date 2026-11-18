/**
 * lib/editorial/permissions.ts — Who may move an article from where to where.
 *
 * Phase 4(iv) of `docs/manager/strategy/ingestion-editorial-gate.md`. This is
 * the table `docs/editor/ingestion-editorial-workflow.md` § 3.1 describes in
 * prose, and it is deliberately the *only* place that answers the question.
 *
 * ── The one rule that must never be relaxed ─────────────────────────────────
 *
 * Permission is checked **per edge, against an explicit list of roles**. Never
 * `role >= SUPERVISOR`, never an index into the enum, never a tier number.
 *
 * `UserRole` is declared as:
 *
 *   USER < REDATOR < REVISOR < SUPERVISOR < MARKETING < CRIADOR_CONTEUDO
 *        < ADMIN < SUPER_ADMIN
 *
 * and that order is **not an authority ladder**. `MARKETING` and
 * `CRIADOR_CONTEUDO` sit above `SUPERVISOR` numerically while holding
 * *different*, not greater, editorial powers — `MARKETING` holds no lifecycle
 * transition at all, and `CRIADOR_CONTEUDO` is an authoring role that stops at
 * submission. So any `role >= SUPERVISOR` check hands publish rights to the
 * marketing team and to the AI-assisted authoring role, which is precisely the
 * role that must not also be the one that waves the AI through.
 *
 * ── Fail-closed ─────────────────────────────────────────────────────────────
 *
 * An edge absent from `TRANSITION_ROLES` grants nobody. Adding an edge to
 * `ALLOWED_TRANSITIONS` without adding it here makes that edge unreachable
 * rather than unguarded, and `assertTransitionRolesCoverAllEdges()` turns the
 * omission into a test failure instead of a silent wall.
 */

import type { UserRole } from "@/lib/generated/prisma"
import { ALLOWED_TRANSITIONS, type ArticleStatus } from "./transitions"

/**
 * Roles that may act at any stage, subject to `ALLOWED_TRANSITIONS`.
 *
 * They are an escape hatch for operational reality — a SUPERVISOR on holiday,
 * a mis-filed article — and emphatically **not** a bypass: there is no
 * `DRAFT → PUBLISHED` edge for anyone, and every action they take still writes
 * an `AdminAction` row naming them.
 */
const ELEVATED: readonly UserRole[] = ["ADMIN", "SUPER_ADMIN"]

/**
 * The matrix. Read as: from → to → the roles that may make that move.
 *
 * Every entry below is `ELEVATED` plus the roles § 3.1 names for that edge.
 * The repetition is intentional: a reader checking "can a REDATOR publish?"
 * should be able to answer it by looking at one line, not by composing a base
 * list with three overrides.
 */
export const TRANSITION_ROLES: Record<
  ArticleStatus,
  Partial<Record<ArticleStatus, readonly UserRole[]>>
> = {
  DRAFT: {
    // Submission. The authoring roles, and only them — this is the edge the
    // § 3.3 preconditions guard, not a permission question.
    PENDING_REVIEW: ["REDATOR", "CRIADOR_CONTEUDO", ...ELEVATED],
    // REJECTED is terminal and unrecoverable (§ 3.4), so killing a story
    // outright is held above the authoring roles even before review. A REDATOR
    // who does not want to file a draft simply does not submit it.
    REJECTED: ["SUPERVISOR", ...ELEVATED],
    ARCHIVED: ["SUPERVISOR", ...ELEVATED],
  },

  PENDING_REVIEW: {
    // The approval act. SUPERVISOR only — a REVISOR clears the review stage
    // but may never reach APPROVED alone, which is the structural reason the
    // two roles exist at all.
    APPROVED: ["SUPERVISOR", ...ELEVATED],
    // "Send back for fixes" — the correct action for anything fixable.
    DRAFT: ["REVISOR", "SUPERVISOR", ...ELEVATED],
    // "Not for NotiLab". Terminal.
    REJECTED: ["REVISOR", "SUPERVISOR", ...ELEVATED],
  },

  APPROVED: {
    // The publish act.
    PUBLISHED: ["SUPERVISOR", ...ELEVATED],
    DRAFT: ["SUPERVISOR", ...ELEVATED],
    REJECTED: ["SUPERVISOR", ...ELEVATED],
    ARCHIVED: ["SUPERVISOR", ...ELEVATED],
  },

  PUBLISHED: {
    // Unpublish. Returns to APPROVED, not DRAFT: it was reviewed, and it stays
    // republishable without a second trip through the workflow.
    APPROVED: ["SUPERVISOR", ...ELEVATED],
    ARCHIVED: ["SUPERVISOR", ...ELEVATED],
  },

  // Terminal. No outgoing edges exist, so no roles can be named for any.
  REJECTED: {},
  ARCHIVED: {},
}

/**
 * True when a human holding `role` may make this exact move.
 *
 * Fail-closed on every axis: an illegal edge, an unlisted edge, and an
 * unlisted role all return false.
 */
export function canRoleTransition(
  role: UserRole,
  from: ArticleStatus,
  to: ArticleStatus,
): boolean {
  const allowed = TRANSITION_ROLES[from]?.[to]
  if (!allowed) return false
  return allowed.includes(role)
}

/** Every move `role` may make from `from`. Drives which buttons the CMS shows. */
export function allowedTargetsForRole(
  role: UserRole,
  from: ArticleStatus,
): ArticleStatus[] {
  return (ALLOWED_TRANSITIONS[from] ?? []).filter((to) => canRoleTransition(role, from, to))
}

/**
 * Only a REVISOR (or an elevated role acting in their place) may clear a
 * review — the `REVIEW → APPROVAL` stage handoff. This moves no status, which
 * is exactly why it needs its own check: it is invisible to the transition
 * matrix above.
 */
export function canClearReview(role: UserRole): boolean {
  return role === "REVISOR" || role === "SUPERVISOR" || ELEVATED.includes(role)
}

/**
 * Throws if `ALLOWED_TRANSITIONS` and `TRANSITION_ROLES` have drifted apart.
 *
 * Called from the test suite rather than at module load: a thrown error at
 * import time would take down every page that touches the editorial layer,
 * which is a worse outcome than an edge nobody can traverse.
 */
export function assertTransitionRolesCoverAllEdges(): void {
  const missing: string[] = []
  const extra: string[] = []

  for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS) as [
    ArticleStatus,
    readonly ArticleStatus[],
  ][]) {
    for (const to of targets) {
      const roles = TRANSITION_ROLES[from]?.[to]
      if (!roles || roles.length === 0) missing.push(`${from} -> ${to}`)
    }

    for (const to of Object.keys(TRANSITION_ROLES[from] ?? {}) as ArticleStatus[]) {
      if (!targets.includes(to)) extra.push(`${from} -> ${to}`)
    }
  }

  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      "TRANSITION_ROLES is out of step with ALLOWED_TRANSITIONS. " +
        (missing.length > 0 ? `Legal edges nobody may traverse: ${missing.join(", ")}. ` : "") +
        (extra.length > 0 ? `Roles named for illegal edges: ${extra.join(", ")}.` : ""),
    )
  }
}
