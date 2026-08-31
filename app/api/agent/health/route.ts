/**
 * GET /api/agent/health
 *
 * Liveness only. Unauthenticated on purpose — an agent platform's connection
 * test runs before a credential is configured, and a health check that needs
 * the thing it is checking is not a health check.
 *
 * Because it is public, it says as little as possible: no version of Next, no
 * database status, no environment, no hostname, no build id. `configured` is a
 * single boolean answering "has anyone set up an agent credential here" — it
 * tells an operator why their calls 503 without telling a stranger anything
 * they could act on.
 */

import { NextResponse } from "next/server"
import { AGENT_API_VERSION } from "@/lib/agent/envelope"
import { loadConfiguredAgents } from "@/lib/agent/auth"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      status: "ok",
      apiVersion: AGENT_API_VERSION,
      timestamp: new Date().toISOString(),
      configured: loadConfiguredAgents().length > 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
