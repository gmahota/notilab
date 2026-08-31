/**
 * lib/agent/audit.ts — Every write an external agent performs, on the record.
 *
 * Reuses the `AdminAction` model rather than adding a table. That model already
 * exists for exactly this (`userId`, `action`, `resource`, `resourceId`,
 * `details`), `business-rules.md` already requires an AdminAction row per admin
 * mutation, and it has no foreign key to `users` — so an agent identity can own
 * a row without pretending to be a person. `userId` is written as
 * `agent:<id>`, which is unambiguous next to a human's cuid.
 *
 * Two rules this module enforces so callers cannot get them wrong:
 *
 *   1. Nothing sensitive is written. `redact()` walks the payload and replaces
 *      anything that looks like a credential before it reaches the database.
 *      Audit rows are read by more people than the environment is.
 *   2. A failed audit write never fails the request. The mutation has already
 *      happened by then; throwing here would report failure for work that was
 *      done. The gap is surfaced instead, as `meta.auditRecorded: false`.
 */

import { prisma } from "@/lib/prisma"

/** Entity types the agent layer writes about. */
export const AUDIT_RESOURCE = {
  ARTICLE: "ARTICLE",
  /** Bookkeeping rows, not editorial entities — see schedule-service / idempotency. */
  ARTICLE_SCHEDULE: "ARTICLE_SCHEDULE",
  AGENT_IDEMPOTENCY: "AGENT_IDEMPOTENCY",
} as const

/** Anything whose name suggests a credential is replaced rather than stored. */
const SENSITIVE_KEY = /(pass|secret|token|api[-_]?key|authorization|credential|cookie|session)/i

/** Long strings are truncated: an audit row records what changed, not a backup. */
const MAX_STRING = 2_000
const MAX_DEPTH = 6

/**
 * Produces a database-safe copy of a payload. Applied to every `details` blob,
 * including error details, because an exception message can carry a query or a
 * connection string.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null
  if (depth > MAX_DEPTH) return "[truncated: too deep]"

  if (typeof value === "string") {
    return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + "… [truncated]" : value
  }
  if (typeof value === "number" || typeof value === "boolean") return value
  if (value instanceof Date) return value.toISOString()

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => redact(item, depth + 1))
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redact(entry, depth + 1)
    }
    return out
  }

  // Functions, symbols, bigints — nothing a tool payload should contain.
  return String(value)
}

/** One field's before/after, as stored in `details.changes`. */
export interface FieldChange {
  before: unknown
  after: unknown
}

export interface AuditEntry {
  agentId: string
  /** The tool the agent called, e.g. "publish_article". */
  tool: string
  /** The action recorded, e.g. "ARTICLE_PUBLISH". Uppercase, verb-last. */
  action: string
  resource: string
  /** "-" when the operation created nothing and targeted nothing. */
  resourceId: string
  outcome: "success" | "error"
  requestId: string
  durationMs: number
  /** Validated tool input. Redacted before storage. */
  input?: unknown
  /** Per-field before/after. Only meaningful for updates. */
  changes?: Record<string, FieldChange>
  errorCode?: string
  errorMessage?: string
  idempotencyKey?: string
}

/**
 * Writes one audit row. Returns false when the write failed, which the caller
 * reports rather than hides.
 */
export async function recordAgentAction(entry: AuditEntry): Promise<boolean> {
  try {
    await prisma.adminAction.create({
      data: {
        userId: `agent:${entry.agentId}`,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        details: redact({
          agentId: entry.agentId,
          tool: entry.tool,
          outcome: entry.outcome,
          requestId: entry.requestId,
          durationMs: entry.durationMs,
          input: entry.input ?? null,
          changes: entry.changes ?? null,
          errorCode: entry.errorCode ?? null,
          errorMessage: entry.errorMessage ?? null,
          // Recorded so a replayed call can be traced back to the original.
          idempotencyKey: entry.idempotencyKey ?? null,
        }) as object,
      },
    })
    return true
  } catch (err) {
    // Loud, because a silent audit gap is the failure mode this whole layer
    // exists to prevent.
    console.error(
      `[agent/audit] FAILED to record ${entry.action} on ${entry.resource}:${entry.resourceId} ` +
        `by agent:${entry.agentId} (request ${entry.requestId})`,
      err,
    )
    return false
  }
}

/**
 * Diffs two field maps into the `changes` shape. Only keys present in `after`
 * are considered, so an untouched field never appears as a change.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {}

  for (const [key, next] of Object.entries(after)) {
    const previous = before[key]
    if (JSON.stringify(previous ?? null) === JSON.stringify(next ?? null)) continue
    changes[key] = { before: previous ?? null, after: next ?? null }
  }

  return changes
}
