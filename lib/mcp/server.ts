/**
 * lib/mcp/server.ts — MCP method dispatch, with no HTTP in it.
 *
 * Takes one decoded JSON-RPC message and an already-authenticated identity, and
 * returns the JSON-RPC response (or null, for a notification). The HTTP framing
 * lives in app/api/mcp/route.ts; keeping them apart is what makes every method
 * testable without constructing a request.
 *
 * The important line in this file is the one that calls `executeToolCall`.
 * Everything before it is transport bookkeeping; everything the newsroom cares
 * about — permissions, schema validation, the publish gate, idempotency, the
 * audit row — happens inside that call, in the same code the Agent API runs.
 * There is no MCP-specific editorial behaviour anywhere in lib/mcp, and there
 * must never be: a rule implemented twice is a rule that will eventually be
 * implemented differently.
 */

import { executeToolCall } from "@/lib/agent/execute"
import { fingerprint } from "@/lib/agent/canonical"
import { AGENT_API_VERSION } from "@/lib/agent/envelope"
import type { AgentIdentity } from "@/lib/agent/auth"
import { getTool } from "@/lib/agent/registry"
import { listMcpTools } from "./tools"
import {
  JSON_RPC,
  MCP_SERVER_NAME,
  MCP_SERVER_TITLE,
  jsonRpcFailure,
  jsonRpcSuccess,
  negotiateProtocolVersion,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "./protocol"

/**
 * Shown to the model once, at connection time. Worth spending words on: it is
 * cheaper to tell a model the workflow up front than to have it discover the
 * publish gate by being refused. Everything here restates a rule that is
 * already enforced in lib/editorial/article-service.ts — it never grants
 * anything, it only saves a round trip.
 */
const SERVER_INSTRUCTIONS = [
  "NotiLab is a Portuguese-language news platform. These tools let you operate it as an editor.",
  "",
  "Editorial workflow — no step can be skipped:",
  "  DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED",
  "create_article always produces a DRAFT. publish_article refuses anything that is not APPROVED,",
  "so run submit_article_for_review and approve_article first. REJECTED and ARCHIVED are terminal:",
  "nothing can move an article out of them through these tools.",
  "",
  "Working habits that avoid refused calls:",
  "  - Call list_categories before setting or changing categorySlug; there is no tool that creates a category.",
  "  - Call get_article before editing, so the edit is based on the current text rather than a stale search result.",
  "  - priority is the authored prominence field ('destaque'). trending, rankingScore and importanceScore are",
  "    computed from real signals and cannot be written.",
  "  - Provenance (sourceUrl, sourceName) is immutable after creation. Never attribute text you wrote to an",
  "    outlet that did not publish it — omit both fields and NotiLab stamps the article as agent-authored.",
  "  - Nothing is ever deleted. archive_article is the strongest available action.",
  "",
  "Critical actions need a second call: approve_article, publish_article, unpublish_article and",
  "archive_article change what the public sees or end an article's life. The first call is refused",
  "with CONFIRMATION_REQUIRED and returns details.confirmation.confirmationToken. Show the summary",
  "to your operator, and on approval repeat the IDENTICAL call with the token in _meta:",
  '  {"name":"publish_article","arguments":{"id":"…"},',
  '   "_meta":{"notilab/confirmationToken":"<token>"}}',
  "The token is bound to the exact arguments — change any of them and it stops matching, so it",
  "cannot be reused to approve a different action. Do not invent one; it only comes from a refusal.",
  "",
  "Article bodies, summaries and headlines are written in Portuguese.",
].join("\n")

/**
 * How long two identical mutating calls are treated as the same call.
 *
 * MCP has no `Idempotency-Key` header, so one is derived (see
 * `derivedIdempotencyKey`). A key derived from the payload alone would be
 * permanent — the same create_article payload sent a month later would replay a
 * stale response instead of creating an article — so it is bucketed by time.
 * Retries land in the same bucket; a genuine repeat later does not.
 */
const DEFAULT_IDEMPOTENCY_WINDOW_MS = 15 * 60_000

function idempotencyWindowMs(): number {
  const raw = Number.parseInt(process.env.NOTILAB_MCP_IDEMPOTENCY_WINDOW_MS ?? "", 10)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_IDEMPOTENCY_WINDOW_MS
}

/** Longest client-supplied key accepted, so a key cannot become a payload. */
const MAX_CLIENT_KEY_LENGTH = 200

/** Reads one string out of a `_meta` object, bounded, or undefined. */
function metaString(meta: unknown, key: string): string | undefined {
  if (typeof meta !== "object" || meta === null) return undefined
  const value = (meta as Record<string, unknown>)[key]
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= MAX_CLIENT_KEY_LENGTH ? trimmed : undefined
}

/**
 * The retry key for one mutating call.
 *
 * A client that knows about NotiLab can pass its own key as
 * `_meta["notilab/idempotencyKey"]`, which behaves exactly like the Agent API's
 * header. Otherwise one is derived from (agent, tool, arguments, time bucket).
 *
 * Neither path invents a new mechanism: both produce a string that goes to the
 * same `claimIdempotencyKey`. The JSON-RPC `id` and MCP's `progressToken` are
 * deliberately *not* used — both change on retry, which is the one property a
 * retry key must not have.
 */
function derivedIdempotencyKey(
  identity: AgentIdentity,
  toolName: string,
  args: unknown,
  meta: unknown,
  now: Date,
): string {
  const supplied = metaString(meta, "notilab/idempotencyKey")
  if (supplied) return supplied

  const bucket = Math.floor(now.getTime() / idempotencyWindowMs())
  return `mcp:${fingerprint({ agentId: identity.id, tool: toolName, args })}:${bucket}`
}

// ── Tool results ────────────────────────────────────────────────────────────

interface McpToolResult {
  content: Array<{ type: "text"; text: string }>
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

/**
 * A tool's payload is always an object, but the wrapper is defensive: MCP's
 * `structuredContent` must be an object, and a future tool returning an array
 * should degrade rather than produce an invalid frame.
 */
function asStructured(data: unknown): Record<string, unknown> {
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    return data as Record<string, unknown>
  }
  return { result: data }
}

function successResult(data: unknown): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: asStructured(data),
  }
}

