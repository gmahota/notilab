/**
 * lib/admin/staff-auth.ts is the whole of "may this person into /admin".
 *
 * It replaced a three-entry array whose accounts all shared the published
 * bcrypt test vector for the password `password` (ROADMAP #39). The failure
 * mode to guard against now is different and quieter: User.password is
 * nullable, and will be null for every magic-link reader after ROADMAP #42, so
 * a passwordless row must be unauthenticable by construction — not because a
 * particular bcrypt build happens to return false for a null hash.
 */

import bcrypt from "bcryptjs"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}))

import { authenticateStaff, normalizeEmail } from "@/lib/admin/staff-auth"
import { prisma } from "@/lib/prisma"

const findUnique = prisma.user.findUnique as unknown as jest.Mock

const PASSWORD = "a-correct-horse-battery-staple"

/** Cost 6 rather than 10: nothing here measures hashing, only comparison. */
let passwordHash: string

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 6)
})

function staffRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "editor@notilab.com",
    name: "Editor",
    role: "REDATOR",
    isActive: true,
    password: passwordHash,
    ...overrides,
  }
}

beforeEach(() => {
  findUnique.mockResolvedValue(staffRow())
})

describe("a valid staff login", () => {
  it("returns the user for the right password", async () => {
    const result = await authenticateStaff("editor@notilab.com", PASSWORD)

    expect(result).toEqual({
      ok: true,
      user: { id: "user-1", email: "editor@notilab.com", name: "Editor", role: "REDATOR" },
    })
  })

  it("looks the address up by an exact, lowercased unique match", async () => {
    await authenticateStaff("  Editor@NotiLab.com  ", PASSWORD)

    expect(findUnique).toHaveBeenCalledTimes(1)
    expect(findUnique.mock.calls[0][0].where).toEqual({ email: "editor@notilab.com" })
  })

  it("falls back to the email when the account has no name", async () => {
    findUnique.mockResolvedValue(staffRow({ name: null }))
    const result = await authenticateStaff("editor@notilab.com", PASSWORD)

    expect(result).toEqual({
      ok: true,
      user: expect.objectContaining({ name: "editor@notilab.com" }),
    })
  })

  it("accepts every staff role", async () => {
    for (const role of ["REDATOR", "REVISOR", "SUPERVISOR", "MARKETING", "CRIADOR_CONTEUDO", "ADMIN", "SUPER_ADMIN"]) {
      findUnique.mockResolvedValue(staffRow({ role }))
      await expect(authenticateStaff("editor@notilab.com", PASSWORD)).resolves.toEqual(
        expect.objectContaining({ ok: true }),
      )
    }
  })
})

describe("a null or blank password column never authenticates", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["whitespace only", "   "],
  ])("refuses a row whose password is %s", async (_label, password) => {
    findUnique.mockResolvedValue(staffRow({ password }))

    await expect(authenticateStaff("editor@notilab.com", PASSWORD)).resolves.toEqual({
      ok: false,
      reason: "no-password-set",
    })
  })

  it("refuses any submitted password against a passwordless row", async () => {
    findUnique.mockResolvedValue(staffRow({ password: null }))

    for (const attempt of ["", " ", "password", PASSWORD, "null", "undefined"]) {
      await expect(authenticateStaff("editor@notilab.com", attempt)).resolves.toEqual(
        expect.objectContaining({ ok: false }),
      )
    }
  })
})

/**
 * The strongest form of the check above: replace bcrypt with a library that
 * says yes to everything, and the passwordless row must still be refused. This
 * is what "unauthenticable by construction" means — the comparison is never
 * reached, so its result cannot matter.
 */
