/**
 * GET /api/mcp/health
 *
 * Liveness only, and unauthenticated for the same reason as
 * `/api/agent/health`: a platform's connection test runs before a credential is
 * configured, and a health check that needs the thing it is checking is not a
 * health check.
 *
 * Because it is public, it says as little as possible. What it returns is fixed
 * at build time — the service name, the API version, the transport and the
 * protocol version — plus one runtime boolean.
 *
 * What it must never grow, however convenient it would be while debugging:
 * no client list, no client count, no agent id, no permissions, no environment
 * variable name or value, no database status, no build id, no Next version.
 * `configured` is deliberately the *only* thing that varies with configuration,
 * and it answers one question — "has anyone set up an MCP credential here" —
 * which is enough to explain a 503 to an operator and nothing a stranger can
 * act on. Notably it does not distinguish one client from five.
 */

import { NextResponse } from "next/server"
import { AGENT_API_VERSION } from "@/lib/agent/envelope"
import { isMcpConfigured } from "@/lib/mcp/auth"
import { LATEST_PROTOCOL_VERSION, MCP_SERVER_NAME } from "@/lib/mcp/protocol"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      status: "ok",
      service: `${MCP_SERVER_NAME}-mcp`,
      version: AGENT_API_VERSION,
      transport: "streamable-http",
      protocolVersion: LATEST_PROTOCOL_VERSION,
      configured: isMcpConfigured(),
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
