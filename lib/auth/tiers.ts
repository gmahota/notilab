/**
 * lib/auth/tiers.ts — The three human tiers, written down once.
 *
 * The identity decision of 2026-09-04 (`docs/memory/decisions.md`) names three
 * human tiers — visitor, reader, staff — and one machine tier that is not an
 * identity at all (`lib/agent/auth.ts`, `agent:<id>`, no `User` row, no
 * session). This module is the matrix that decision says the code must read
 * from, rather than each call site re-deciding which roles count as what.
 *
 * It is deliberately pure: a role in, a tier out. No cookie, no database, no
 * session. That is what lets it be imported by server components, route
 * handlers and the middleware alike, and tested exhaustively without a
 * connection — and it is why `UserRole` arrives as `import type`, so nothing
 * here pulls the generated Prisma client into a component that only needed to
 * compare two strings.
 */

import type { UserRole } from "@/lib/generated/prisma"

/**
 * Visitor is a designed state, not a fallback: an anonymous reader has a tier,
 * gets the value proposition and a sign-in, and is never shown fabricated
 * statistics (same decision entry).
 */
export type Tier = "visitor" | "reader" | "staff"

/** The tier a signed-in user's role places them in. */
export type SignedInTier = Exclude<Tier, "visitor">

/**
 * The matrix.
 *
 * `Record<UserRole, SignedInTier>` rather than a list of staff roles, for the
 * reason `lib/admin-auth.ts` gives for the same shape: adding a member to the
 * Prisma enum must break `pnpm typecheck` here until somebody decides, in
 * writing, which tier it belongs to. A `UserRole[]` of staff roles would answer
 * that question silently, and answer it "reader".
 *
 * Membership mirrors what the admin console has always enforced: every role
 * except `USER` is staff. The enum's declaration order is NOT an authority
 * ladder — `MARKETING` and `CRIADOR_CONTEUDO` sit above `SUPERVISOR` in it —
 * so nothing in this file may compare roles with `<` or `>`.
 */
export const TIER_OF_ROLE: Record<UserRole, SignedInTier> = {
  USER: "reader",
  REDATOR: "staff",
  REVISOR: "staff",
  SUPERVISOR: "staff",
  MARKETING: "staff",
  CRIADOR_CONTEUDO: "staff",
  ADMIN: "staff",
  SUPER_ADMIN: "staff",
}

/**
 * Tier for a role, or `"visitor"` when there is no role at all.
 *
 * Takes null and undefined on purpose: "no session" and "session without a
 * role" are the same answer, and making every caller write that branch is how
 * one of them gets it wrong.
 */
export function tierOf(role: UserRole | null | undefined): Tier {
  if (role === null || role === undefined) return "visitor"
  return TIER_OF_ROLE[role] ?? "visitor"
}

/** Staff may reach `/admin`. A reader signed in as `USER` may not. */
export function isStaffRole(role: UserRole | null | undefined): boolean {
  return tierOf(role) === "staff"
}

/** Any signed-in human, staff included — staff are readers who also have `/admin`. */
export function isReaderOrAbove(role: UserRole | null | undefined): boolean {
  return tierOf(role) !== "visitor"
}

/**
 * Explicit role membership, for a decision no tier covers — a single
 * transition that only `SUPERVISOR` and above may perform, say.
 *
 * The allowed roles are always listed in full by the caller. There is no
 * "this role and everything more powerful", because the enum has no ordering to
 * derive that from: a `role >= SUPERVISOR` check hands publishing rights to
 * marketing.
 */
export function hasRole(
  role: UserRole | null | undefined,
  allowed: readonly UserRole[],
): boolean {
  if (role === null || role === undefined) return false
  return allowed.includes(role)
}
