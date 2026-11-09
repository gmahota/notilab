/**
 * lib/auth/tiers.ts is the one place that answers "what is this role allowed to
 * be", and `lib/admin-auth.ts` now reads the admin gate from it. Two things are
 * therefore worth pinning hard.
 *
 * First, every one of the eight `UserRole` values is covered explicitly rather
 * than through a loop over the matrix — a loop would pass against a matrix that
 * had been edited wrongly, because it would be asserting the matrix against
 * itself. The roadmap AC for #42 asks for exactly this.
 *
 * Second, the membership that moved out of `lib/admin-auth.ts` is unchanged:
 * staff is every role except USER. If that set ever shifts it must be a
 * deliberate edit to this file, not a side effect of a refactor.
 */

import type { UserRole } from "@/lib/generated/prisma"
import {
  TIER_OF_ROLE,
  hasRole,
  isReaderOrAbove,
  isStaffRole,
  tierOf,
} from "@/lib/auth/tiers"

/** Written out, not derived — see the note above. */
const ALL_ROLES: readonly UserRole[] = [
  "USER",
  "REDATOR",
  "REVISOR",
  "SUPERVISOR",
  "MARKETING",
  "CRIADOR_CONTEUDO",
  "ADMIN",
  "SUPER_ADMIN",
]

describe("tierOf", () => {
  it("places a plain USER in the reader tier", () => {
    expect(tierOf("USER")).toBe("reader")
  })

  it.each([
    "REDATOR",
    "REVISOR",
    "SUPERVISOR",
    "MARKETING",
    "CRIADOR_CONTEUDO",
    "ADMIN",
    "SUPER_ADMIN",
  ] as const)("places %s in the staff tier", (role) => {
    expect(tierOf(role)).toBe("staff")
  })

  it("treats no role as the visitor tier, not as an error", () => {
    expect(tierOf(null)).toBe("visitor")
    expect(tierOf(undefined)).toBe("visitor")
  })

  it("treats a role the enum does not contain as a visitor", () => {
    // A JWT with a good signature still proves nothing about its claims.
    expect(tierOf("SUPER_DUPER_ADMIN" as UserRole)).toBe("visitor")
  })
})

describe("isStaffRole", () => {
  it("admits every role except USER, and no others", () => {
    const staff = ALL_ROLES.filter((role) => isStaffRole(role))
    expect(staff).toEqual([
      "REDATOR",
      "REVISOR",
      "SUPERVISOR",
      "MARKETING",
      "CRIADOR_CONTEUDO",
      "ADMIN",
      "SUPER_ADMIN",
    ])
  })

  it("refuses a reader and a visitor", () => {
    expect(isStaffRole("USER")).toBe(false)
    expect(isStaffRole(null)).toBe(false)
    expect(isStaffRole(undefined)).toBe(false)
  })
})

describe("isReaderOrAbove", () => {
  it("admits every signed-in role, staff included", () => {
    for (const role of ALL_ROLES) {
      expect(isReaderOrAbove(role)).toBe(true)
    }
  })

  it("refuses a visitor", () => {
    expect(isReaderOrAbove(null)).toBe(false)
    expect(isReaderOrAbove(undefined)).toBe(false)
  })
})

describe("hasRole", () => {
  it("is exact membership, with no implied ladder", () => {
    // The enum's order is not an authority ladder: MARKETING and
    // CRIADOR_CONTEUDO are declared above SUPERVISOR, so nothing may read
    // "SUPERVISOR and above" out of it.
    expect(hasRole("SUPERVISOR", ["SUPERVISOR", "ADMIN", "SUPER_ADMIN"])).toBe(true)
    expect(hasRole("MARKETING", ["SUPERVISOR", "ADMIN", "SUPER_ADMIN"])).toBe(false)
    expect(hasRole("SUPER_ADMIN", ["SUPERVISOR"])).toBe(false)
  })

  it("refuses a visitor against any list, including an empty one", () => {
    expect(hasRole(null, ALL_ROLES)).toBe(false)
    expect(hasRole(undefined, ALL_ROLES)).toBe(false)
    expect(hasRole("ADMIN", [])).toBe(false)
  })
})

describe("the matrix itself", () => {
  it("has an entry for all eight roles and nothing else", () => {
    expect(Object.keys(TIER_OF_ROLE).sort()).toEqual([...ALL_ROLES].sort())
  })
})
