/**
 * lib/agent/errors.ts — The error vocabulary of the Agent Management API.
 *
 * These codes are part of the public contract: an external agent branches on
 * them. Treat the string values as frozen — renaming one is a breaking change
 * for every agent that learned to react to it. Adding a new code is not.
 *
 * The message that travels with a code is for a human reading a log. The code
 * is what a machine is meant to act on, which is why every failure path in this
 * layer picks one deliberately instead of falling back to INTERNAL_ERROR.
 */

/** Every failure the Agent API is allowed to report. */
export const AGENT_ERROR_CODES = [
  // ── Transport / auth ──────────────────────────────────────────────────────
  "METHOD_NOT_ALLOWED",
  "MALFORMED_JSON",
  "UNAUTHENTICATED",
  "INVALID_API_KEY",
  "FORBIDDEN",
  "RATE_LIMITED",
  "AGENT_API_DISABLED",

  // ── Dispatch / validation ─────────────────────────────────────────────────
  "TOOL_NOT_FOUND",
  "VALIDATION_FAILED",

  // ── Idempotency / confirmation ────────────────────────────────────────────
  "IDEMPOTENCY_IN_PROGRESS",
  "IDEMPOTENCY_PAYLOAD_MISMATCH",
  "CONFIRMATION_REQUIRED",

  // ── Domain ────────────────────────────────────────────────────────────────
  "ARTICLE_NOT_FOUND",
  "CATEGORY_NOT_FOUND",
  "DUPLICATE_SOURCE_URL",
  "INVALID_STATUS_TRANSITION",
  "ARTICLE_NOT_APPROVED",
  "ARTICLE_NOT_SCHEDULED",
  "SCHEDULE_IN_THE_PAST",
  "NO_FIELDS_TO_UPDATE",

  // ── Catch-all ─────────────────────────────────────────────────────────────
  "INTERNAL_ERROR",
] as const

export type AgentErrorCode = (typeof AGENT_ERROR_CODES)[number]

/**
 * HTTP status per code. Agents that only look at the status line still get a
 * sane signal (retry on 429/5xx, fix the request on 4xx), and agents that read
 * the code get the precise reason.
 */
const HTTP_STATUS: Record<AgentErrorCode, number> = {
  METHOD_NOT_ALLOWED: 405,
  MALFORMED_JSON: 400,
  UNAUTHENTICATED: 401,
  INVALID_API_KEY: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  AGENT_API_DISABLED: 503,

  TOOL_NOT_FOUND: 404,
  VALIDATION_FAILED: 422,

  IDEMPOTENCY_IN_PROGRESS: 409,
  IDEMPOTENCY_PAYLOAD_MISMATCH: 409,
  CONFIRMATION_REQUIRED: 409,

  ARTICLE_NOT_FOUND: 404,
  CATEGORY_NOT_FOUND: 404,
  DUPLICATE_SOURCE_URL: 409,
  INVALID_STATUS_TRANSITION: 409,
  ARTICLE_NOT_APPROVED: 409,
  ARTICLE_NOT_SCHEDULED: 409,
  SCHEDULE_IN_THE_PAST: 422,
  NO_FIELDS_TO_UPDATE: 422,

  INTERNAL_ERROR: 500,
}

export function httpStatusForCode(code: AgentErrorCode): number {
  return HTTP_STATUS[code] ?? 500
}

/**
 * The only error type the tool layer is allowed to throw across a module
 * boundary. Anything else that escapes a handler is mapped to INTERNAL_ERROR
 * with its message swallowed — see runner.ts — because an unplanned exception
 * may carry a connection string or a query fragment.
 */
export class AgentError extends Error {
  readonly code: AgentErrorCode
  /** Machine-readable context. Must never contain secrets or credentials. */
  readonly details?: Record<string, unknown>

  constructor(code: AgentErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = "AgentError"
    this.code = code
    this.details = details
  }
}

export function isAgentError(err: unknown): err is AgentError {
  return err instanceof AgentError
}
