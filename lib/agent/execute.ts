/**
 * lib/agent/execute.ts — The pipeline every agent tool call passes through,
 * with no HTTP in it.
 *
 * This module used to be the body of `runTool` in runner.ts. It was lifted out
 * when NotiLab grew a second transport (MCP, see lib/mcp/*), for the reason
 * that matters most about this layer: there must be exactly one implementation
 * of the ordering
 *
 *   rate limit → resolve tool → authorise → validate → confirmation gate
 *   → claim idempotency key → execute through the business layer → audit
 *
 * A second transport that reimplemented any of those steps would eventually
 * reimplement one of them differently, and the difference would be a way to
 * reach the newsroom without passing a gate. So a transport's whole job is:
 * authenticate, hand an `AgentIdentity` and an untrusted argument object to
 * `executeToolCall`, and render the outcome in its own wire format. It cannot
 * skip a step, because it does not own any of them.
 *
 * Authentication deliberately stays outside. Each transport carries its own
 * credential (`NOTILAB_AGENT_API_KEY` for HTTP, `NOTILAB_MCP_API_KEY` for MCP)
 * so an operator can revoke one without revoking the other, and so the audit
 * trail can tell them apart.
 */

import { randomUUID } from "node:crypto"
import { AgentError, isAgentError } from "./errors"
import { assertPermissions, type AgentIdentity } from "./auth"
import { consumeRateLimit, type RateDecision } from "./rate-limit"
import { getTool, listToolNames } from "./registry"
import { parseInput } from "./schema"
import {
  recordAgentAction,
  type AgentTransport,
  type ConfirmationAudit,
  type FieldChange,
} from "./audit"
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  payloadFingerprint,
  releaseIdempotencyKey,
} from "./idempotency"
import { confirmationTokenFor, confirmationTokenMatches } from "./confirmation"
import type { ConfirmationEnvelope } from "./envelope"

/**
 * Which door a call came through. Declared in audit.ts, because the audit row
 * is where it ultimately lands; re-exported here so a transport imports one
 * module rather than two.
 */
export type { AgentTransport }

/**
 * Argument keys the pipeline consumes before validation, so they are not
 * rejected as unknown fields. Kept to a minimum — every reserved key is one an
 * agent cannot use as a tool parameter, on every transport.
 */
const RESERVED_ARGUMENT_KEYS = new Set(["confirmationToken"])

export interface ToolCallRequest {
  toolName: string
  /** Untrusted argument object exactly as the caller sent it. Never trusted. */
  args: unknown
  identity: AgentIdentity
  transport: AgentTransport
  /**
   * Opaque retry key. HTTP takes it from the `Idempotency-Key` header; MCP
   * derives one — see lib/mcp/server.ts. Only honoured on mutating tools.
   */
  idempotencyKey?: string
  /** Fixed at the start of the request so every timestamp in one call agrees. */
  now?: Date
  /** Supplied by the caller for correlation; generated when absent. */
  requestId?: string
  /**
   * The token from a previous CONFIRMATION_REQUIRED answer, when the transport
   * carries it out of band.
   *
   * HTTP does not need this — the Agent API takes `confirmationToken` inside the
   * body, which the reserved-key strip below handles. MCP does: every tool's
   * advertised `inputSchema` sets `additionalProperties: false`, so a strict
   * client drops any argument that is not a declared field, and the token would
   * never arrive. MCP therefore reads it from `_meta` and passes it here. See
   * lib/mcp/server.ts.
   */
  confirmationToken?: string
}

export interface ToolCallMeta {
  requestId: string
  tool: string
  agentId: string
  transport: AgentTransport
  durationMs: number
  /** Undefined when the call failed before a tool was resolved. */
  mutating?: boolean
  /** True when the body was replayed from a previous call with the same key. */
  idempotentReplay?: boolean
  /** False when a write succeeded but its audit row could not be stored. */
  auditRecorded?: boolean
  /** Populated only when the call was halted pending a human decision. */
  confirmation?: ConfirmationEnvelope
  /** Present whenever the rate limiter was consulted, so a transport can report it. */
  rate?: RateDecision
}

export type ToolCallOutcome =
  | { ok: true; data: unknown; meta: ToolCallMeta }
  | { ok: false; error: AgentError; meta: ToolCallMeta }

/**
 * Runs one named tool for an already-authenticated identity.
 *
 * Never throws: every failure comes back as `{ ok: false, error }` carrying a
 * code from the frozen vocabulary in errors.ts. An unrecognised exception is
 * logged in full with the request id and answered as INTERNAL_ERROR, because
 * its message could carry a query fragment or a connection string.
 */
