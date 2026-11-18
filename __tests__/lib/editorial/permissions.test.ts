/**
 * The per-edge role matrix.
 *
 * These cases encode the acceptance criterion the strategy wrote down for
 * Phase 4 — "a REDATOR account is refused the publish transition" — plus the
 * trap that criterion exists to catch: `UserRole`'s declaration order is not an
 * authority ladder, so any `role >= SUPERVISOR` implementation passes a naive
 * test and still hands publish rights to MARKETING and CRIADOR_CONTEUDO.
 */

import {
  allowedTargetsForRole,
  assertTransitionRolesCoverAllEdges,
  canClearReview,
  canRoleTransition,
} from "@/lib/editorial/permissions"
import { ALLOWED_TRANSITIONS, ARTICLE_STATUSES } from "@/lib/editorial/transitions"
import type { UserRole } from "@/lib/generated/prisma"

const ALL_ROLES: UserRole[] = [
  "USER",
  "REDATOR",
  "REVISOR",
  "SUPERVISOR",
  "MARKETING",
  "CRIADOR_CONTEUDO",
  "ADMIN",
  "SUPER_ADMIN",
]

describe("the matrix covers the transition table", () => {
  it("names at least one role for every legal edge, and none for an illegal one", () => {
    expect(() => assertTransitionRolesCoverAllEdges()).not.toThrow()
  })
})

describe("nobody authors their way to publication", () => {
  it.each(["REDATOR", "CRIADOR_CONTEUDO"] as const)("refuses %s the publish transition", (role) => {
    expect(canRoleTransition(role, "APPROVED", "PUBLISHED")).toBe(false)
  })

  it.each(["REDATOR", "CRIADOR_CONTEUDO"] as const)("refuses %s the approve transition", (role) => {
    expect(canRoleTransition(role, "PENDING_REVIEW", "APPROVED")).toBe(false)
  })

  it("lets both of them submit for review, which is where they stop", () => {
    expect(canRoleTransition("REDATOR", "DRAFT", "PENDING_REVIEW")).toBe(true)
    expect(canRoleTransition("CRIADOR_CONTEUDO", "DRAFT", "PENDING_REVIEW")).toBe(true)
    expect(allowedTargetsForRole("REDATOR", "DRAFT")).toEqual(["PENDING_REVIEW"])
  })
})

describe("the enum order is not an authority ladder", () => {
  // MARKETING and CRIADOR_CONTEUDO are declared *above* SUPERVISOR. A
  // `role >= SUPERVISOR` check would pass every case above and fail these.
  it("gives MARKETING no lifecycle transition at all", () => {
    for (const from of ARTICLE_STATUSES) {
      expect(allowedTargetsForRole("MARKETING", from)).toEqual([])
    }
  })

  it("refuses MARKETING the publish transition specifically", () => {
    expect(canRoleTransition("MARKETING", "APPROVED", "PUBLISHED")).toBe(false)
  })

  it("gives USER nothing", () => {
    for (const from of ARTICLE_STATUSES) {
      expect(allowedTargetsForRole("USER", from)).toEqual([])
    }
  })
})

describe("the REVISOR / SUPERVISOR split", () => {
  it("never lets a REVISOR publish", () => {
    expect(canRoleTransition("REVISOR", "APPROVED", "PUBLISHED")).toBe(false)
  })

  it("never lets a REVISOR reach APPROVED alone", () => {
    expect(canRoleTransition("REVISOR", "PENDING_REVIEW", "APPROVED")).toBe(false)
  })

  it("lets a REVISOR send an article back for fixes", () => {
    expect(canRoleTransition("REVISOR", "PENDING_REVIEW", "DRAFT")).toBe(true)
  })

  it("lets a REVISOR clear a review, and a REDATOR not", () => {
    expect(canClearReview("REVISOR")).toBe(true)
    expect(canClearReview("REDATOR")).toBe(false)
    expect(canClearReview("MARKETING")).toBe(false)
  })

  it("lets a SUPERVISOR approve and publish", () => {
    expect(canRoleTransition("SUPERVISOR", "PENDING_REVIEW", "APPROVED")).toBe(true)
    expect(canRoleTransition("SUPERVISOR", "APPROVED", "PUBLISHED")).toBe(true)
  })
})

describe("ADMIN is not a bypass", () => {
  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "refuses %s a transition the table forbids for everyone",
    (role) => {
      // There is no DRAFT -> PUBLISHED edge. Elevation does not create one.
      expect(canRoleTransition(role, "DRAFT", "PUBLISHED")).toBe(false)
    },
  )

  it("lets elevated roles traverse every edge that does exist", () => {
    for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      for (const to of targets) {
        expect(canRoleTransition("SUPER_ADMIN", from as never, to)).toBe(true)
      }
    }
  })
})

describe("terminal states stay terminal", () => {
  it.each(["REJECTED", "ARCHIVED"] as const)("offers nobody a move out of %s", (from) => {
    for (const role of ALL_ROLES) {
      expect(allowedTargetsForRole(role, from)).toEqual([])
    }
  })
})
