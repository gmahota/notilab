/**
 * lib/admin-auth.ts — Human staff authentication for /admin and /api/admin.
 *
 * A JWT in an httpOnly cookie, an 8-hour expiry, one signing secret. The
 * machine surface (/api/agent/*) is deliberately elsewhere — see
 * lib/agent/auth.ts for why the two must not share a credential path.
 *
 * This module used to read:
 *
 *     const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"
 *
 * which meant a deployment that had never been given a secret still signed and
 * accepted admin tokens — with a key published in this repository. Anyone able
 * to read the source could mint a SUPER_ADMIN session. The fallback is gone:
 * with no usable secret, no token is issued and no token is accepted.
 * (ROADMAP #38.)
 */

import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

/**
 * The roles that may reach /admin — every UserRole except USER, which is a
 * reader of the site and nothing more.
 *
 * Single source of truth on purpose. This list previously existed twice: inline
 * here, and implicitly as the roles of the three hardcoded accounts in the
 * login route. Two copies of an authorization rule is one copy too many, so the
 * login path (lib/admin/staff-auth.ts) reads this array rather than restating
 * it. ROADMAP #42 replaces it with the documented tier matrix; until then the
 * membership must stay identical to prisma/schema.prisma's UserRole enum minus
 * USER.
 */
export const STAFF_ROLES = [
  "REDATOR",
  "REVISOR",
  "SUPERVISOR",
  "MARKETING",
  "CRIADOR_CONTEUDO",
  "ADMIN",
  "SUPER_ADMIN",
] as const

export type StaffRole = (typeof STAFF_ROLES)[number]

/** Narrows an unknown value (a JWT claim, a database column) to a staff role. */
export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value)
}

/**
 * Shortest secret this module will sign or verify with. Matches the floor
 * lib/agent/auth.ts already applies to the agent API key, and for the same
 * reason: nobody types it, so there is no cost to a long one, and a short
 * secret is brute-forceable offline from a single captured token.
 *
 *   openssl rand -hex 32
 */
const MIN_SECRET_LENGTH = 32

/**
 * Thrown when the deployment has no usable signing secret. Named so it can be
 * distinguished from an invalid or expired token: one is a misconfiguration an
 * operator must fix, the other is a normal, expected request outcome.
 *
 * The message names the variable and the fix, and never contains the value.
 */
export class MissingSigningSecretError extends Error {
  constructor(problem: string) {
    super(
      `JWT_SECRET is unusable (${problem}). Admin sessions cannot be signed or ` +
        "verified. Generate a secret with `openssl rand -hex 32` and set JWT_SECRET " +
        "in this environment, then restart the app.",
    )
    this.name = "MissingSigningSecretError"
  }
}

/**
 * Resolves the signing secret, or throws MissingSigningSecretError.
 *
 * Why this throws at first use rather than at module load — a deliberate
 * choice, per ROADMAP #38:
 *
 *   A module-level `throw` would run during `next build`. This module is
 *   imported by six admin server components and four route handlers, and Next
 *   evaluates their module scope while collecting page data, so a missing
 *   variable at build time would fail the build rather than the request. That
 *   is the wrong failure: the build machine is not the machine that serves
 *   traffic (CI passes NEXTAUTH_SECRET and not JWT_SECRET, and Vercel build
 *   env and runtime env are configured separately), so a build-time check
 *   both blocks deploys that would have worked and proves nothing about the
 *   runtime environment that actually matters.
 *
 *   Checking at the point of use costs nothing and cannot be bypassed: every
 *   sign and every verify in the application goes through this function, so
 *   there is no path that reaches jsonwebtoken with a substituted key. The
 *   trade-off accepted is that the failure surfaces on the first admin request
 *   instead of at boot — hence the named error class and the actionable
 *   message above.
 *
 * Read from process.env on every call, like lib/agent/auth.ts: a value cached
 * at module load would survive a secret rotation until the next cold start.
 */
export function requireSigningSecret(): string {
  const raw = process.env.JWT_SECRET

  // An empty or whitespace-only variable is treated as absent, not as a
  // one-character key. Platform UIs and .env files produce "" far more often
  // than they produce a genuinely short secret.
  const secret = typeof raw === "string" ? raw.trim() : ""

  if (secret.length === 0) {
    throw new MissingSigningSecretError("not set, or blank")
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new MissingSigningSecretError(
      `shorter than ${MIN_SECRET_LENGTH} characters`,
    )
  }

  // The trimmed value is what signs and verifies, so a secret that arrives with
  // a trailing newline behaves the same as one that does not.
  return secret
}

export interface AdminUser {
  id: string
  email: string
  name: string
  role: string
}

/**
 * The claims this module puts in a token, and the only ones it trusts on the
 * way back in.
 */
function readAdminClaims(decoded: unknown): AdminUser | null {
  if (typeof decoded !== "object" || decoded === null) return null

  const claims = decoded as Record<string, unknown>

  if (!isStaffRole(claims.role)) return null
  if (typeof claims.id !== "string" || claims.id.length === 0) return null
  if (typeof claims.email !== "string" || claims.email.length === 0) return null

  return {
    id: claims.id,
    email: claims.email,
    name: typeof claims.name === "string" ? claims.name : claims.email,
    role: claims.role,
  }
}

/**
 * The signed-in staff member, or null.
 *
 * Returns null for the ordinary cases — no cookie, a bad signature, an expired
 * token, a token whose role is not staff. Throws only for
 * MissingSigningSecretError, so a misconfigured deployment cannot masquerade as
 * "nobody is logged in": that would be an authorization outage presented as a
 * login screen, and an operator would have nothing to go on.
 */
export async function checkAdminAuth(): Promise<AdminUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("admin-token")?.value

  if (!token) return null

  // Resolved after the cookie check so that anonymous traffic to an admin page
  // still gets a clean redirect to the login screen on a deployment whose
  // secret is missing; only a request presenting a token gets the loud error.
  const secret = requireSigningSecret()

  try {
    // The algorithm is pinned: without it, the token header chooses the
    // verification algorithm, which is how "alg": "none" and HMAC/RSA
    // confusion attacks get in.
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] })
    return readAdminClaims(decoded)
  } catch {
    // Signature, expiry and malformed-token failures all land here. Nothing is
    // logged: the token is attacker-controlled input.
    return null
  }
}

/** Signs an 8-hour admin session. Throws if the deployment has no secret. */
export function generateAdminToken(user: AdminUser): string {
  const secret = requireSigningSecret()
  return jwt.sign(user, secret, { algorithm: "HS256", expiresIn: "8h" })
}
