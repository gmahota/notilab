/**
 * GET /api/agent/openapi
 *
 * The OpenAPI 3.1 description of this API, generated from the tool registry.
 * This is what an agent platform imports to learn NotiLab's tools.
 *
 * Returned as a bare document rather than wrapped in the `{ success, data }`
 * envelope: importers expect an OpenAPI document at this URL, and burying it
 * one level down would break every one of them. It is the single deliberate
 * exception to the envelope rule, and it is still authenticated — the paths are
 * filtered to the calling credential's permissions, so the document doubles as
 * a statement of what that agent may do.
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { authenticateAgent } from "@/lib/agent/auth"
import { buildOpenApiDocument } from "@/lib/agent/openapi"
import { errorBody, toResponse, AGENT_API_VERSION } from "@/lib/agent/envelope"
import { isAgentError } from "@/lib/agent/errors"
import { randomUUID } from "node:crypto"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const identity = authenticateAgent(request.headers)
    return NextResponse.json(buildOpenApiDocument(identity.permissions), {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (err) {
    const meta = {
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
      apiVersion: AGENT_API_VERSION,
      tool: "openapi",
    }
    if (isAgentError(err)) return toResponse(errorBody(err.code, err.message, meta))
    console.error("[agent/openapi] Unhandled error", err)
    return toResponse(errorBody("INTERNAL_ERROR", "The request could not be completed.", meta))
  }
}
