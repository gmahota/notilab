/**
 * lib/agent/rate-limit.ts — A ceiling on how fast one agent can act.
 *
 * The threat is not a botnet; it is a looping agent. An LLM that misreads a
 * result and retries can fire hundreds of `update_article` calls a minute, and
 * every one of them is a legitimate, authenticated, authorised write. The limit
 * is there to make that loop stop somewhere short of the whole archive.
 *
 * Scope and honesty about it: the counter lives in module memory. On Vercel
 * that means per serverless instance, so the effective ceiling across a scaled
 * deployment is `limit × instances`. That is a real weakening, and it is still
 * worth having — it bounds a runaway loop within an instance, which is where a
 * single agent's requests overwhelmingly land. A shared counter needs Redis or
 * an equivalent store; see docs/agent-api.md § Limitations.
 */

/** Requests per window, per agent identity. */
const DEFAULT_LIMIT = 120
const DEFAULT_WINDOW_MS = 60_000

interface Window {
  count: number
  /** Epoch ms at which this window resets. */
  resetAt: number
}

const windows = new Map<string, Window>()

/** Stops the map growing without bound when agent ids come and go. */
const MAX_TRACKED_IDENTITIES = 1_000

function readLimit(): { limit: number; windowMs: number } {
  const limit = Number.parseInt(process.env.NOTILAB_AGENT_RATE_LIMIT ?? "", 10)
  const windowMs = Number.parseInt(process.env.NOTILAB_AGENT_RATE_WINDOW_MS ?? "", 10)

  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : DEFAULT_WINDOW_MS,
  }
}

export interface RateDecision {
  allowed: boolean
  limit: number
  remaining: number
  /** Seconds until the window resets. Sent as Retry-After when blocked. */
  retryAfterSeconds: number
}

/**
 * Counts one request against an agent's window.
 *
 * Fixed window rather than sliding: it is one map entry and no timer, and the
 * burst it permits at a window boundary (up to 2× the limit) is irrelevant
 * against the failure mode this guards.
 */
export function consumeRateLimit(agentId: string, now: number = Date.now()): RateDecision {
  const { limit, windowMs } = readLimit()

  if (windows.size > MAX_TRACKED_IDENTITIES) {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key)
    }
  }

  const existing = windows.get(agentId)

  if (!existing || existing.resetAt <= now) {
    windows.set(agentId, { count: 1, resetAt: now + windowMs })
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

/** Test seam — production code has no reason to call this. */
export function resetRateLimits(): void {
  windows.clear()
}
