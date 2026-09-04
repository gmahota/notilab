/**
 * GET /api/mcp/health
 *
 * Liveness only, and unauthenticated for the same reason as
 * `/api/agent/health`: a platform's connection test runs before a credential is
 * configured, and a health check that needs the thing it is checking is not a
 * health check.
 *
 * Because it is public, it says as little as possible. No tool list, no agent
 * id, no permissions, no version of Next, no database status, no build id.
 * `configured` is a single boolean answering "has anyone set up an MCP
 * credential here" — enough to tell an operator why their calls return 503,
 * and nothing a stranger could act on.
 */

import { NextResponse } from "next/server"
import { isMcpConfigured } from "@/lib/mcp/auth"
import { LATEST_PROTOCOL_VERSION } from "@/lib/mcp/protocol"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      status: "ok",
      configured: isMcpConfigured(),
      protocolVersion: LATEST_PROTOCOL_VERSION,
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
