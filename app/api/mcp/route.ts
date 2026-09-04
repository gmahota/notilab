/**
 * POST /api/mcp — NotiLab's remote MCP server (Streamable HTTP, stateless).
 *
 * One endpoint, one verb, no sessions. That is a deliberate reading of the
 * Streamable HTTP transport rather than a partial implementation of it:
 *
 *   - The spec makes the session id optional. A serverless deployment has no
 *     process to hold a session in, so this server issues none and ignores any
 *     `Mcp-Session-Id` a client sends. Every request carries its own credential
 *     and is answered on its own.
 *   - The spec allows a server to answer a POST with `application/json` instead
 *     of opening an SSE stream. NotiLab has no server-initiated messages —
 *     no sampling, no elicitation, no `listChanged` — so a stream would carry
 *     exactly one event and then close. JSON is the honest shape.
 *   - GET (the SSE channel) and DELETE (session termination) are therefore 405,
 *     which is what the spec prescribes for a server that offers neither.
 *
 * The handler stays thin per AGENTS.md § Next.js Rules: authenticate, decode,
 * hand each message to lib/mcp/server.ts, frame the answer.
 *
 * Note the ordering below. The credential is checked *before* the body is read,
 * so an unauthenticated caller never gets its payload parsed, let alone
 * dispatched.
 */

import { randomUUID } from "node:crypto"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { isAgentError } from "@/lib/agent/errors"
import { httpStatusForCode } from "@/lib/agent/errors"
import { authenticateMcp } from "@/lib/mcp/auth"
import { handleMcpMessage } from "@/lib/mcp/server"
import {
  JSON_RPC,
  LATEST_PROTOCOL_VERSION,
  PROTOCOL_VERSION_HEADER,
  isJsonRpcRequest,
  jsonRpcFailure,
  negotiateProtocolVersion,
  type JsonRpcResponse,
} from "@/lib/mcp/protocol"

/** Never cached, never statically analysed — every call is authenticated. */
export const dynamic = "force-dynamic"

function baseHeaders(protocolVersion: string): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    [PROTOCOL_VERSION_HEADER]: protocolVersion,
  }
}

function failure(
  status: number,
  code: number,
  message: string,
  protocolVersion: string,
): NextResponse {
  return NextResponse.json(jsonRpcFailure(null, code, message), {
    status,
    headers: baseHeaders(protocolVersion),
  })
}

export async function POST(request: NextRequest): Promise<Response> {
  // Echoed back so a client can confirm the version in use even on an error.
  const protocolVersion = negotiateProtocolVersion(
    request.headers.get(PROTOCOL_VERSION_HEADER) ?? undefined,
  )

  // ── Who ───────────────────────────────────────────────────────────────────
  let identity
  try {
    identity = authenticateMcp(request.headers)
  } catch (err) {
    if (isAgentError(err)) {
      // The JSON-RPC layer has no auth code of its own, so the reason travels
      // in the message and the HTTP status carries the machine signal:
      // 401 for a bad or missing key, 503 when MCP is not configured here.
      return failure(
        httpStatusForCode(err.code),
        JSON_RPC.INVALID_REQUEST,
        `${err.code}: ${err.message}`,
        protocolVersion,
      )
    }
    console.error("[api/mcp] Unhandled error while authenticating", err)
    return failure(500, JSON_RPC.INTERNAL_ERROR, "The request could not be completed.", protocolVersion)
  }

  // ── What ──────────────────────────────────────────────────────────────────
  let payload: unknown
  try {
    const raw = await request.text()
    payload = raw.trim() ? JSON.parse(raw) : null
  } catch {
    return failure(400, JSON_RPC.PARSE_ERROR, "Request body is not valid JSON.", protocolVersion)
  }

  // One request id for the whole HTTP call, so a batch shares a correlation id
  // in the server log and in every audit row it produces.
  const requestId = randomUUID()
  const ctx = { identity, requestId }

  // A batch is legal in protocol version 2025-03-26 and was removed in
  // 2025-06-18. Accepted either way: refusing a frame an older client is
  // entitled to send would break it for no security gain.
  const messages = Array.isArray(payload) ? payload : [payload]

  if (messages.length === 0) {
    return failure(400, JSON_RPC.INVALID_REQUEST, "Empty JSON-RPC batch.", protocolVersion)
  }

  const responses: JsonRpcResponse[] = []

  for (const message of messages) {
    if (!isJsonRpcRequest(message)) {
      responses.push(
        jsonRpcFailure(
          typeof message === "object" && message !== null && "id" in message
            ? ((message as { id: string | number | null }).id ?? null)
            : null,
          JSON_RPC.INVALID_REQUEST,
          "Not a JSON-RPC 2.0 request object.",
        ),
      )
      continue
    }

    const response = await handleMcpMessage(message, ctx)
    if (response) responses.push(response)
  }

  // Notifications only — nothing to answer. 202 is what the spec asks for.
  if (responses.length === 0) {
    return new NextResponse(null, { status: 202, headers: baseHeaders(protocolVersion) })
  }

  return NextResponse.json(Array.isArray(payload) ? responses : responses[0], {
    status: 200,
    headers: baseHeaders(protocolVersion),
  })
}

/**
 * The Streamable HTTP spec says a server that does not offer an SSE stream on
 * GET must answer 405. Answered as a JSON-RPC frame rather than an empty body
 * so a client that logs the response has something to read.
 */
export async function GET(): Promise<Response> {
  return failure(
    405,
    JSON_RPC.INVALID_REQUEST,
    "This MCP server is stateless and does not offer an SSE stream. Send JSON-RPC over POST.",
    LATEST_PROTOCOL_VERSION,
  )
}

/** No sessions to terminate — see the note at the top of this file. */
export async function DELETE(): Promise<Response> {
  return failure(
    405,
    JSON_RPC.INVALID_REQUEST,
    "This MCP server is stateless and issues no session id.",
    LATEST_PROTOCOL_VERSION,
  )
}