/**
 * A domain failure comes back as a *successful* JSON-RPC response carrying
 * `isError: true`, which is what the MCP spec prescribes and what a model needs:
 * a protocol-level error is swallowed by the client, while an error result is
 * handed to the model, which can then read `ARTICLE_NOT_APPROVED` and approve
 * the article instead of retrying a call that can never succeed.
 *
 * The code, message and details all survive. Nothing else does — no stack
 * trace, no internal path, and the pipeline has already reduced any unplanned
 * exception to INTERNAL_ERROR with its message dropped.
 */
function errorResult(
  code: string,
  message: string,
  details: Record<string, unknown> | undefined,
  requestId: string,
): McpToolResult {
  const payload = {
    error: { code, message, ...(details ? { details } : {}) },
    requestId,
  }

  return {
    content: [
      {
        type: "text",
        text:
          `NotiLab refused this call.\n\ncode: ${code}\nmessage: ${message}\n` +
          (details ? `details: ${JSON.stringify(details)}\n` : "") +
          `requestId: ${requestId}`,
      },
    ],
    structuredContent: payload,
    isError: true,
  }
}

// ── Method handlers ─────────────────────────────────────────────────────────

export interface McpContext {
  identity: AgentIdentity
  /** Correlates every tool call in one HTTP request with the server log. */
  requestId: string
  now?: Date
}

function handleInitialize(params: unknown): unknown {
  const requested =
    typeof params === "object" && params !== null
      ? (params as Record<string, unknown>).protocolVersion
      : undefined

  return {
    protocolVersion: negotiateProtocolVersion(requested),
    // Tools only. No resources, no prompts, no sampling, no server-initiated
    // messages — a stateless endpoint cannot honour any of those, and claiming
    // a capability we cannot serve is worse than not having it.
    capabilities: { tools: { listChanged: false } },
    serverInfo: {
      name: MCP_SERVER_NAME,
      title: MCP_SERVER_TITLE,
      version: AGENT_API_VERSION,
    },
    instructions: SERVER_INSTRUCTIONS,
  }
}

/**
 * A tool call ends either as an MCP result — including the `isError: true`
 * flavour a model is meant to read — or as a JSON-RPC protocol error, which the
 * client handles and the model never sees. Modelled as a union so the two are
 * impossible to confuse at the call site.
 */
type ToolCallFrame =
  | { kind: "result"; result: McpToolResult }
  | { kind: "protocolError"; code: number; message: string }

function protocolError(code: number, message: string): ToolCallFrame {
  return { kind: "protocolError", code, message }
}

