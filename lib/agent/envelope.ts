/**
 * lib/agent/envelope.ts — The one response shape every Agent API endpoint uses.
 *
 * An external LLM agent parses these bodies without a human in the loop, so the
 * shape has to be boring and identical on every path — success, validation
 * failure, auth failure, crash. A route that returns a bare `{ error: "..." }`
 * (as several of the older NotiLab routes do) forces the agent to guess.
 *
 * `meta` is always present, including on failures: `requestId` is what the
 * operator greps for when an agent reports "the call failed".
 */

import { NextResponse } from "next/server"
import { httpStatusForCode, type AgentErrorCode } from "./errors"

/** Bumped when the wire contract changes in a way agents must notice. */
export const AGENT_API_VERSION = "1.0"

export interface AgentMeta {
  requestId: string
  timestamp: string
  apiVersion: string
  /** Absent on transport-level failures that never resolved a tool. */
  tool?: string
  /** Absent when authentication itself failed. */
  agentId?: string
  durationMs?: number
  /** True when the body was replayed from a previous call with the same Idempotency-Key. */
  idempotentReplay?: boolean
  /**
   * False when a write succeeded but its audit row could not be stored. Surfaced
   * rather than swallowed — an operator needs to know the trail has a hole in it.
   */
  auditRecorded?: boolean
  /** Populated only when the request was halted pending a human decision. */
  confirmation?: ConfirmationEnvelope
}

export interface ConfirmationEnvelope {
  /** Why a human is being asked. Short enough for an agent to relay verbatim. */
  reason: string
  /** Plain-language description of what would happen if confirmed. */
  summary: string
  /**
   * Echo this back in the request body as `confirmationToken` to proceed.
   * Deliberately derived from the payload, so confirming one action cannot
   * authorise a different one.
   */
  confirmationToken: string
}

export interface AgentSuccessBody<T> {
  success: true
  data: T
  meta: AgentMeta
}

export interface AgentErrorBody {
  success: false
  error: {
    code: AgentErrorCode
    message: string
    details?: Record<string, unknown>
  }
  meta: AgentMeta
}

export type AgentResponseBody<T> = AgentSuccessBody<T> | AgentErrorBody

export function successBody<T>(data: T, meta: AgentMeta): AgentSuccessBody<T> {
  return { success: true, data, meta }
}

export function errorBody(
  code: AgentErrorCode,
  message: string,
  meta: AgentMeta,
  details?: Record<string, unknown>,
): AgentErrorBody {
  return {
    success: false,
    error: details ? { code, message, details } : { code, message },
    meta,
  }
}

/**
 * Wraps a body in a NextResponse. The status is derived from the error code
 * rather than passed in, so a code and its status can never drift apart across
 * call sites.
 *
 * `no-store` matters: a cached 200 for an agent's `search_articles` would make
 * the agent act on a stale editorial state.
 */
export function toResponse<T>(body: AgentResponseBody<T>): NextResponse {
  const status = body.success ? 200 : httpStatusForCode(body.error.code)
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Agent-Request-Id": body.meta.requestId,
    },
  })
}
