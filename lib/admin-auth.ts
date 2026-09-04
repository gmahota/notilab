/**
 * lib/admin-auth.ts — Session authentication for the human admin console.
 *
 * One JWT in an httpOnly cookie: signed here, verified here, consumed by the
 * six admin server components and the four admin API routes. Deliberately kept
 * separate from lib/agent/auth.ts, which authenticates machines. Merging them
 * would mean either handing an external agent a human session or teaching this
 * cookie path to accept a bearer token, and both make the human login surface
 * bigger — the opposite of the goal.
 *
 * The signing secret has no fallback, and that is the point. This module used
 * to read `process.env.JWT_SECRET || "your-secret-key"`, so a deploy that had
 * never been given the variable — or had been given an empty string, which `||`
 * also treats as absent — signed and accepted tokens under a literal committed
 * to the repository. Anyone holding that literal could mint a SUPER_ADMIN
 * cookie. There is now no default at all.
 *
 * Failure is deliberately ASYMMETRIC, and that asymmetry is the load-bearing
 * decision in this file:
 *
 *   checkAdminAuth()      NEVER throws on an auth failure. It runs inside
 *                         server components, where a throw surfaces as a broken
 *                         page or a failed prerender during `next build`. It
 *                         returns null instead, which all ten of its call sites
 *                         already treat as "not signed in" and turn into a
 *                         redirect or a 401. That is fail-closed *and* still
 *                         available. (It does let one thing through: the
 *                         dynamic-rendering signal Next.js raises from
 *                         cookies(). See the note on that call.)
 *
 *   generateAdminToken()  THROWS. It is only reachable from the login POST, and
 *                         a login that cannot be signed against a trustworthy
 *                         secret must fail loudly rather than issue a token
 *                         nobody can rely on. The route turns this into a 503.
 */

import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
// TYPE-ONLY on purpose. A runtime `import { UserRole }` would pull the generated
// Prisma client into all six admin server components just to read an enum;
// `import type` disappears at compile time and costs nothing.
import type { UserRole } from "@prisma/client"

/**
 * Shortest secret this module will accept. A short HMAC secret is brute-forcible
 * offline against any captured token, and nobody ever types this value by hand,
 * so there is no ergonomic reason to allow a weak one.
 *
 *   openssl rand -hex 32
 */
const MIN_SECRET_LENGTH = 32

/**
 * Pinned on both sign and verify. `jsonwebtoken` defaults to HS256 when signing,
 * but on verify it will otherwise honour whatever `alg` the *token* claims,
 * which is the classic algorithm-confusion foothold. Naming it in both
 * directions means a token asking to be checked as anything else is rejected
 * before its signature is even considered.
 */
const TOKEN_ALGORITHM = "HS256" as const

/** Kept in step with the cookie maxAge set by the login route. */
const TOKEN_TTL = "8h"

/**
 * Which roles may reach the admin console at all.
 *
 * Typed as `Record<UserRole, boolean>` rather than as a list of admin roles so
 * that adding a member to the Prisma `UserRole` enum breaks `pnpm typecheck`
 * here until someone decides, explicitly, whether the new role is
 * administrative. A `readonly UserRole[]` would silently default that answer to
 * "no", and a `satisfies` clause would not complain about the omission at all.
 *
 * Membership is unchanged from the previous implementation: every role except
 * USER. Narrowing it is an editorial decision, not a security one.
 */
const ADMIN_ROLE: Record<UserRole, boolean> = {
  USER: false,
  REDATOR: true,
  REVISOR: true,
  SUPERVISOR: true,
  MARKETING: true,
  CRIADOR_CONTEUDO: true,
  ADMIN: true,
  SUPER_ADMIN: true,
}

export interface AdminUser {
  id: string
  email: string
  name: string
  role: UserRole
}

/**
 * Set once a missing or unusable secret has been reported, so a misconfigured
 * deployment logs the reason on first use rather than on every request. The
 * condition it describes cannot change without a new process.
 */
let secretProblemReported = false

