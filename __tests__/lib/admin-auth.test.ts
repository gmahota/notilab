/**
 * lib/admin-auth.ts signs and verifies every admin session.
 *
 * The defect these tests exist to prevent regressing (ROADMAP #38): the module
 * used to read `process.env.JWT_SECRET || "your-secret-key"`, so a deployment
 * with no secret configured signed and accepted tokens with a key published in
 * this repository. The two cases the AC names — absent and empty string — are
 * covered explicitly, plus whitespace-only, which is what a platform env UI
 * actually produces.
 *
 * The secret is read at call time rather than at module load (see the comment on
 * requireSigningSecret), so these tests can mutate process.env directly instead
 * of reloading the module.
 */

import { readFileSync } from "node:fs"
import path from "node:path"
import jwt from "jsonwebtoken"

/** Stands in for the Next cookie store, which is request-scoped in real life. */
const cookieJar = new Map<string, string>()

jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
    set: (name: string, value: string) => {
      cookieJar.set(name, value)
    },
  }),
}))

import {
  checkAdminAuth,
  generateAdminToken,
  isStaffRole,
  MissingSigningSecretError,
  requireSigningSecret,
  STAFF_ROLES,
  type AdminUser,
} from "@/lib/admin-auth"

/** NODE_ENV and friends are narrowly typed; go through a widened view. */
const env = process.env as Record<string, string | undefined>

/** Exactly at the 32-character floor. */
const GOOD_SECRET = "0123456789abcdef0123456789abcdef"

const STAFF: AdminUser = {
  id: "user-1",
  email: "editor@notilab.com",
  name: "Editor",
  role: "REDATOR",
}

const originalSecret = process.env.JWT_SECRET

beforeEach(() => {
  cookieJar.clear()
  // next/jest loads .env, so JWT_SECRET can arrive already set from a
  // developer's machine. Pin it rather than trusting the ambient value.
  env.JWT_SECRET = GOOD_SECRET
})

afterAll(() => {
  if (originalSecret === undefined) delete env.JWT_SECRET
  else env.JWT_SECRET = originalSecret
})

/** Puts a token in the jar the way a browser would. */
function presentToken(token: string): void {
  cookieJar.set("admin-token", token)
}

describe("an unusable JWT_SECRET", () => {
  const unusable: Array<[string, string | undefined]> = [
    ["absent", undefined],
    ["an empty string", ""],
    ["whitespace only", "   \n\t "],
    ["shorter than 32 characters", "short-secret"],
  ]

  it.each(unusable)("refuses to sign a token when JWT_SECRET is %s", (_label, value) => {
    if (value === undefined) delete env.JWT_SECRET
    else env.JWT_SECRET = value

    expect(() => generateAdminToken(STAFF)).toThrow(MissingSigningSecretError)
  })

  it.each(unusable)("names the variable and the fix when JWT_SECRET is %s", (_label, value) => {
    if (value === undefined) delete env.JWT_SECRET
    else env.JWT_SECRET = value

    expect(() => requireSigningSecret()).toThrow(/JWT_SECRET/)
    expect(() => requireSigningSecret()).toThrow(/openssl rand -hex 32/)
  })

  it("never substitutes the old committed literal", () => {
    delete env.JWT_SECRET
    expect(() => requireSigningSecret()).toThrow(MissingSigningSecretError)

    // The forged token an attacker could previously mint from the repository.
    env.JWT_SECRET = GOOD_SECRET
    const forged = jwt.sign({ ...STAFF, role: "SUPER_ADMIN" }, "your-secret-key", {
      expiresIn: "8h",
    })
    presentToken(forged)
    return expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("throws rather than reporting 'nobody is signed in' when a token is presented", async () => {
    const token = generateAdminToken(STAFF)
    presentToken(token)
    delete env.JWT_SECRET

    // A silent null here would turn a misconfiguration into an unexplained
    // permission failure for every staff member at once.
    await expect(checkAdminAuth()).rejects.toThrow(MissingSigningSecretError)
  })

  it("still reports no session for a visitor with no cookie", async () => {
    delete env.JWT_SECRET
    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("carries a named error type, so callers can tell config from credentials", () => {
    delete env.JWT_SECRET
    try {
      requireSigningSecret()
      throw new Error("expected requireSigningSecret to throw")
    } catch (error) {
      expect((error as Error).name).toBe("MissingSigningSecretError")
    }
  })
})

describe("a usable JWT_SECRET", () => {
  it("round-trips a staff session", async () => {
    presentToken(generateAdminToken(STAFF))
    await expect(checkAdminAuth()).resolves.toEqual(STAFF)
  })

  it("treats a secret with surrounding whitespace as the trimmed value", async () => {
    env.JWT_SECRET = `  ${GOOD_SECRET}\n`
    presentToken(generateAdminToken(STAFF))

    env.JWT_SECRET = GOOD_SECRET
    await expect(checkAdminAuth()).resolves.toEqual(STAFF)
  })
})

describe("token rejection", () => {
  it("rejects a token signed with another secret", async () => {
    const forged = jwt.sign(STAFF, `${GOOD_SECRET}-attacker`, { expiresIn: "8h" })
    presentToken(forged)
    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("rejects an unsigned alg:none token", async () => {
    const unsigned = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url",
    )}.${Buffer.from(JSON.stringify({ ...STAFF, role: "SUPER_ADMIN" })).toString("base64url")}.`
    presentToken(unsigned)
    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("rejects an expired token", async () => {
    presentToken(jwt.sign(STAFF, GOOD_SECRET, { expiresIn: -60 }))
    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("rejects garbage", async () => {
    presentToken("not-a-jwt")
    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("rejects a validly signed token whose role is not staff", async () => {
    presentToken(jwt.sign({ ...STAFF, role: "USER" }, GOOD_SECRET, { expiresIn: "8h" }))
    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("rejects a validly signed token with no id", async () => {
    presentToken(jwt.sign({ email: STAFF.email, role: "ADMIN" }, GOOD_SECRET, { expiresIn: "8h" }))
    await expect(checkAdminAuth()).resolves.toBeNull()
  })
})

describe("STAFF_ROLES", () => {
  it("admits every staff role and no reader", () => {
    for (const role of STAFF_ROLES) expect(isStaffRole(role)).toBe(true)
    expect(isStaffRole("USER")).toBe(false)
    expect(isStaffRole("")).toBe(false)
    expect(isStaffRole(undefined)).toBe(false)
    expect(isStaffRole({ role: "ADMIN" })).toBe(false)
  })

  /**
   * The role list is duplicated nowhere in code, but it does duplicate the
   * schema. If someone adds a UserRole value, this fails and forces a decision
   * about whether the new role reaches /admin — rather than it silently not.
   */
  it("is exactly the UserRole enum minus USER", () => {
    const schema = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8")
    const block = /enum UserRole \{([^}]*)\}/.exec(schema)
    expect(block).not.toBeNull()

    const schemaRoles = (block as RegExpExecArray)[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("//"))

    expect(schemaRoles).toContain("USER")
    expect([...STAFF_ROLES].sort()).toEqual(schemaRoles.filter((r) => r !== "USER").sort())
  })
})
