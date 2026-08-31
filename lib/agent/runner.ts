/**
 * lib/agent/runner.ts — The pipeline every agent call passes through.
 *
 * One implementation, one order, no exceptions:
 *
 *   parse body → authenticate → rate limit → resolve tool → authorise
 *   → validate input → confirmation gate → claim idempotency key
 *   → execute through the business layer → audit → respond
 *
 * The value of putting this in one place is that a new tool cannot forget a
 * step. A tool author writes a schema and a handler; they cannot accidentally
 * ship one that skips authorisation or leaves no audit trail, because neither
 * is their code's responsibility.
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
import {
  AGENT_API_VERSION,
  errorBody,
  successBody,
  toResponse,
  type AgentMeta,
} from "./envelope"
import { AgentError, isAgentError } from "./errors"
import { assertPermissions, authenticateAgent, type AgentIdentity } from "./auth"
import { consumeRateLimit } from "./rate-limit"
import { getTool, listToolNames } from "./registry"
import { parseInput } from "./schema"
import { recordAgentAction, type FieldChange } from "./audit"
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  payloadFingerprint,
  releaseIdempotencyKey,
} from "./idempotency"
import { confirmationTokenFor, confirmationTokenMatches } from "./confirmation"

/**
 * Body keys the runner consumes before validation, so they are not rejected as
 * unknown fields. Kept to a minimum — every reserved key is one an agent cannot
 * use as a tool parameter.
 */
const RESERVED_BODY_KEYS = new Set(["confirmationToken"])

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

