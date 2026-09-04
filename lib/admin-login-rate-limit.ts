/**
 * lib/admin-login-rate-limit.ts — A ceiling on how fast one client can guess an
 * admin password.
 *
 * Modelled on lib/agent/rate-limit.ts but deliberately NOT reusing it. That
 * module bounds a looping agent making authorised writes; this one bounds an
 * unauthenticated stranger guessing credentials. The two want very different
 * numbers (120/minute versus 10/15 minutes), and sharing the module would mean
 * that tuning the agent ceiling silently retunes the brute-force ceiling.
 *
 * This is the only brake on guessing, because account lockout was rejected
 * outright: the admin email is effectively public, so a lockout is a
 * denial-of-service lever against the newsroom, and a lockout counter that
 * survives restarts needs a schema change. Password entropy plus this limiter
 * carry the load instead.
 *
 * Scope, and honesty about it: the counter lives in module memory. On Vercel
 * that means per serverless instance, so the real ceiling across a scaled
 * deployment is `limit × instances`, and it resets on every cold start. That is
 * a genuine weakening. It is still worth having — it turns an unlimited online
 * guessing attack into one that needs either patience or many instances, which
 * is a large constant factor against an attacker and no cost at all to the
 * handful of humans who actually log in. A shared counter needs Redis or an
 * equivalent store.
 */

/** Attempts per window, per client. */
const DEFAULT_LIMIT = 10
const DEFAULT_WINDOW_MS = 15 * 60_000

interface Window {
  count: number
  /** Epoch ms at which this window resets. */
  resetAt: number
}

const windows = new Map<string, Window>()

/** Stops the map growing without bound as client addresses come and go. */
const MAX_TRACKED_CLIENTS = 5_000

function readLimit(): { limit: number; windowMs: number } {
  const limit = Number.parseInt(process.env.ADMIN_LOGIN_RATE_LIMIT ?? "", 10)
  const windowMs = Number.parseInt(process.env.ADMIN_LOGIN_RATE_WINDOW_MS ?? "", 10)

  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : DEFAULT_WINDOW_MS,
  }
}

/**
 * Derives the key to count against: the first hop of `x-forwarded-for`.
 *
 * On Vercel that header is written by the platform edge, so the first hop is the
 * real client address. Behind a different proxy — or with none — it is
 * caller-supplied and therefore spoofable, which is why this is described above
 * as a brake and not as a boundary. An attacker who rotates the header defeats
 * it; nothing here pretends otherwise.
 *
 * Everything unattributable collapses onto one shared bucket rather than being
 * waved through. Sharing a bucket can rate-limit innocent callers together, but
 * the alternative is an attacker earning an unlimited allowance by simply
 * sending no headers.
 */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  const firstHop = forwarded?.split(",")[0]?.trim()
  if (firstHop) return firstHop

  const realIp = headers.get("x-real-ip")?.trim()
  if (realIp) return realIp

  return "unknown"
}

export interface RateDecision {
  allowed: boolean
  limit: number
  remaining: number
  /** Seconds until the window resets. Sent as Retry-After when blocked. */
  retryAfterSeconds: number
}

/**
 * Counts one login attempt against a client window.
 *
 * Fixed window rather than sliding, for the same reasons as the agent limiter:
 * one map entry, no timers, and the up-to-2x burst permitted at a window
 * boundary is irrelevant against online password guessing.
 *
 * Every attempt counts, successful or not. Counting only failures would let an
 * attacker who holds one valid credential keep a bucket open forever, and
 * counting all attempts also bounds the bcrypt work this endpoint will do —
 * bcrypt at cost 12 is expensive on purpose, which makes an unmetered login
 * route a CPU amplifier as well as a guessing oracle.
 */
export function consumeLoginRateLimit(clientKey: string, now: number = Date.now()): RateDecision {
  const { limit, windowMs } = readLimit()

  if (windows.size > MAX_TRACKED_CLIENTS) {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key)
    }
  }

  const existing = windows.get(clientKey)

  if (!existing || existing.resetAt <= now) {
    windows.set(clientKey, { count: 1, resetAt: now + windowMs })
    return { allowed: true, limit, remaining: limit - 1, retryAfterSeconds: 0 }
  }

  existing.count += 1
  const remaining = Math.max(0, limit - existing.count)

  if (existing.count > limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  return { allowed: true, limit, remaining, retryAfterSeconds: 0 }
}

/**
 * Clears a client window after a successful login.
 *
 * Keeps the limiter from punishing the people it is meant to protect: an admin
 * who signs in repeatedly during a busy morning should not hit a wall meant for
 * a guesser. It gives an attacker nothing, since reaching it at all requires
 * already holding a valid password.
 */
export function resetLoginRateLimit(clientKey: string): void {
  windows.delete(clientKey)
}

/** Test seam — production code has no reason to call this. */
export function resetAllLoginRateLimits(): void {
  windows.clear()
}
