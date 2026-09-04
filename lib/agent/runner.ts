/**
 * lib/agent/runner.ts — The HTTP transport for the Agent Management API.
 *
 * The pipeline itself lives in lib/agent/execute.ts. This module owns only what
 * is genuinely about HTTP:
 *
 *   read the body → authenticate the bearer key → read Idempotency-Key
 *   → executeToolCall → render the { success, data, meta } envelope
 *
 * That split exists because NotiLab has a second transport (MCP, lib/mcp/*).
 * Both authenticate their own credential and both hand off to the same
 * `executeToolCall`, so neither can drift into a version of the pipeline that
 * skips authorisation, validation or the audit trail.
 *
 * Two rules about what leaves this module:
 *
 *   - An unrecognised exception never reaches the client. Its message could
 *     carry a query fragment or a connection string, so it is logged with the
 *     request id and answered as INTERNAL_ERROR.
 *   - Authentication failures do not distinguish "no key" from "wrong key" in a
 *     way that helps enumeration, and never echo the presented key anywhere.
 */

import { randomUUID } from "node:crypto"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { AGENT_API_VERSION, errorBody, successBody, toResponse, type AgentMeta } from "./envelope"
import { AgentError, isAgentError } from "./errors"
import { authenticateAgent, type AgentIdentity } from "./auth"
import { consumeRateLimit } from "./rate-limit"
import { executeToolCall, type ToolCallMeta } from "./execute"

function baseMeta(requestId: string, tool?: string): AgentMeta {
  return {
    requestId,
    timestamp: new Date().toISOString(),
    apiVersion: AGENT_API_VERSION,
    ...(tool ? { tool } : {}),
  }
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  const raw = await request.text()
  if (!raw.trim()) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw new AgentError("MALFORMED_JSON", "Request body is not valid JSON.")
  }
}

/**
 * Projects the pipeline's own meta onto the wire envelope.
 *
 * `transport` and `rate` are deliberately not published: the first is an
 * internal distinction that belongs in the audit trail rather than in a
 * response an agent branches on, and the second is already expressed as
 * `X-RateLimit-*` headers.
 */
function toEnvelopeMeta(meta: ToolCallMeta): AgentMeta {
  return {
    ...baseMeta(meta.requestId, meta.tool),
    agentId: meta.agentId,
    durationMs: meta.durationMs,
    ...(meta.idempotentReplay ? { idempotentReplay: true } : {}),
    ...(meta.auditRecorded !== undefined ? { auditRecorded: meta.auditRecorded } : {}),
    ...(meta.confirmation ? { confirmation: meta.confirmation } : {}),
  }
}

/** Executes one named tool and returns the HTTP response. */
export async function runTool(toolName: string, request: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID()
  const startedAt = Date.now()

  let identity: AgentIdentity | null = null

  try {
    const rawBody = await readJsonBody(request)
    identity = authenticateAgent(request.headers)

    const outcome = await executeToolCall({
      toolName,
      args: rawBody,
      identity,
      transport: "http",
      idempotencyKey: request.headers.get("idempotency-key")?.trim() || undefined,
      requestId,
    })

    const meta = toEnvelopeMeta(outcome.meta)

    if (!outcome.ok) {
      const response = toResponse(
        errorBody(outcome.error.code, outcome.error.message, meta, outcome.error.details),
      )
      if (outcome.error.code === "RATE_LIMITED" && outcome.meta.rate) {
        response.headers.set("Retry-After", String(outcome.meta.rate.retryAfterSeconds))
      }
      return response
    }

    const response = toResponse(successBody(outcome.data, meta))
    if (outcome.meta.rate) {
      response.headers.set("X-RateLimit-Limit", String(outcome.meta.rate.limit))
      response.headers.set("X-RateLimit-Remaining", String(outcome.meta.rate.remaining))
    }
    return response
  } catch (err) {
    // Only transport-level failures reach here — a malformed body or a rejected
    // credential. `executeToolCall` reports its own failures as values.
    const meta: AgentMeta = {
      ...baseMeta(requestId, toolName),
      ...(identity ? { agentId: identity.id } : {}),
      durationMs: Date.now() - startedAt,
    }

    if (isAgentError(err)) {
      return toResponse(errorBody(err.code, err.message, meta, err.details))
    }

    console.error(`[agent/runner] Unhandled error on ${toolName} (request ${requestId})`, err)
    return toResponse(errorBody("INTERNAL_ERROR", "The request could not be completed.", meta))
  }
}

/**
 * Runs an authenticated discovery endpoint (capabilities, OpenAPI).
 *
 * These are GETs with no tool, no input and no side effect, so they skip the
 * validation, idempotency and audit stages — but they still authenticate and
 * count against the rate limit. The catalogue an agent may call is derived from
 * its own permissions, so it must be a credentialed read.
 */
export async function runMetaEndpoint(
  name: string,
  request: NextRequest,
  produce: (identity: AgentIdentity) => unknown,
): Promise<NextResponse> {
  const requestId = randomUUID()
  const startedAt = Date.now()

  try {
    const identity = authenticateAgent(request.headers)

    const rate = consumeRateLimit(identity.id)
    if (!rate.allowed) {
      const response = toResponse(
        errorBody("RATE_LIMITED", `Rate limit of ${rate.limit} requests exceeded.`, {
          ...baseMeta(requestId, name),
          agentId: identity.id,
          durationMs: Date.now() - startedAt,
        }),
      )
      response.headers.set("Retry-After", String(rate.retryAfterSeconds))
      return response
    }

    return toResponse(
      successBody(produce(identity), {
        ...baseMeta(requestId, name),
        agentId: identity.id,
        durationMs: Date.now() - startedAt,
      }),
    )
  } catch (err) {
    if (isAgentError(err)) {
      return toResponse(
        errorBody(err.code, err.message, {
          ...baseMeta(requestId, name),
          durationMs: Date.now() - startedAt,
        }),
      )
    }
    console.error(`[agent/runner] Unhandled error on ${name} (request ${requestId})`, err)
    return toResponse(
      errorBody("INTERNAL_ERROR", "The request could not be completed.", {
        ...baseMeta(requestId, name),
        durationMs: Date.now() - startedAt,
      }),
    )
  }
}

/** Uniform answer for a verb the Agent API does not implement. */
export function methodNotAllowed(toolName?: string): NextResponse {
  return toResponse(
    errorBody(
      "METHOD_NOT_ALLOWED",
      "Agent tools are invoked with POST and a JSON body.",
      baseMeta(randomUUID(), toolName),
    ),
  )
}
