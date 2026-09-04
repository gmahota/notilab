/**
 * Admin session authentication.
 *
 * Every case here is one that was silently wrong in production until recently.
 * The module used to fall back to a committed literal, `"your-secret-key"`, so
 * anyone could sign a SUPER_ADMIN cookie; it cast the decoded payload to `any`,
 * so a token with no role at all was accepted; and it let `jsonwebtoken` pick
 * the verification algorithm from the token itself.
 *
 * The asymmetry between the two exported entry points is the thing most worth
 * pinning: checkAdminAuth() must return null and never throw (it renders inside
 * server components, where a throw breaks a page or a prerender), while
 * generateAdminToken() must throw rather than sign with a weak secret.
 *
 * next/jest loads .env, so JWT_SECRET can arrive already set from a developer
 * machine. Every case sets or deletes it explicitly instead of trusting the
 * ambient environment.
 */

import jwt from "jsonwebtoken"

/** Whatever the mocked cookie jar should hand back for `admin-token`. */
let cookieToken: string | null = null

jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "admin-token" && cookieToken !== null ? { value: cookieToken } : undefined,
  }),
}))

import { checkAdminAuth, generateAdminToken, hasAdminRole, isAdminRole } from "@/lib/admin-auth"

/** 64 hex characters, as `openssl rand -hex 32` would produce. */
const GOOD_SECRET = "a".repeat(64)
const OTHER_GOOD_SECRET = "b".repeat(64)
/** The literal this module used to fall back to. */
const COMMITTED_LITERAL = "your-secret-key"

const env = process.env as Record<string, string | undefined>
const originalSecret = process.env.JWT_SECRET

const ADMIN = {
  id: "user_1",
  email: "admin@example.com",
  name: "Super Admin",
  role: "SUPER_ADMIN",
} as const

beforeEach(() => {
  cookieToken = null
  env.JWT_SECRET = GOOD_SECRET
  // The module reports an unusable secret once per process; silence it so the
  // expected error paths do not fill the test output.
  jest.spyOn(console, "error").mockImplementation(() => {})
  jest.spyOn(console, "warn").mockImplementation(() => {})
})

afterAll(() => {
  if (originalSecret === undefined) delete env.JWT_SECRET
  else env.JWT_SECRET = originalSecret
})