describe("with a bcrypt that approves everything", () => {
  function loadWithPermissiveBcrypt(): typeof import("@/lib/admin/staff-auth") {
    let mod!: typeof import("@/lib/admin/staff-auth")
    jest.isolateModules(() => {
      jest.doMock("bcryptjs", () => ({
        __esModule: true,
        default: {
          compare: jest.fn().mockResolvedValue(true),
          hash: jest.fn().mockResolvedValue("hashed"),
        },
      }))
      mod = require("@/lib/admin/staff-auth") as typeof import("@/lib/admin/staff-auth")
    })
    return mod
  }

  afterEach(() => {
    jest.dontMock("bcryptjs")
  })

  // The control: proves the permissive mock is actually in effect, so the
  // refusals below mean something.
  it("does let a wrong password through, when the row has a hash", async () => {
    findUnique.mockResolvedValue(staffRow())
    const { authenticateStaff: authenticate } = loadWithPermissiveBcrypt()

    await expect(authenticate("editor@notilab.com", "wrong")).resolves.toEqual(
      expect.objectContaining({ ok: true }),
    )
  })

  it("still refuses a row with a null password", async () => {
    findUnique.mockResolvedValue(staffRow({ password: null }))
    const { authenticateStaff: authenticate } = loadWithPermissiveBcrypt()

    await expect(authenticate("editor@notilab.com", "anything")).resolves.toEqual({
      ok: false,
      reason: "no-password-set",
    })
  })

  it("still refuses a reader, an inactive account and an unknown address", async () => {
    const { authenticateStaff: authenticate } = loadWithPermissiveBcrypt()

    findUnique.mockResolvedValue(staffRow({ role: "USER" }))
    await expect(authenticate("editor@notilab.com", "anything")).resolves.toEqual({
      ok: false,
      reason: "not-staff",
    })

    findUnique.mockResolvedValue(staffRow({ isActive: false }))
    await expect(authenticate("editor@notilab.com", "anything")).resolves.toEqual({
      ok: false,
      reason: "inactive",
    })

    findUnique.mockResolvedValue(null)
    await expect(authenticate("nobody@notilab.com", "anything")).resolves.toEqual({
      ok: false,
      reason: "no-such-user",
    })
  })
})

describe("other rejections", () => {
  it("refuses an unknown address", async () => {
    findUnique.mockResolvedValue(null)
    await expect(authenticateStaff("nobody@notilab.com", PASSWORD)).resolves.toEqual({
      ok: false,
      reason: "no-such-user",
    })
  })

  it("refuses the wrong password", async () => {
    await expect(authenticateStaff("editor@notilab.com", "wrong-password-entirely")).resolves.toEqual({
      ok: false,
      reason: "wrong-password",
    })
  })

  it("refuses a reader who happens to know their password", async () => {
    findUnique.mockResolvedValue(staffRow({ role: "USER" }))
    await expect(authenticateStaff("editor@notilab.com", PASSWORD)).resolves.toEqual({
      ok: false,
      reason: "not-staff",
    })
  })

  it("refuses an unknown role value", async () => {
    findUnique.mockResolvedValue(staffRow({ role: "ROOT" }))
    await expect(authenticateStaff("editor@notilab.com", PASSWORD)).resolves.toEqual({
      ok: false,
      reason: "not-staff",
    })
  })

  it("refuses a deactivated staff account", async () => {
    findUnique.mockResolvedValue(staffRow({ isActive: false }))
    await expect(authenticateStaff("editor@notilab.com", PASSWORD)).resolves.toEqual({
      ok: false,
      reason: "inactive",
    })
  })

  it.each([
    ["a missing password", "editor@notilab.com", undefined],
    ["a null password", "editor@notilab.com", null],
    ["an object password", "editor@notilab.com", { toString: (): string => PASSWORD }],
    ["an empty password", "editor@notilab.com", ""],
    ["a missing email", undefined, PASSWORD],
    ["a numeric email", 42, PASSWORD],
    ["an empty email", "   ", PASSWORD],
  ])("refuses %s without touching the database", async (_label, email, password) => {
    await expect(authenticateStaff(email, password)).resolves.toEqual({
      ok: false,
      reason: "malformed-input",
    })
    expect(findUnique).not.toHaveBeenCalled()
  })
})

describe("the three published-hash accounts", () => {
  /**
   * The old array is gone, so these addresses are ordinary strings now. The
   * point of the test is that the code path has no knowledge of them at all:
   * with no row in the database, `password` does not get anyone in.
   */
  it.each(["admin@notilab.com", "redator@notilab.com", "revisor@notilab.com"])(
    "%s cannot log in with the password `password`",
    async (email) => {
      findUnique.mockResolvedValue(null)
      await expect(authenticateStaff(email, "password")).resolves.toEqual(
        expect.objectContaining({ ok: false }),
      )
    },
  )
})

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Editor@NotiLab.COM ")).toBe("editor@notilab.com")
  })
})
