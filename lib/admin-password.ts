/**
 * lib/admin-password.ts — The one place the admin password policy is defined.
 *
 * This module exists so that the login route and the provisioning script cannot
 * drift apart. The timing defence in the login route compares against a dummy
 * hash on every miss, and that defence only works if the dummy carries the same
 * bcrypt cost factor as the real stored hashes — a cost mismatch makes the miss
 * path measurably faster or slower than the hit path and hands back exactly the
 * oracle it was added to close. Two constants in two files would eventually
 * disagree; one exported constant cannot.
 *
 * Deliberately free of any `next/*` import so that `scripts/admin/provision-admin.ts`
 * can import it under plain tsx, outside a Next request context.
 */

import bcrypt from "bcryptjs"

/**
 * bcrypt cost factor for every admin password hash this system creates.
 *
 * 12, not the 10 the deleted mock hashes used. Note that bcryptjs is a pure-JS
 * implementation and runs several times slower than a native binding, so cost
 * 12 here costs roughly what a higher cost would natively — which is the point
 * for an offline attacker, and affordable for us because the login route is
 * rate limited and does at most one comparison per request.
 *
 * Raising this later is safe and does not invalidate stored hashes: the cost is
 * encoded in each hash, so bcrypt.compare keeps verifying old ones. Only newly
 * created hashes pick up the new value.
 */
export const BCRYPT_COST = 12

/**
 * Shortest password the provisioning script will accept.
 *
 * There is no lockout on the login route (rejected by design — a lockout on a
 * known-public admin email is a denial-of-service lever), so entropy in the
 * password is doing the work that a lockout would otherwise do.
 */
export const MIN_ADMIN_PASSWORD_LENGTH = 12

/**
 * A real bcrypt hash at BCRYPT_COST, used only to spend the same CPU on a login
 * miss as on a login hit.
 *
 * It is the hash of 48 random bytes that were never recorded, so no password can
 * match it. Hardcoded rather than generated at module load so that the cost is
 * visible in the source next to BCRYPT_COST, and so no cold start pays for a
 * hash operation nobody asked for. Knowing this value grants nothing: the only
 * thing it can do is make a comparison the route already discards return true.
 *
 * If BCRYPT_COST changes, this must be regenerated at the new cost.
 */
export const TIMING_EQUALIZER_HASH = "$2b$12$ZUV3ztet4Pctv5EX5VAbMO6K82q27zyc0btkk6MlBiP08VyyYpnXi"

/** Hashes a new admin password. The only supported way to produce one. */
export async function hashAdminPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST)
}
