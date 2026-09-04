/**
 * POST /api/admin/auth — admin login.
 *
 * The three hardcoded accounts that used to live in this file are gone. All
 * three shared the published bcrypt test vector for the password "password", so
 * the credentials for admin@notilab.com (SUPER_ADMIN), redator@notilab.com and
 * revisor@notilab.com were effectively public for as long as this file was.
 * Those hashes are permanently compromised; they were deleted outright rather
 * than hidden behind a NODE_ENV check, because a gate would keep the published
 * hash at HEAD and leave the compromise one environment variable away.
 *
 * Accounts now come from the database. There is no provisioning path in the
 * seed, so an admin has to be created deliberately with
 * `pnpm admin:provision` — see scripts/admin/provision-admin.ts.
 *
 * Two oracles the old handler leaked, and how they are closed:
 *
 *   Enumeration — it answered "Usuário não encontrado" for an unknown email and
 *   "Senha incorreta" for a wrong password, which told an attacker exactly which
 *   emails are real. Every rejection now returns one identical body.
 *
 *   Timing — it returned before reaching bcrypt when the email was unknown, so
 *   a stopwatch answered the same question the messages did. Every rejection
 *   path now performs one bcrypt comparison at the same cost factor.
 *
 * No `export const runtime = "edge"`: bcryptjs and Prisma both need the Node
 * runtime.
 */

import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { generateAdminToken, isAdminRole } from "@/lib/admin-auth"
import { TIMING_EQUALIZER_HASH } from "@/lib/admin-password"
import {
  clientKeyFromHeaders,
  consumeLoginRateLimit,
  resetLoginRateLimit,
} from "@/lib/admin-login-rate-limit"
import { prisma } from "@/lib/prisma"

/**
 * The single response for every failed login, whatever the actual reason.
 *
 * Held as one frozen object so the four rejection paths cannot drift into four
 * subtly different bodies. components/admin-login.tsx already falls back to
 * exactly this string, so the UI needs no change.
 */
const INVALID_CREDENTIALS = Object.freeze({ error: "Credenciais inválidas" })

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60

function rejectCredentials(): NextResponse {
  return NextResponse.json(INVALID_CREDENTIALS, { status: 401 })
}

export async function POST(request: NextRequest) {
  // Cheapest rejection first: a throttled client should not cost a JSON parse,
  // a database round trip, or 100ms of bcrypt.
  const clientKey = clientKeyFromHeaders(request.headers)
  const rate = consumeLoginRateLimit(clientKey)

  if (!rate.allowed) {
    console.warn("[admin-auth] login attempts throttled for one client")
    return NextResponse.json(
      { error: "Demasiadas tentativas. Tente novamente mais tarde." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    )
  }

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Pedido inválido" }, { status: 400 })
    }

    const payload = (body ?? {}) as Record<string, unknown>
    const rawEmail = typeof payload.email === "string" ? payload.email : ""
    const password = typeof payload.password === "string" ? payload.password : ""

    // A malformed request is answered before any lookup, so this 400 cannot
    // reveal anything about which accounts exist — it depends only on the shape
    // of the request. It is deliberately NOT folded into the generic 401: that
    // would tell a caller who forgot a field that their email might be valid.
    if (!rawEmail.trim() || !password) {
      return NextResponse.json({ error: "Pedido inválido" }, { status: 400 })
    }

    // Normalised to match how provision-admin.ts stores it. `findUnique` against
    // the `@unique` column, not a case-insensitive `findFirst`: the constraint
    // is case-sensitive, so a `findFirst` search could match a row the database
    // would happily let a near-duplicate of sit alongside, and "which row wins"
    // is not something a login should decide.
    const email = rawEmail.trim().toLowerCase()

    const account = await prisma.user.findUnique({
      where: { email },
      // Only what this decision needs. No point pulling relations, points, or
      // history into a login handler.
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
        isActive: true,
      },
    })

    // `password` is nullable in the schema — most rows are ordinary readers with
    // no hash at all. bcrypt.compare must never be handed one of those, so a
    // missing or blank hash is replaced by the equalizer for the comparison and
    // rejected on its own branch below.
    const storedHash =
      account?.password && account.password.trim().length > 0 ? account.password : null

    // Runs on EVERY path, hit or miss, always at the same cost factor. This
    // narrows the timing channel; it does not close it. The database lookup
    // itself still takes longer for a row that exists than for one that does
    // not, and that residual difference is accepted here — removing it means a
    // constant-time storage layer, which is not a thing we have.
    const passwordMatches = await bcrypt.compare(password, storedHash ?? TIMING_EQUALIZER_HASH)

    // Evaluated after the comparison so that the order of these checks cannot
    // itself become a timing signal.
    const rejection = !account
      ? "no account for that address"
      : storedHash === null
        ? "account has no password set"
        : !account.isActive
          ? "account is disabled"
          : !isAdminRole(account.role)
            ? `role ${account.role} is not administrative`
            : !passwordMatches
              ? "password did not match"
              : null

    if (rejection || !account) {
      // The reason is logged for operators; the caller learns only that it
      // failed. No email, no password, no hash.
      console.warn(`[admin-auth] login rejected: ${rejection}`)
      return rejectCredentials()
    }

    let token: string
    try {
      token = generateAdminToken({
        id: account.id,
        email: account.email,
        // `name` is optional in the schema, but an admin identity needs a
        // non-empty one; the email is the honest fallback and is already in the
        // token payload anyway.
        name: account.name?.trim() || account.email,
        role: account.role,
      })
    } catch {
      // generateAdminToken only throws when JWT_SECRET is missing or too weak.
      // The credentials were correct, but a token signed with an untrustworthy
      // secret is worse than no login at all — this is a configuration outage,
      // so say so with a 503 rather than a 401 that would send an admin hunting
      // for a password problem that does not exist. The thrown message is not
      // echoed to the caller.
      console.error(
        "[admin-auth] credentials accepted but no token could be issued: JWT_SECRET is missing or too weak",
      )
      return NextResponse.json({ error: "ADMIN_LOGIN_NOT_CONFIGURED" }, { status: 503 })
    }

    // Only after a genuine success, so the limiter never blocks the people it
    // exists to protect. Unreachable without a valid password.
    resetLoginRateLimit(clientKey)

    const cookieStore = await cookies()
    cookieStore.set("admin-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_SECONDS,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: account.id,
        email: account.email,
        name: account.name?.trim() || account.email,
        role: account.role,
      },
    })
  } catch (error) {
    // The old handler swallowed this silently, so a broken database connection
    // was indistinguishable from a wrong password in the logs. Log the class of
    // failure only — an unknown error can carry request data, so its message is
    // not what belongs in a log line on a login route.
    console.error(
      `[admin-auth] login failed unexpectedly: ${
        error instanceof Error ? error.name : "unknown error"
      }`,
    )
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