/** Executes one named tool and returns the HTTP response. */
export async function runTool(toolName: string, request: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID()
  const startedAt = Date.now()
  const now = new Date()

  let identity: AgentIdentity | null = null
  let auditContext: { action: string; resource: string; mutating: boolean } | null = null
  let validatedInput: Record<string, unknown> | undefined
  let idempotencyRecordId: string | null = null
  let idempotencyKey: string | undefined

  const meta = (extra: Partial<AgentMeta> = {}): AgentMeta => ({
    ...baseMeta(requestId, toolName),
    ...(identity ? { agentId: identity.id } : {}),
    durationMs: Date.now() - startedAt,
    ...extra,
  })

  /**
   * Records a failed write attempt. Denied and invalid attempts are worth
   * keeping: "this agent tried to publish 40 times and was refused" is the kind
   * of thing an operator needs to be able to see afterwards.
   */
  const auditFailure = async (error: AgentError): Promise<void> => {
    if (!identity || !auditContext?.mutating) return
    await recordAgentAction({
      agentId: identity.id,
      tool: toolName,
      action: auditContext.action,
      resource: auditContext.resource,
      resourceId:
        typeof validatedInput?.id === "string" ? (validatedInput.id as string) : "-",
      outcome: "error",
      requestId,
      durationMs: Date.now() - startedAt,
      input: validatedInput,
      errorCode: error.code,
      errorMessage: error.message,
      idempotencyKey,
    })
  }

  try {
    // ── Body ─────────────────────────────────────────────────────────────────
    const rawBody = await readJsonBody(request)

    // ── Who ──────────────────────────────────────────────────────────────────
    identity = authenticateAgent(request.headers)

    // ── How fast ─────────────────────────────────────────────────────────────
    const rate = consumeRateLimit(identity.id, now.getTime())
    if (!rate.allowed) {
      // Not audited to the database on purpose: writing a row per throttled
      // request would amplify exactly the load being throttled.
      console.warn(`[agent/runner] rate limit hit by agent:${identity.id} on ${toolName}`)
      const response = toResponse(
        errorBody(
          "RATE_LIMITED",
          `Rate limit of ${rate.limit} requests exceeded. Retry in ${rate.retryAfterSeconds}s.`,
          meta(),
        ),
      )
      response.headers.set("Retry-After", String(rate.retryAfterSeconds))
      return response
    }

    // ── What ─────────────────────────────────────────────────────────────────
    const tool = getTool(toolName)
    if (!tool) {
      throw new AgentError("TOOL_NOT_FOUND", `No tool named "${toolName}".`, {
        availableTools: listToolNames(),
      })
    }

    auditContext = {
      action: tool.audit?.action ?? `TOOL_${tool.name.toUpperCase()}`,
      resource: tool.audit?.resource ?? "ARTICLE",
      mutating: tool.mutating,
    }

    // ── May they ─────────────────────────────────────────────────────────────
    assertPermissions(identity, tool.permissions)

    // ── Is the request well-formed ───────────────────────────────────────────
    const bodyRecord =
      typeof rawBody === "object" && rawBody !== null && !Array.isArray(rawBody)
        ? (rawBody as Record<string, unknown>)
        : rawBody

    let presentedConfirmation: string | undefined
    let toolBody: unknown = bodyRecord

    if (typeof bodyRecord === "object" && bodyRecord !== null && !Array.isArray(bodyRecord)) {
      const stripped: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(bodyRecord)) {
        if (RESERVED_BODY_KEYS.has(key)) {
          if (key === "confirmationToken" && typeof value === "string") {
            presentedConfirmation = value
          }
          continue
        }
        stripped[key] = value
      }
      toolBody = stripped
    }

    const parsed = parseInput(tool.input, toolBody)
    if (!parsed.ok) {
      throw new AgentError("VALIDATION_FAILED", "One or more fields are invalid.", {
        fields: parsed.errors,
      })
    }
    validatedInput = parsed.value as Record<string, unknown>

    // ── Does a human need to say yes ─────────────────────────────────────────
    const decision = tool.confirmation?.(parsed.value) ?? { required: false }
    if (decision.required) {
      const expected = confirmationTokenFor(identity.id, tool.name, parsed.value)
      const approved =
        presentedConfirmation !== undefined &&
        confirmationTokenMatches(expected, presentedConfirmation)

      if (!approved) {
        const error = new AgentError(
          "CONFIRMATION_REQUIRED",
          decision.summary ?? "This action needs human confirmation before it can run.",
        )
        await auditFailure(error)
        return toResponse(
          errorBody(
            "CONFIRMATION_REQUIRED",
            error.message,
            meta({
              confirmation: {
                reason: decision.reason ?? "confirmation_required",
                summary: decision.summary ?? error.message,
                confirmationToken: expected,
              },
            }),
          ),
        )
      }
    }

    // ── Has this exact call already run ──────────────────────────────────────
    const headerKey = request.headers.get("idempotency-key")?.trim()
    let idempotencyDegraded = false

    if (tool.mutating && headerKey) {
      idempotencyKey = headerKey
      const outcome = await claimIdempotencyKey(identity.id, tool.name, headerKey, parsed.value)

      if (outcome.kind === "replay") {
        return toResponse(successBody(outcome.data, meta({ idempotentReplay: true })))
      }
      if (outcome.kind === "proceed") {
        idempotencyRecordId = outcome.recordId
      } else {
        idempotencyDegraded = true
      }
    }

    // ── Do it, through the business layer ────────────────────────────────────
    const result = await tool.handler(parsed.value, { agent: identity, requestId, now })

    // ── Write it down ────────────────────────────────────────────────────────
    let auditRecorded = true
    if (tool.mutating) {
      auditRecorded = await recordAgentAction({
        agentId: identity.id,
        tool: tool.name,
        action: result.audit?.action ?? auditContext.action,
        resource: auditContext.resource,
        resourceId: result.audit?.resourceId ?? "-",
        outcome: "success",
        requestId,
        durationMs: Date.now() - startedAt,
        input: parsed.value,
        changes: result.audit?.changes as Record<string, FieldChange> | undefined,
        idempotencyKey,
      })
    }

    if (idempotencyRecordId) {
      await completeIdempotencyKey(
        idempotencyRecordId,
        payloadFingerprint(parsed.value),
        result.data,
      )
    }

    if (idempotencyDegraded) {
      console.warn(
        `[agent/runner] Idempotency-Key accepted but not enforced for request ${requestId} — storage unavailable`,
      )
    }

    const response = toResponse(
      successBody(result.data, meta(tool.mutating ? { auditRecorded } : {})),
    )
    response.headers.set("X-RateLimit-Limit", String(rate.limit))
    response.headers.set("X-RateLimit-Remaining", String(rate.remaining))
    return response
  } catch (err) {
    if (idempotencyRecordId) {
      // Free the key so the agent can retry with it. Without this one transient
      // failure would permanently burn that key.
      await releaseIdempotencyKey(idempotencyRecordId)
    }

    if (isAgentError(err)) {
      await auditFailure(err)
      return toResponse(errorBody(err.code, err.message, meta(), err.details))
    }

    // Anything unplanned: full detail to the server log, nothing to the caller.
    console.error(`[agent/runner] Unhandled error on ${toolName} (request ${requestId})`, err)
    const wrapped = new AgentError("INTERNAL_ERROR", "The request could not be completed.")
    await auditFailure(wrapped)
    return toResponse(errorBody("INTERNAL_ERROR", wrapped.message, meta()))
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
