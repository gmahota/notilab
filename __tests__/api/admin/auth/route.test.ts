/**
 * POST /api/admin/auth — the login endpoint.
 *
 * Two properties are asserted here that a unit test of the service below cannot
 * see, because they are properties of the HTTP response:
 *
 *  1. An unknown address and a wrong password are indistinguishable — same
 *     status, same body. The previous implementation answered "Usuário não
 *     encontrado" or "Senha incorreta", which made the form a user directory.
 *  2. The session cookie is still httpOnly and still 8 hours. ROADMAP #39 was
 *     not allowed to weaken anything on its way past. Renaming the cookie
 *     belongs to ROADMAP #42.
 */

import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"

interface CookieCall {
  name: string
  value: string
  options: Record<string, unknown>
}

const cookieCalls: CookieCall[] = []

jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: (name: string, value: string, options: Record<string, unknown>) => {
      cookieCalls.push({ name, value, options })
    },
  }),
}))

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}))

import { POST } from "@/app/api/admin/auth/route"
import { prisma } from "@/lib/prisma"

const findUnique = prisma.user.findUnique as unknown as jest.Mock

const env = process.env as Record<string, string | undefined>
const GOOD_SECRET = "0123456789abcdef0123456789abcdef"
const PASSWORD = "a-correct-horse-battery-staple"
const originalSecret = process.env.JWT_SECRET

let passwordHash: string

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 6)
})

afterAll(() => {
  if (originalSecret === undefined) delete env.JWT_SECRET
  else env.JWT_SECRET = originalSecret
})

let warn: jest.SpyInstance
let error: jest.SpyInstance

beforeEach(() => {
  cookieCalls.length = 0
  env.JWT_SECRET = GOOD_SECRET
  findUnique.mockResolvedValue({
    id: "user-1",
    email: "editor@notilab.com",
    name: "Editor",
    role: "REDATOR",
    isActive: true,
    password: passwordHash,
  })
  // Kept quiet, and inspected: the log must not contain the address that was
  // tried (AGENTS.md § Security First — never log personal data).
  warn = jest.spyOn(console, "warn").mockImplementation(() => {})
  error = jest.spyOn(console, "error").mockImplementation(() => {})
})

async function login(body: unknown, raw?: string): Promise<Response> {
  return POST(
    new NextRequest("http://localhost:3000/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }),
  )
}

describe("a successful login", () => {
  it("returns the user and sets an 8-hour httpOnly cookie", async () => {
    const response = await login({ email: "editor@notilab.com", password: PASSWORD })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      user: { id: "user-1", email: "editor@notilab.com", name: "Editor", role: "REDATOR" },
    })

    expect(cookieCalls).toHaveLength(1)
    expect(cookieCalls[0].name).toBe("admin-token")
    expect(cookieCalls[0].options).toEqual(
      expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 8 * 60 * 60 }),
    )
  })
})

describe("failures are indistinguishable", () => {
  /** Status + body, which is all a caller can see. */
  async function outcome(response: Response) {
    return { status: response.status, body: await response.json() }
  }

  it("answers identically for an unknown address and a wrong password", async () => {
    findUnique.mockResolvedValue(null)
    const unknownAddress = await outcome(await login({ email: "nobody@notilab.com", password: PASSWORD }))

    findUnique.mockResolvedValue({
      id: "user-1",
      email: "editor@notilab.com",
      name: "Editor",
      role: "REDATOR",
      isActive: true,
      password: passwordHash,
    })
    const wrongPassword = await outcome(await login({ email: "editor@notilab.com", password: "nope" }))

    expect(unknownAddress).toEqual({ status: 401, body: { error: "Credenciais inválidas" } })
    expect(wrongPassword).toEqual(unknownAddress)
  })

  it("answers the same for a reader, a deactivated account and a passwordless account", async () => {
    const expected = { status: 401, body: { error: "Credenciais inválidas" } }

    for (const row of [
      { role: "USER" },
      { isActive: false },
      { password: null },
    ]) {
      findUnique.mockResolvedValue({
        id: "user-1",
        email: "editor@notilab.com",
        name: "Editor",
        role: "REDATOR",
        isActive: true,
        password: passwordHash,
        ...row,
      })
      await expect(outcome(await login({ email: "editor@notilab.com", password: PASSWORD }))).resolves.toEqual(
        expected,
      )
    }
  })

  it("sets no cookie on failure", async () => {
    findUnique.mockResolvedValue(null)
    await login({ email: "nobody@notilab.com", password: PASSWORD })
    expect(cookieCalls).toHaveLength(0)
  })

  it("does not log the address that was tried", async () => {
    findUnique.mockResolvedValue(null)
    await login({ email: "nobody@notilab.com", password: PASSWORD })

    const logged = [...warn.mock.calls, ...error.mock.calls].flat().join(" ")
    expect(logged).not.toContain("nobody@notilab.com")
    expect(logged).toContain("no-such-user")
  })

  it("rejects a malformed body with 400", async () => {
    const response = await login(undefined, "{not json")
    expect(response.status).toBe(400)
    expect(findUnique).not.toHaveBeenCalled()
  })

  it("rejects a body with no credentials", async () => {
    const response = await login({})
    expect(response.status).toBe(401)
    expect(findUnique).not.toHaveBeenCalled()
  })
})

describe("a deployment with no signing secret", () => {
  it("answers 503 rather than issuing an unsigned session", async () => {
    delete env.JWT_SECRET

    const response = await login({ email: "editor@notilab.com", password: PASSWORD })

    expect(response.status).toBe(503)
    expect(cookieCalls).toHaveLength(0)

    // The operator gets told what to fix; the caller does not get told why.
    const logged = error.mock.calls.flat().join(" ")
    expect(logged).toContain("JWT_SECRET")
    const body = (await response.json()) as { error: string }
    expect(body.error).not.toContain("JWT_SECRET")
  })
})
