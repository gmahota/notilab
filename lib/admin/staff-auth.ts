/**
 * lib/admin/staff-auth.ts — Verifies staff credentials against the database.
 *
 * Replaces the three-entry array that used to live inline in
 * app/api/admin/auth/route.ts, in which admin@notilab.com, redator@notilab.com
 * and revisor@notilab.com all shared one bcrypt hash: the published test vector
 * for the literal string `password`, with no NODE_ENV gate, so all three worked
 * in production. Those three addresses must be considered permanently compromised:
 * the hash is in every bcrypt tutorial on the internet and in this repository's
 * git history. (ROADMAP #39.)
 *
 * Staff accounts now come from the User table and are created by
 * scripts/admin/provision-staff.ts. Nothing in this file, and nothing in the
 * repository, contains a credential.
 */

import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { isStaffRole, type AdminUser } from "@/lib/admin-auth"

/**
 * Why the failure carries no detail for the caller: telling a client whether an
 * address exists turns the login form into a user directory. The `reason` is
 * for server-side logs only and never crosses the HTTP boundary — see the
 * route.
 */
export type StaffAuthFailure =
  | "malformed-input"
  | "no-such-user"
  | "no-password-set"
  | "inactive"
  | "not-staff"
  | "wrong-password"

export type StaffAuthResult =
  | { ok: true; user: AdminUser }
  | { ok: false; reason: StaffAuthFailure }

/**
 * A bcrypt hash of a random value, computed once per process and never
 * persisted. Used to spend the same time on a request for an address that does
 * not exist as on one that does, so response latency does not reveal which
 * addresses are real.
 *
 * Generated rather than written as a literal: a hardcoded hash in lib/ is the
 * exact pattern this task removed, and it would keep tripping the secret scan.
 * Lazy, so the cost lands on the first failed login rather than on module load
 * of every admin page.
 */
let decoyHash: Promise<string> | null = null

function getDecoyHash(): Promise<string> {
  decoyHash ??= bcrypt.hash(`decoy:${Math.random()}:${Date.now()}`, 10)
  return decoyHash
}

/** Burns roughly one bcrypt comparison, then fails. */
async function failAfterDecoyCompare(reason: StaffAuthFailure): Promise<StaffAuthResult> {
  await bcrypt.compare("decoy", await getDecoyHash())
  return { ok: false, reason }
}

/**
 * Emails are stored and compared lowercased so that a single address cannot
 * exist twice in different cases. The lookup is an exact unique match rather
 * than a case-insensitive search: `findFirst` with `mode: "insensitive"` would
 * pick an arbitrary row if two variants ever did coexist, and "arbitrary row"
 * is not something an authentication path should ever do.
 * scripts/admin/provision-staff.ts applies the same normalization on write.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function authenticateStaff(
  email: unknown,
  password: unknown,
): Promise<StaffAuthResult> {
  if (typeof email !== "string" || typeof password !== "string") {
    return { ok: false, reason: "malformed-input" }
  }

  const normalizedEmail = normalizeEmail(email)

  // An empty password must never reach bcrypt.compare. It would compare
  // honestly against a real hash and fail, but rejecting it here keeps the
  // "credential is absent" and "credential is wrong" cases from sharing a path.
  if (normalizedEmail.length === 0 || password.length === 0) {
    return { ok: false, reason: "malformed-input" }
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true, role: true, isActive: true, password: true },
  })

  if (!user) return failAfterDecoyCompare("no-such-user")

  /**
   * The single most dangerous line in this module.
   *
   * User.password is String? and will be null for every magic-link reader once
   * ROADMAP #42 lands. bcrypt.compare(password, null) does not throw in
   * bcryptjs — it resolves false today, but that is a library implementation
   * detail, not a guarantee, and a passwordless account must be unauthenticable
   * by construction rather than by luck. So: no stored hash, no login, before
   * any comparison happens. A whitespace-only column counts as no hash.
   */
  const storedHash = typeof user.password === "string" ? user.password.trim() : ""
  if (storedHash.length === 0) return failAfterDecoyCompare("no-password-set")

  // Deactivating an account has to actually deny access, or isActive is
  // decoration. Checked before the comparison: there is nothing to gain from
  // verifying the password of an account that cannot be used.
  if (!user.isActive) return failAfterDecoyCompare("inactive")

  // A reader (USER) has a row in the same table. Password correctness is not
  // the question here — /admin is not theirs regardless.
  if (!isStaffRole(user.role)) return failAfterDecoyCompare("not-staff")

  const passwordMatches = await bcrypt.compare(password, storedHash)
  if (!passwordMatches) return { ok: false, reason: "wrong-password" }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      // AdminUser.name is required and User.name is nullable; the email is a
      // truthful fallback for the header greeting.
      name: user.name?.trim() || user.email,
      role: user.role,
    },
  }
}
