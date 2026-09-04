/**
 * lib/agent/secret-compare.ts — Comparing two secrets without leaking timing.
 *
 * Extracted from auth.ts so the MCP transport authenticates its own key with
 * exactly the same routine rather than a second, subtly different one. A
 * comparison that is constant-time in one transport and not in the other is the
 * kind of asymmetry nobody notices until it is exploited.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

/**
 * Random, per-process, never persisted or exposed. Its only job is to key the
 * comparison below; it is regenerated on every cold start and means nothing
 * outside this module.
 */
const COMPARISON_KEY = randomBytes(32)

/**
 * The double-HMAC comparison. Both operands are keyed-hashed with the same
 * per-process random key, then compared byte by byte in constant time.
 *
 * Hashing at all is what makes `timingSafeEqual` usable here — it requires
 * equal-length buffers, so a raw comparison would either throw on a
 * wrong-length guess or leak the key's length through that difference.
 *
 * Keyed rather than plain SHA-256 for two reasons. An attacker who can choose
 * an input cannot compute the digest we will compare against, so no offline
 * work on the comparison values is possible; and the digest is not a function
 * of the secret alone, so it carries no information about the key even in
 * principle. Neither digest is stored, logged or transmitted — both are local
 * to one call.
 */
export function secretsMatch(a: string, b: string): boolean {
  const hashedA = createHmac("sha256", COMPARISON_KEY).update(a, "utf8").digest()
  const hashedB = createHmac("sha256", COMPARISON_KEY).update(b, "utf8").digest()
  return timingSafeEqual(hashedA, hashedB)
}

/**
 * Shortest key any NotiLab machine credential may be. A key is the only thing
 * standing between the open internet and the newsroom, and it never has to be
 * typed by a human, so there is no reason for a short one.
 *
 *   openssl rand -hex 32
 */
export const MIN_KEY_LENGTH = 32
