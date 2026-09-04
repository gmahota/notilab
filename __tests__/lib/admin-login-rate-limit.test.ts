/**
 * The brake on admin password guessing, and the password policy it leans on.
 *
 * Account lockout was rejected for this system (the admin address is
 * effectively public, so a lockout is a denial-of-service lever), which leaves
 * this limiter and password length as the only things standing between an
 * online guesser and an 8-hour SUPER_ADMIN session. Both are pinned here.
 *
 * The cost-factor assertion at the bottom is the one most worth having. The
 * login route spends a bcrypt comparison on every rejection so that a miss
 * takes as long as a hit; if the dummy hash it compares against were ever
 * regenerated at a different cost than the real stored hashes, that defence
 * would invert into the very timing oracle it exists to remove, and nothing
 * else in the system would notice.
 */

import bcrypt from "bcryptjs"
import {
  clientKeyFromHeaders,
  consumeLoginRateLimit,
  resetAllLoginRateLimits,
  resetLoginRateLimit,
} from "@/lib/admin-login-rate-limit"
import { BCRYPT_COST, MIN_ADMIN_PASSWORD_LENGTH, TIMING_EQUALIZER_HASH } from "@/lib/admin-password"

const env = process.env as Record<string, string | undefined>
const RATE_VARS = ["ADMIN_LOGIN_RATE_LIMIT", "ADMIN_LOGIN_RATE_WINDOW_MS"] as const
const originalEnv = { ...process.env }

beforeEach(() => {
  resetAllLoginRateLimits()
  // next/jest loads .env, so these can arrive already set.
  for (const name of RATE_VARS) delete env[name]
})

afterAll(() => {
  for (const name of RATE_VARS) {
    if (originalEnv[name] === undefined) delete env[name]
    else env[name] = originalEnv[name]
  }
})

describe("the login limiter", () => {
  it("allows ten attempts and blocks the eleventh", () => {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      expect(consumeLoginRateLimit("1.2.3.4").allowed).toBe(true)
    }

    const blocked = consumeLoginRateLimit("1.2.3.4")
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    // Sent as Retry-After, so it has to be a usable number of seconds.
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(15 * 60)
  })

  it("counts each client separately", () => {
    for (let attempt = 1; attempt <= 11; attempt += 1) consumeLoginRateLimit("1.2.3.4")

    expect(consumeLoginRateLimit("5.6.7.8").allowed).toBe(true)
  })

  it("reopens once the window has passed", () => {
    const start = 1_000_000
    for (let attempt = 1; attempt <= 11; attempt += 1) consumeLoginRateLimit("1.2.3.4", start)

    expect(consumeLoginRateLimit("1.2.3.4", start).allowed).toBe(false)
    expect(consumeLoginRateLimit("1.2.3.4", start + 15 * 60_000 + 1).allowed).toBe(true)
  })

  it("clears a window on a successful login, so admins are not locked out", () => {
    for (let attempt = 1; attempt <= 11; attempt += 1) consumeLoginRateLimit("1.2.3.4")
    expect(consumeLoginRateLimit("1.2.3.4").allowed).toBe(false)

    resetLoginRateLimit("1.2.3.4")

    expect(consumeLoginRateLimit("1.2.3.4").allowed).toBe(true)
  })

  it("honours an env override, and ignores a nonsensical one", () => {
    env.ADMIN_LOGIN_RATE_LIMIT = "2"
    expect(consumeLoginRateLimit("1.2.3.4").allowed).toBe(true)
    expect(consumeLoginRateLimit("1.2.3.4").allowed).toBe(true)
    expect(consumeLoginRateLimit("1.2.3.4").allowed).toBe(false)

    resetAllLoginRateLimits()
    env.ADMIN_LOGIN_RATE_LIMIT = "not-a-number"
    expect(consumeLoginRateLimit("9.9.9.9").limit).toBe(10)

    resetAllLoginRateLimits()
    env.ADMIN_LOGIN_RATE_LIMIT = "0"
    // A limit of zero would lock everyone out permanently; fall back instead.
    expect(consumeLoginRateLimit("9.9.9.9").limit).toBe(10)
  })
})

describe("deriving the client key", () => {
  const headersFor = (entries: Record<string, string>) => new Headers(entries)

  it("uses the first hop of x-forwarded-for", () => {
    expect(clientKeyFromHeaders(headersFor({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe(
      "1.2.3.4",
    )
  })

  it("trims whitespace around the hop", () => {
    expect(clientKeyFromHeaders(headersFor({ "x-forwarded-for": "  1.2.3.4 ,10.0.0.1" }))).toBe(
      "1.2.3.4",
    )
  })

  it("falls back to x-real-ip", () => {
    expect(clientKeyFromHeaders(headersFor({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8")
  })

  it("puts unattributable callers in one shared bucket rather than waving them through", () => {
    // An attacker must not earn an unlimited allowance by sending no headers.
    expect(clientKeyFromHeaders(headersFor({}))).toBe("unknown")
    expect(clientKeyFromHeaders(headersFor({ "x-forwarded-for": "  " }))).toBe("unknown")
  })
})

describe("the password policy", () => {
  it("hashes the timing equalizer at exactly BCRYPT_COST", () => {
    // A bcrypt hash is $2b$<cost>$<salt+digest>. A mismatch here means the
    // login route spends a different amount of CPU on a miss than on a hit.
    expect(TIMING_EQUALIZER_HASH.split("$")[2]).toBe(String(BCRYPT_COST).padStart(2, "0"))
  })

  it("is a real, usable bcrypt hash", () => {
    // If it were malformed, bcrypt.compare would fail fast and the timing
    // equalization would quietly stop costing anything at all.
    expect(TIMING_EQUALIZER_HASH).toHaveLength(60)
    expect(bcrypt.getRounds(TIMING_EQUALIZER_HASH)).toBe(BCRYPT_COST)
  })

  it("matches no password anyone could submit", async () => {
    // Including the one behind the three deleted mock accounts.
    for (const guess of ["password", "", "admin", "notilab", "Password123!"]) {
      await expect(bcrypt.compare(guess, TIMING_EQUALIZER_HASH)).resolves.toBe(false)
    }
  })

  it("requires a password long enough to survive having no lockout", () => {
    expect(MIN_ADMIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(12)
  })
})