/**
 * Reads and validates the signing secret.
 *
 * Read per call rather than captured in a module constant, for the same reason
 * lib/agent/auth.ts re-reads its keys: a value captured at module load survives
 * an environment change until the next cold start, and a per-call read is
 * testable without module-registry games. It also keeps the failure out of
 * module scope, which is what lets checkAdminAuth() stay non-throwing.
 *
 * `?.trim()` followed by an explicit emptiness test — never `||`. `||` treats ""
 * as absent and reaches for a fallback, which is exactly the bug this module
 * used to have, and the same bug class as commit fb67c78. There is no fallback
 * to reach for now, so the distinction only affects how honest the log line is.
 */
function readJwtSecret(): { secret: string; problem: null } | { secret: null; problem: string } {
  const configured = process.env.JWT_SECRET?.trim()

  if (configured === undefined || configured.length === 0) {
    return { secret: null, problem: "JWT_SECRET is not set, or is blank/whitespace-only" }
  }

  if (configured.length < MIN_SECRET_LENGTH) {
    // The length, never the value.
    return {
      secret: null,
      problem: `JWT_SECRET is shorter than ${MIN_SECRET_LENGTH} characters`,
    }
  }

  return { secret: configured, problem: null }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

/**
 * True only for roles this module recognises AND treats as administrative.
 *
 * Exported because the login route has to make the same judgement before it
 * issues a token, and it must make it from the same table — a second list of
 * admin roles maintained next to the login handler is a list that will
 * eventually disagree with this one.
 */
export function isAdminRole(value: unknown): value is UserRole {
  return typeof value === "string" && ADMIN_ROLE[value as UserRole] === true
}

/**
 * Turns a verified-but-unvalidated JWT payload into an AdminUser, or null.
 *
 * A good signature proves the token came from us. It proves nothing about the
 * shape of what we signed. The previous `decoded as any` meant a token whose
 * `role` was missing, or whose `id` was an object, flowed straight into the
 * application untouched. Every claim is checked here, and an unrecognised or
 * non-administrative role fails the whole token rather than being carried
 * through as a bare string.
 */
function toAdminUser(payload: unknown): AdminUser | null {
  if (typeof payload !== "object" || payload === null) return null

  const claims = payload as Record<string, unknown>

  if (!isNonEmptyString(claims.id)) return null
  if (!isNonEmptyString(claims.email)) return null
  if (!isNonEmptyString(claims.name)) return null
  if (!isAdminRole(claims.role)) return null

  return {
    id: claims.id,
    email: claims.email,
    name: claims.name,
    role: claims.role,
  }
}

/**
 * True when `user` holds one of `allowed`.
 *
 * `ADMIN_ROLE` is re-checked so that naming a non-administrative role in
 * `allowed` cannot grant anything: a caller that writes `["USER"]`, by accident
 * or by copy-paste, gets false rather than a session.
 */
export function hasAdminRole(user: AdminUser | null, allowed: readonly UserRole[]): boolean {
  if (!user) return false
  return allowed.includes(user.role) && ADMIN_ROLE[user.role] === true
}

/**
 * Resolves the signed-in admin from the `admin-token` cookie, or null.
 *
 * Returns null — never throws — for every failure: no cookie, an unusable
 * secret, a bad signature, an expired token, claims that do not typecheck, or a
 * role that is not administrative. See the asymmetry note at the top of the
 * file for why this one cannot throw.
 *
 * The single exception is not a failure at all: during a prerender, cookies()
 * throws to signal that the render depends on the request, and that signal is
 * deliberately allowed to reach Next.js. Catching it would silently turn these
 * pages static.
 *
 * `requiredRoles` is optional and additive. Omitting it preserves the exact
 * behaviour all ten existing call sites rely on (any administrative role
 * passes), so routes can start demanding a specific role one at a time. Which
 * route needs which role is a workflow question owned by editorial, not
 * something to guess at here.
 */
export async function checkAdminAuth(
  requiredRoles?: readonly UserRole[],
): Promise<AdminUser | null> {
  // Read the cookie first, and deliberately OUTSIDE the try below. Two
  // separate reasons, both of which cost a build to notice.
  //
  // Reading cookies() is what tells Next.js that a render depends on the
  // request. An earlier version of this function checked the secret first and
  // returned before ever touching cookies(), which meant that on a deploy with
  // no JWT_SECRET the admin pages contained no dynamic call at all and were
  // prerendered as static redirects to the login page. That fails closed, so it
  // was not dangerous, but a cached redirect is the wrong shape for a page whose
  // whole job is to re-check authorisation on every request.
  //
  // And during a prerender, cookies() reports that dynamic dependency by
  // throwing. That throw is Next.js control flow, not an error: it must not sit
  // inside a catch that converts everything into null. Swallowing it logged a
  // misleading "unexpected failure" line on every single build.
  const cookieStore = await cookies()
  const token = cookieStore.get("admin-token")?.value

  // Checked before the token, so that a misconfigured deployment says so in the
  // logs even when nobody is holding a cookie to be refused.
  const { secret, problem } = readJwtSecret()

  if (!secret) {
    if (!secretProblemReported) {
      secretProblemReported = true
      console.error(
        `[admin-auth] refusing every admin session: ${problem}. ` +
          "The admin console stays closed until it is configured.",
      )
    }
    return null
  }

  if (!token) return null

  try {
    const user = toAdminUser(jwt.verify(token, secret, { algorithms: [TOKEN_ALGORITHM] }))

    if (!user) {
      console.warn("[admin-auth] rejected a token whose claims are not a valid admin identity")
      return null
    }

    if (requiredRoles && !hasAdminRole(user, requiredRoles)) {
      // The role, and nothing else. Never the email, the id, or the token.
      console.warn(`[admin-auth] role ${user.role} is not permitted on this route`)
      return null
    }

    return user
  } catch (error) {
    // An expired token is simply what happens eight hours after a login; it is
    // not worth a log line. A signature failure is not routine — it means
    // someone presented a token we did not sign, which is the only externally
    // visible symptom of an attempted forgery (or of JWT_SECRET having been
    // rotated). That one is worth surfacing.
    if (error instanceof jwt.TokenExpiredError) return null

    if (error instanceof jwt.JsonWebTokenError) {
      // error.message is the jsonwebtoken wording — "invalid signature", "jwt
      // malformed", "invalid algorithm". It never contains the token itself.
      console.warn(`[admin-auth] rejected an admin token: ${error.message}`)
      return null
    }

    // Only jwt.verify and the checks above are inside this try, so anything
    // else really is unexpected. No error body is logged, because an unknown
    // error could carry request data.
    console.error("[admin-auth] unexpected failure while resolving the admin session")
    return null
  }
}

/**
 * Signs an 8-hour admin session token.
 *
 * Throws, unlike everything else here — see the asymmetry note at the top of
 * the file. The login route is the only caller and turns this into a 503,
 * because the alternative to throwing is issuing a token signed with something
 * weak or publicly known, which is far worse than being unable to log in.
 *
 * The claims are listed one by one rather than spread from the caller object:
 * whatever is passed here becomes the payload of a token this module will later
 * trust, so it should be exactly these four fields and not whatever else a
 * caller happened to be holding.
 */
export function generateAdminToken(user: AdminUser): string {
  const { secret, problem } = readJwtSecret()

  if (!secret) {
    throw new Error(`[admin-auth] cannot issue an admin token: ${problem}`)
  }

  // Defence in depth. The login route already rejects non-administrative roles,
  // but no future caller should be able to mint a session for a role that
  // checkAdminAuth() would then refuse: that combination is only ever a bug, and
  // it is much easier to diagnose as a 503 than as a token that silently never
  // works.
  if (!isAdminRole(user.role)) {
    throw new Error(`[admin-auth] refusing to issue a token for non-admin role ${user.role}`)
  }

  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, secret, {
    algorithm: TOKEN_ALGORITHM,
    expiresIn: TOKEN_TTL,
  })
}
