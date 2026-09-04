/**
 * lib/mcp/auth.ts — The MCP transport's own credential.
 *
 * Separate from `NOTILAB_AGENT_API_KEY` on purpose, and not a fallback to it.
 * Three things follow from that, all of them things the operator asked for:
 *
 *   - Revocation is independent. Turning off Abacus does not turn off any other
 *     agent, and vice versa.
 *   - The audit trail can tell them apart. MCP calls arrive with their own
 *     `agentId` *and* with `transport: "mcp"` on every row.
 *   - A deployment that has an Agent API key but no MCP key exposes no MCP
 *     endpoint at all. There is no configuration in which forgetting the MCP
 *     variable silently grants MCP access.
 *
 * What is *not* separate: permissions. `NOTILAB_MCP_PERMISSIONS` resolves
 * through the same `lib/agent/permissions.ts` catalogue and presets, so there
 * is one vocabulary of what an agent may do, and one place to widen or narrow
 * it. A parallel permission model would be a second thing to keep correct.
 */

import { AgentError } from "@/lib/agent/errors"
import { MIN_KEY_LENGTH, secretsMatch } from "@/lib/agent/secret-compare"
import type { AgentIdentity } from "@/lib/agent/auth"
import {
  DEFAULT_PERMISSIONS,
  resolvePermissions,
  type AgentPermission,
} from "@/lib/agent/permissions"

/** Identity used when `NOTILAB_MCP_AGENT_ID` is not set. */
export const DEFAULT_MCP_AGENT_ID = "abacus-mcp"

interface ConfiguredMcpAgent extends AgentIdentity {
  key: string
}

/**
 * Reads the MCP credential from the environment.
 *
 * Read on every call rather than cached at module load: a cached value would
 * survive an env change until the next cold start, and it makes the behaviour
 * testable without module-registry games.
 *
 * Returns null — meaning "MCP is disabled here" — when the key is absent or too
 * short. There is no insecure fallback: a short key is refused with a server-log
 * error rather than quietly accepted.
 */
export function loadMcpAgent(): ConfiguredMcpAgent | null {
  const key = process.env.NOTILAB_MCP_API_KEY?.trim()
  if (!key) return null

  if (key.length < MIN_KEY_LENGTH) {
    // Named, never the key itself.
    console.error(
      `[mcp/auth] NOTILAB_MCP_API_KEY is shorter than ${MIN_KEY_LENGTH} characters — refusing it`,
    )
    return null
  }

  const id = process.env.NOTILAB_MCP_AGENT_ID?.trim() || DEFAULT_MCP_AGENT_ID

  let permissions: readonly AgentPermission[] = DEFAULT_PERMISSIONS
  const grantString = process.env.NOTILAB_MCP_PERMISSIONS?.trim()

  if (grantString) {
    const resolved = resolvePermissions(grantString)
    if (resolved.unknown.length > 0) {
      // Visible in the log rather than silently reducing what the agent can do,
      // which would look like a bug in the agent.
      console.error(
        `[mcp/auth] NOTILAB_MCP_PERMISSIONS contains unknown entries: ${resolved.unknown.join(", ")}`,
      )
    }
    permissions = resolved.permissions
  }

  return { id, label: id, key, permissions }
}

/** Whether this deployment exposes MCP at all. Safe to answer unauthenticated. */
export function isMcpConfigured(): boolean {
  return loadMcpAgent() !== null
}

/**
 * Pulls the presented key out of the request.
 *
 * `Authorization: Bearer` only. The Agent API additionally accepts
 * `X-Agent-Api-Key`, because some agent platforms cannot set an Authorization
 * header on a hand-built HTTP action — an MCP client is a first-class MCP
 * client and always can, so the extra surface buys nothing here.
 */
function extractPresentedKey(headers: Headers): string | null {
  const authorization = headers.get("authorization")
  if (!authorization) return null
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())
  return match ? match[1].trim() : null
}

/**
 * Resolves the caller's identity, or throws the AgentError the transport should
 * report. Never echoes the presented key, and never reveals whether a key was
 * absent or simply wrong in a way that helps enumeration beyond the two codes
 * the Agent API already uses.
 */
export function authenticateMcp(headers: Headers): AgentIdentity {
  const agent = loadMcpAgent()

  if (!agent) {
    throw new AgentError(
      "AGENT_API_DISABLED",
      "The NotiLab MCP server is not configured on this deployment.",
    )
  }

  const presented = extractPresentedKey(headers)
  if (!presented) {
    throw new AgentError(
      "UNAUTHENTICATED",
      "Missing credentials. Send Authorization: Bearer <NOTILAB_MCP_API_KEY>.",
    )
  }

  if (!secretsMatch(agent.key, presented)) {
    throw new AgentError("INVALID_API_KEY", "The provided API key is not valid.")
  }

  return { id: agent.id, label: agent.label, permissions: agent.permissions }
}
