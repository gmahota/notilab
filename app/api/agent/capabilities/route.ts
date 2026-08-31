/**
 * GET /api/agent/capabilities
 *
 * What this credential can do. The first call an agent should make, and the
 * document it should keep rather than hard-coding a tool list — when NotiLab
 * gains or retires a capability, an agent that reads this adapts and one that
 * memorised a list does not.
 *
 * The catalogue is filtered to the caller's own permissions. An agent granted
 * `readonly` sees three tools and is not told the other twelve exist; showing
 * it tools it cannot call would only teach it to retry guaranteed failures.
 * `permissionCatalogue` lists every permission that exists, so an operator
 * reading this response can see what they did not grant.
 */

import type { NextRequest } from "next/server"
import { runMetaEndpoint } from "@/lib/agent/runner"
import { AGENT_API_VERSION } from "@/lib/agent/envelope"
import { describeTools } from "@/lib/agent/registry"
import { PERMISSION_DESCRIPTIONS, AGENT_PERMISSIONS } from "@/lib/agent/permissions"
import { MAX_PAGE_SIZE } from "@/lib/editorial/article-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest): Promise<Response> {
  return runMetaEndpoint("capabilities", request, (identity) => ({
    agentApiVersion: AGENT_API_VERSION,
    agent: {
      id: identity.id,
      label: identity.label,
      permissions: [...identity.permissions],
    },
    tools: describeTools(identity.permissions),
    permissionCatalogue: AGENT_PERMISSIONS.map((permission) => ({
      name: permission,
      description: PERMISSION_DESCRIPTIONS[permission],
      granted: identity.permissions.includes(permission),
    })),
    conventions: {
      invocation: "POST /api/agent/tools/<tool name> with a JSON body.",
      authentication: "Authorization: Bearer <key>, or X-Agent-Api-Key: <key>.",
      responseEnvelope:
        "{ success: true, data, meta } on success; { success: false, error: { code, message }, meta } on failure.",
      idempotency:
        "Send an Idempotency-Key header on mutating calls. A repeat with the same key returns the " +
        "stored response and sets meta.idempotentReplay.",
      confirmation:
        "A CONFIRMATION_REQUIRED error carries meta.confirmation.confirmationToken. Show the " +
        "summary to a human and, if approved, repeat the identical call with confirmationToken in the body.",
      pagination: `search_articles returns at most ${MAX_PAGE_SIZE} articles per call; page with offset.`,
      openapi: "/api/agent/openapi",
    },
    // Stated rather than left to be discovered by trying: an agent that knows
    // the boundary stops proposing actions that cannot be carried out.
    notSupported: [
      "Deleting articles. Use archive_article — nothing is destroyed.",
      "Creating, renaming or deleting categories.",
      "Managing users, roles or permissions.",
      "Changing global settings or secrets.",
      "Writing status, publishedAt, provenance, trending or any computed score directly.",
      "Running SQL or any free-form query.",
    ],
  }))
}