export async function executeToolCall(request: ToolCallRequest): Promise<ToolCallOutcome> {
  const requestId = request.requestId ?? randomUUID()
  const startedAt = Date.now()
  const now = request.now ?? new Date()
  const { identity, toolName, transport } = request

  let auditContext: { action: string; resource: string; mutating: boolean } | null = null
  let validatedInput: Record<string, unknown> | undefined
  let idempotencyRecordId: string | null = null
  let idempotencyKey: string | undefined
  let rate: RateDecision | undefined
  let confirmationAudit: ConfirmationAudit | undefined

  const meta = (extra: Partial<ToolCallMeta> = {}): ToolCallMeta => ({
    requestId,
    tool: toolName,
    agentId: identity.id,
    transport,
    durationMs: Date.now() - startedAt,
    ...(auditContext ? { mutating: auditContext.mutating } : {}),
    ...(rate ? { rate } : {}),
    ...extra,
  })

  /**
   * Records a failed write attempt. Denied and invalid attempts are worth
   * keeping: "this agent tried to publish 40 times and was refused" is the kind
   * of thing an operator needs to be able to see afterwards.
   */
  const auditFailure = async (error: AgentError): Promise<void> => {
    if (!auditContext?.mutating) return
    await recordAgentAction({
      agentId: identity.id,
      transport,
      tool: toolName,
      action: auditContext.action,
      resource: auditContext.resource,
      resourceId: typeof validatedInput?.id === "string" ? (validatedInput.id as string) : "-",
      outcome: "error",
      requestId,
      durationMs: Date.now() - startedAt,
      input: validatedInput,
      errorCode: error.code,
      errorMessage: error.message,
      idempotencyKey,
      confirmation: confirmationAudit,
    })
  }

  try {
    // ── How fast ─────────────────────────────────────────────────────────────
    rate = consumeRateLimit(identity.id, now.getTime())
    if (!rate.allowed) {
      // Not audited to the database on purpose: writing a row per throttled
      // request would amplify exactly the load being throttled.
      console.warn(
        `[agent/execute] rate limit hit by agent:${identity.id} on ${toolName} via ${transport}`,
      )
      throw new AgentError(
        "RATE_LIMITED",
        `Rate limit of ${rate.limit} requests exceeded. Retry in ${rate.retryAfterSeconds}s.`,
        { limit: rate.limit, retryAfterSeconds: rate.retryAfterSeconds },
      )
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
    let presentedConfirmation: string | undefined = request.confirmationToken?.trim() || undefined
    let toolArgs: unknown = request.args

    if (typeof request.args === "object" && request.args !== null && !Array.isArray(request.args)) {
      const stripped: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(request.args as Record<string, unknown>)) {
        if (RESERVED_ARGUMENT_KEYS.has(key)) {
          // An out-of-band token wins: a transport that had to route the token
          // around the schema knows better than an argument of the same name.
          if (key === "confirmationToken" && typeof value === "string" && !presentedConfirmation) {
            presentedConfirmation = value
          }
          continue
        }
        stripped[key] = value
      }
      toolArgs = stripped
    }

    const parsed = parseInput(tool.input, toolArgs)
    if (!parsed.ok) {
      throw new AgentError("VALIDATION_FAILED", "One or more fields are invalid.", {
        fields: parsed.errors,
      })
    }
    validatedInput = parsed.value as Record<string, unknown>

    // ── Does a human need to say yes ─────────────────────────────────────────
    // The policy sees the calling identity so a credential an operator has
    // deliberately exempted can pass — see AgentIdentity.skipCriticalConfirmation.
    const decision = tool.confirmation?.(parsed.value, { agent: identity }) ?? { required: false }
    if (decision.required) {
      const expected = confirmationTokenFor(identity.id, tool.name, parsed.value)
      const approved =
        presentedConfirmation !== undefined &&
        confirmationTokenMatches(expected, presentedConfirmation)

      // Recorded either way. "This agent was asked to confirm and did" and "this
      // agent was refused for lack of a token" are both things an operator
      // reviewing a publish needs to be able to see.
      confirmationAudit = { required: true, satisfied: approved }

      if (!approved) {
        const error = new AgentError(
          "CONFIRMATION_REQUIRED",
          decision.summary ?? "This action needs human confirmation before it can run.",
        )
        await auditFailure(error)
        return {
          ok: false,
          error,
          meta: meta({
            confirmation: {
              reason: decision.reason ?? "confirmation_required",
              summary: decision.summary ?? error.message,
              confirmationToken: expected,
            },
          }),
        }
      }
    }

    // ── Has this exact call already run ──────────────────────────────────────
    let idempotencyDegraded = false

    if (tool.mutating && request.idempotencyKey) {
      idempotencyKey = request.idempotencyKey
      const outcome = await claimIdempotencyKey(
        identity.id,
        tool.name,
        request.idempotencyKey,
        parsed.value,
      )

      if (outcome.kind === "replay") {
        return { ok: true, data: outcome.data, meta: meta({ idempotentReplay: true }) }
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
        transport,
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
        confirmation: confirmationAudit,
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
        `[agent/execute] Idempotency-Key accepted but not enforced for request ${requestId} — storage unavailable`,
      )
    }

    return { ok: true, data: result.data, meta: meta(tool.mutating ? { auditRecorded } : {}) }
  } catch (err) {
    if (idempotencyRecordId) {
      // Free the key so the agent can retry with it. Without this one transient
      // failure would permanently burn that key.
      await releaseIdempotencyKey(idempotencyRecordId)
    }

    if (isAgentError(err)) {
      await auditFailure(err)
      return { ok: false, error: err, meta: meta() }
    }

    // Anything unplanned: full detail to the server log, nothing to the caller.
    console.error(
      `[agent/execute] Unhandled error on ${toolName} (request ${requestId}, ${transport})`,
      err,
    )
    const wrapped = new AgentError("INTERNAL_ERROR", "The request could not be completed.")
    await auditFailure(wrapped)
    return { ok: false, error: wrapped, meta: meta() }
  }
}
