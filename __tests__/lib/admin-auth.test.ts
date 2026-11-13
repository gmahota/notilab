/**
 * Role-gating specs for lib/admin-auth.ts.
 *
 * QUALITY_GATE.md listed this module as having no coverage while it was the
 * single point every admin route depends on for its authorization decision.
 * These tests pin the behaviour that matters: which tokens are accepted, which
 * are rejected, and — importantly — they document the JWT_SECRET fallback
 * rather than asserting it is safe.
 *
 * Scope note: this session owns the *gate*, not the defects. The tests below
 * therefore encode current behaviour, and the two marked FIXME are expected to
 * be inverted by the task that fixes ROADMAP #23. They exist so that fix has a
 * failing test to turn green, instead of landing unverified.
 */

// Marks this file as a module. Without it TypeScript treats a file whose only
// imports are dynamic as a global script, and `loadModule` below collides with
// the identically-named helper in base-url.test.ts (TS2393).
export {}

const ORIGINAL_ENV = process.env

/**
 * admin-auth reads JWT_SECRET at module load, so each test needs a fresh module
 * registry to exercise a different secret.
 */
async function loadModule(env: Record<string, string | undefined> = {}) {
  jest.resetModules()
  process.env = { ...ORIGINAL_ENV, ...env }

  const cookieStore = { get: jest.fn(), set: jest.fn() }
  jest.doMock("next/headers", () => ({ cookies: jest.fn(async () => cookieStore) }))

  const mod = await import("@/lib/admin-auth")
  const jwt = (await import("jsonwebtoken")).default
  return { ...mod, cookieStore, jwt }
}

afterEach(() => {
  process.env = ORIGINAL_ENV
  jest.resetModules()
})

const USER = { id: "u1", email: "editor@notilab.com", name: "Editor", role: "REDATOR" }

describe("generateAdminToken / checkAdminAuth round trip", () => {
  it("accepts a token it just issued", async () => {
    const { generateAdminToken, checkAdminAuth, cookieStore } = await loadModule({ JWT_SECRET: "test-secret" })

    const token = generateAdminToken(USER)
    cookieStore.get.mockReturnValue({ value: token })

    await expect(checkAdminAuth()).resolves.toEqual(USER)
  })

  it("returns null when no admin-token cookie is present", async () => {
    const { checkAdminAuth, cookieStore } = await loadModule({ JWT_SECRET: "test-secret" })
    cookieStore.get.mockReturnValue(undefined)

    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("returns null for a malformed token", async () => {
    const { checkAdminAuth, cookieStore } = await loadModule({ JWT_SECRET: "test-secret" })
    cookieStore.get.mockReturnValue({ value: "not-a-jwt" })

    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("rejects a token signed with a different secret", async () => {
    const signer = await loadModule({ JWT_SECRET: "attacker-secret" })
    const forged = signer.generateAdminToken({ ...USER, role: "SUPER_ADMIN" })

    const { checkAdminAuth, cookieStore } = await loadModule({ JWT_SECRET: "real-secret" })
    cookieStore.get.mockReturnValue({ value: forged })

    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("rejects an expired token", async () => {
    const { checkAdminAuth, cookieStore, jwt } = await loadModule({ JWT_SECRET: "test-secret" })
    const expired = jwt.sign(USER, "test-secret", { expiresIn: -10 })
    cookieStore.get.mockReturnValue({ value: expired })

    await expect(checkAdminAuth()).resolves.toBeNull()
  })
})

describe("role gating", () => {
  const ACCEPTED = ["REDATOR", "REVISOR", "SUPERVISOR", "MARKETING", "CRIADOR_CONTEUDO", "ADMIN", "SUPER_ADMIN"]

  it.each(ACCEPTED)("accepts the %s role", async (role) => {
    const { generateAdminToken, checkAdminAuth, cookieStore } = await loadModule({ JWT_SECRET: "test-secret" })
    cookieStore.get.mockReturnValue({ value: generateAdminToken({ ...USER, role }) })

    await expect(checkAdminAuth()).resolves.toMatchObject({ role })
  })

  // The complement matters as much as the allowlist: a plain reader must not
  // pass a check every admin route treats as sufficient.
  it.each(["USER", "READER", "", "redator", "SUPER_ADMIN "])(
    "rejects the non-admin role %p",
    async (role) => {
      const { generateAdminToken, checkAdminAuth, cookieStore } = await loadModule({ JWT_SECRET: "test-secret" })
      cookieStore.get.mockReturnValue({ value: generateAdminToken({ ...USER, role }) })

      await expect(checkAdminAuth()).resolves.toBeNull()
    },
  )

  it("rejects a token carrying no role at all", async () => {
    const { checkAdminAuth, cookieStore, jwt } = await loadModule({ JWT_SECRET: "test-secret" })
    cookieStore.get.mockReturnValue({ value: jwt.sign({ id: "u1", email: "a@b.c" }, "test-secret") })

    await expect(checkAdminAuth()).resolves.toBeNull()
  })

  it("rejects an alg:none token, which would otherwise bypass the signature", async () => {
    const { checkAdminAuth, cookieStore } = await loadModule({ JWT_SECRET: "test-secret" })

    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")
    const payload = Buffer.from(JSON.stringify({ ...USER, role: "SUPER_ADMIN" })).toString("base64url")
    cookieStore.get.mockReturnValue({ value: `${header}.${payload}.` })

    await expect(checkAdminAuth()).resolves.toBeNull()
  })
})

describe("JWT_SECRET configuration (documents current, unsafe behaviour)", () => {
  // FIXME(ROADMAP #23): both expectations below should invert once admin-auth
  // throws on a missing JWT_SECRET instead of substituting a literal. They are
  // written as the current behaviour deliberately — a test asserting the fixed
  // behaviour today would just be a failing test nobody reads.

  it("falls back to a hardcoded secret when JWT_SECRET is unset", async () => {
    const { generateAdminToken } = await loadModule({ JWT_SECRET: undefined })
    const token = generateAdminToken(USER)

    const jwt = (await import("jsonwebtoken")).default
    // Anyone who has read lib/admin-auth.ts can verify — and mint — these.
    expect(() => jwt.verify(token, "your-secret-key")).not.toThrow()
  })

  it("accepts a token an outsider forged with the published fallback secret", async () => {
    const { checkAdminAuth, cookieStore } = await loadModule({ JWT_SECRET: undefined })
    const jwt = (await import("jsonwebtoken")).default

    const forged = jwt.sign({ ...USER, role: "SUPER_ADMIN" }, "your-secret-key", { expiresIn: "8h" })
    cookieStore.get.mockReturnValue({ value: forged })

    await expect(checkAdminAuth()).resolves.toMatchObject({ role: "SUPER_ADMIN" })
  })
})