describe("an unusable JWT_SECRET", () => {
  const unusable: Array<[string, string | undefined]> = [
    ["unset", undefined],
    ["empty", ""],
    ["whitespace only", "   "],
    ["31 characters, one short of the minimum", "c".repeat(31)],
  ]

  it.each(unusable)("checkAdminAuth returns null when the secret is %s", async (_label, value) => {
    if (value === undefined) delete env.JWT_SECRET
    else env.JWT_SECRET = value

    // A token that would be perfectly valid under a good secret.
    cookieToken = jwt.sign(ADMIN, GOOD_SECRET, { algorithm: "HS256", expiresIn: "8h" })

    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it.each(unusable)("generateAdminToken throws when the secret is %s", (_label, value) => {
    if (value === undefined) delete env.JWT_SECRET
    else env.JWT_SECRET = value

    expect(() => generateAdminToken({ ...ADMIN })).toThrow(/JWT_SECRET/)
  })

  it("reads the secret per call, so setting it later needs no cold start", async () => {
    delete env.JWT_SECRET
    expect(() => generateAdminToken({ ...ADMIN })).toThrow()

    env.JWT_SECRET = GOOD_SECRET
    expect(() => generateAdminToken({ ...ADMIN })).not.toThrow()
  })
})

describe("token acceptance", () => {
  it("accepts a token it signed itself", async () => {
    cookieToken = generateAdminToken({ ...ADMIN })

    await expect(checkAdminAuth()).resolves.toEqual(ADMIN)
  })

  it("returns null when there is no cookie at all", async () => {
    cookieToken = null

    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("rejects a token signed with the old committed literal", async () => {
    cookieToken = jwt.sign(ADMIN, COMMITTED_LITERAL, { algorithm: "HS256" })

    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("rejects a token signed with a different, equally strong secret", async () => {
    cookieToken = jwt.sign(ADMIN, OTHER_GOOD_SECRET, { algorithm: "HS256" })

    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("rejects an alg:none token, signature or not", async () => {
    const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url")
    cookieToken = `${b64({ alg: "none", typ: "JWT" })}.${b64(ADMIN)}.`

    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("rejects an HS384 token even under the correct secret", async () => {
    // Algorithm confusion: the secret is right, but HS256 is pinned on verify.
    cookieToken = jwt.sign(ADMIN, GOOD_SECRET, { algorithm: "HS384" })

    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("rejects an expired token", async () => {
    cookieToken = jwt.sign(ADMIN, GOOD_SECRET, { algorithm: "HS256", expiresIn: "-1s" })

    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("rejects a malformed token without throwing", async () => {
    cookieToken = "not-a-jwt"

    await expect(checkAdminAuth()).resolves.toBeNull()
  })
})

describe("claim validation", () => {
  const malformed: Array<[string, Record<string, unknown>]> = [
    ["no role", { id: "1", email: "a@b.c", name: "A" }],
    ["role USER", { id: "1", email: "a@b.c", name: "A", role: "USER" }],
    ["an unrecognised role", { id: "1", email: "a@b.c", name: "A", role: "OWNER" }],
    ["a non-string role", { id: "1", email: "a@b.c", name: "A", role: { admin: true } }],
    ["a non-string id", { id: { toString: 1 }, email: "a@b.c", name: "A", role: "ADMIN" }],
    ["no id", { email: "a@b.c", name: "A", role: "ADMIN" }],
    ["a blank name", { id: "1", email: "a@b.c", name: "   ", role: "ADMIN" }],
    ["no email", { id: "1", name: "A", role: "ADMIN" }],
  ]

  it.each(malformed)("rejects a correctly signed token with %s", async (_label, claims) => {
    cookieToken = jwt.sign(claims, GOOD_SECRET, { algorithm: "HS256" })

    await expect(checkAdminAuth()).resolves.toBeNull()
  })
})

describe("role gating", () => {
  it("admits any administrative role when no role is required", async () => {
    for (const role of ["REDATOR", "REVISOR", "SUPERVISOR", "MARKETING", "CRIADOR_CONTEUDO", "ADMIN", "SUPER_ADMIN"] as const) {
      cookieToken = generateAdminToken({ ...ADMIN, role })
      await expect(checkAdminAuth()).resolves.toMatchObject({ role })
    }
  })

  it("admits a matching required role", async () => {
    cookieToken = generateAdminToken({ ...ADMIN, role: "SUPER_ADMIN" })

    await expect(checkAdminAuth(["SUPER_ADMIN"])).resolves.toMatchObject({ role: "SUPER_ADMIN" })
  })

  it("refuses an administrative role that is not the required one", async () => {
    cookieToken = generateAdminToken({ ...ADMIN, role: "REDATOR" })

    await expect(checkAdminAuth(["SUPER_ADMIN", "ADMIN"])).resolves.toBeNull()
  })

  it("never grants USER, even to a caller that mistakenly allows it", () => {
    // The guard against a copy-paste `["USER"]` in some future route.
    expect(hasAdminRole({ ...ADMIN, role: "USER" }, ["USER"])).toBe(false)
    expect(hasAdminRole(null, ["SUPER_ADMIN"])).toBe(false)
    expect(isAdminRole("USER")).toBe(false)
    expect(isAdminRole("SUPER_ADMIN")).toBe(true)
    expect(isAdminRole(undefined)).toBe(false)
  })

  it("refuses to sign a token for a non-administrative role", () => {
    expect(() => generateAdminToken({ ...ADMIN, role: "USER" })).toThrow(/non-admin role/)
  })
})

describe("what ends up in the token", () => {
  it("carries only the four identity claims", () => {
    const token = generateAdminToken({ ...ADMIN })
    const payload = jwt.verify(token, GOOD_SECRET) as Record<string, unknown>

    // iat/exp are added by jsonwebtoken; nothing else should be there.
    expect(Object.keys(payload).sort()).toEqual(["email", "exp", "iat", "id", "name", "role"])
  })

  it("pins HS256 in the header", () => {
    const token = generateAdminToken({ ...ADMIN })
    const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString())

    expect(header.alg).toBe("HS256")
  })
})
