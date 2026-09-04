/**
 * lib/mcp/protocol.ts — JSON-RPC 2.0 and the MCP handshake constants.
 *
 * Why this is hand-written rather than `@modelcontextprotocol/sdk`:
 *
 * The official TypeScript SDK is excellent, and it is the right choice for a
 * standalone MCP server. It is the wrong choice *here*, for reasons that are
 * about this deployment rather than about the SDK:
 *
 *   1. Its dependency tree brings `express`, `hono`, `cors`, `jose`, `ajv`,
 *      `zod`, `eventsource`, `pkce-challenge` and `express-rate-limit` — two
 *      complete HTTP server stacks — into a Next.js application that already
 *      has its own routing, its own validator (lib/agent/schema.ts) and its own
 *      rate limiter. AGENTS.md § Dependency Policy says prefer what is
 *      installed; this is the case that policy is for.
 *   2. `StreamableHTTPServerTransport` is written against Node's
 *      `IncomingMessage`/`ServerResponse`. The App Router exposes neither, so
 *      it needs an adapter, and the usual one (`mcp-handler`) peer-depends on a
 *      different package again and wants Redis for its SSE mode — which a
 *      stateless serverless deployment cannot provide.
 *   3. What is actually needed is small and frozen: JSON-RPC 2.0 over a single
 *      POST, five methods, no sessions, no server-initiated messages. That is
 *      the subset below, and it is fully covered by tests.
 *
 * Revisit this if NotiLab ever needs server-initiated notifications, sampling,
 * elicitation or OAuth resource-server behaviour — at that point the SDK earns
 * its weight, and only this directory changes, because lib/agent/execute.ts
 * knows nothing about MCP.
 *
 * Spec: https://modelcontextprotocol.io/specification/2025-06-18
 */

/** Versions this server can speak, newest first. */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const

export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0]

export const MCP_SERVER_NAME = "notilab"
export const MCP_SERVER_TITLE = "NotiLab Editorial"

/** Header a client echoes on every request after `initialize`. */
export const PROTOCOL_VERSION_HEADER = "MCP-Protocol-Version"

// ── JSON-RPC 2.0 ────────────────────────────────────────────────────────────

/** A request id. `null` is legal in JSON-RPC but never identifies a call. */
export type JsonRpcId = string | number | null

export interface JsonRpcRequest {
  jsonrpc: "2.0"
  /** Absent on a notification, which by definition gets no response. */
  id?: JsonRpcId
  method: string
  params?: unknown
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0"
  id: JsonRpcId
  result: unknown
}

export interface JsonRpcFailure {
  jsonrpc: "2.0"
  id: JsonRpcId
  error: { code: number; message: string; data?: unknown }
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure

/** The standard codes. Everything this server reports is one of these. */
export const JSON_RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const

export function jsonRpcSuccess(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result }
}

export function jsonRpcFailure(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcFailure {
  return { jsonrpc: "2.0", id, error: data === undefined ? { code, message } : { code, message, data } }
}

/**
 * Recognises a well-formed JSON-RPC request object.
 *
 * Deliberately strict about `jsonrpc` and `method`: everything downstream
 * assumes a string method name, and a malformed frame must be answered as
 * INVALID_REQUEST rather than fall through to a method lookup.
 */
export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (record.jsonrpc !== "2.0") return false
  return typeof record.method === "string" && record.method.length > 0
}

/** A notification carries no id, so it must receive no response. */
export function isNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined
}

/** Picks the version to answer `initialize` with. */
export function negotiateProtocolVersion(requested: unknown): string {
  if (
    typeof requested === "string" &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
  ) {
    return requested
  }
  // Answering with our latest is what the spec prescribes when the client asked
  // for something we do not speak; the client then decides whether to continue.
  return LATEST_PROTOCOL_VERSION
}