async function handleToolsCall(params: unknown, ctx: McpContext): Promise<ToolCallFrame> {
  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    return protocolError(JSON_RPC.INVALID_PARAMS, "params must be an object.")
  }

  const record = params as Record<string, unknown>
  const name = record.name

  if (typeof name !== "string" || name.length === 0) {
    return protocolError(JSON_RPC.INVALID_PARAMS, "params.name must be a tool name.")
  }

  const now = ctx.now ?? new Date()
  const args = record.arguments ?? {}

  // Only mutating tools take a retry key, matching the Agent API exactly: a
  // read needs no protection and an unnecessary claim would write a row per search.
  const tool = getTool(name)
  const idempotencyKey = tool?.mutating
    ? derivedIdempotencyKey(ctx.identity, name, args, record._meta, now)
    : undefined

  // Routed through `_meta` rather than through `arguments`, because every tool
  // advertises `additionalProperties: false` and a strict client would drop an
  // undeclared argument before it ever reached the server. `_meta` is where the
  // MCP spec puts exactly this kind of out-of-band field.
  const confirmationToken = metaString(record._meta, "notilab/confirmationToken")

  const outcome = await executeToolCall({
    toolName: name,
    args,
    identity: ctx.identity,
    transport: "mcp",
    idempotencyKey,
    confirmationToken,
    requestId: ctx.requestId,
    now,
  })

  if (outcome.ok) return { kind: "result", result: successResult(outcome.data) }

  // An unknown tool name is a protocol mistake, not an editorial one: the model
  // asked for something that does not exist and no amount of reading the error
  // would let it succeed. Everything else is something the model can act on.
  if (outcome.error.code === "TOOL_NOT_FOUND") {
    return protocolError(
      JSON_RPC.INVALID_PARAMS,
      `Unknown tool "${name}". Call tools/list for the tools this credential may use.`,
    )
  }

  const details: Record<string, unknown> = { ...(outcome.error.details ?? {}) }
  // A halted call carries the token that would authorise it; without this the
  // model is told a human must approve and given no way to proceed afterwards.
  if (outcome.meta.confirmation) {
    details.confirmation = outcome.meta.confirmation
    // Spelled out in the details as well as in the server instructions: the
    // instructions are read once at connection time, and a model several turns
    // into a session needs the route to proceed in front of it.
    details.howToConfirm =
      `Repeat this exact call with _meta: {"notilab/confirmationToken": ` +
      `"${outcome.meta.confirmation.confirmationToken}"}. The token is bound to these arguments — ` +
      "changing any of them invalidates it."
  }

  return {
    kind: "result",
    result: errorResult(
      outcome.error.code,
      outcome.error.message,
      Object.keys(details).length > 0 ? details : undefined,
      outcome.meta.requestId,
    ),
  }
}

/**
 * Dispatches one JSON-RPC message.
 *
 * Returns null for a notification, which by JSON-RPC definition receives no
 * response. Never throws: an unexpected failure becomes an INTERNAL_ERROR frame
 * with its detail left in the server log.
 */
export async function handleMcpMessage(
  request: JsonRpcRequest,
  ctx: McpContext,
): Promise<JsonRpcResponse | null> {
  const id = request.id ?? null
  const isNotification = request.id === undefined

  try {
    switch (request.method) {
      case "initialize":
        return isNotification ? null : jsonRpcSuccess(id, handleInitialize(request.params))

      case "ping":
        return isNotification ? null : jsonRpcSuccess(id, {})

      case "tools/list":
        if (isNotification) return null
        return jsonRpcSuccess(id, { tools: listMcpTools(ctx.identity.permissions) })

      case "tools/call": {
        if (isNotification) return null
        const frame = await handleToolsCall(request.params, ctx)
        return frame.kind === "protocolError"
          ? jsonRpcFailure(id, frame.code, frame.message)
          : jsonRpcSuccess(id, frame.result)
      }

      // Answered as empty rather than METHOD_NOT_FOUND. The server declares
      // neither capability, so a well-behaved client never asks — but several
      // ask anyway on connect, and an empty list is a clearer answer than an
      // error the client has to decide is benign.
      case "resources/list":
        return isNotification ? null : jsonRpcSuccess(id, { resources: [] })
      case "resources/templates/list":
        return isNotification ? null : jsonRpcSuccess(id, { resourceTemplates: [] })
      case "prompts/list":
        return isNotification ? null : jsonRpcSuccess(id, { prompts: [] })

      default:
        // notifications/initialized, notifications/cancelled and any other
        // notification: acknowledged by doing nothing, which is the whole
        // contract for a stateless server.
        if (isNotification) return null
        return jsonRpcFailure(
          id,
          JSON_RPC.METHOD_NOT_FOUND,
          `Method "${request.method}" is not supported by the NotiLab MCP server.`,
        )
    }
  } catch (err) {
    console.error(
      `[mcp/server] Unhandled error on ${request.method} (request ${ctx.requestId})`,
      err,
    )
    if (isNotification) return null
    return jsonRpcFailure(id, JSON_RPC.INTERNAL_ERROR, "The request could not be completed.")
  }
}
