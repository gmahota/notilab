/**
 * lib/agent/auth.ts — Machine authentication for the Agent Management API.
 *
 * Deliberately separate from lib/admin-auth.ts. That module authenticates a
 * *person* through a browser: a JWT in an httpOnly cookie, an 8-hour expiry, a
 * login form. None of that fits a server-to-server caller, and reusing it would
 * mean either handing an external agent a human's session or teaching the
 * cookie path to accept a bearer token — both make the human login surface
 * bigger, which is the opposite of the goal.
 *
 * So: a static API key per agent identity, held only in the environment, never
 * in the database and never sent to a client bundle. The key names an identity,
 * and the identity carries a permission set — see permissions.ts.
 *
 * The whole surface is opt-in. With no key configured the API answers
 * AGENT_API_DISABLED to every call, so a deploy that has not been given a
 * credential cannot be operated by anyone.
 */

import { AgentError } from "./errors"
import { MIN_KEY_LENGTH, secretsMatch } from "./secret-compare"
import {
  DEFAULT_PERMISSIONS,
  isAgentPermission,
  resolvePermissions,
  type AgentPermission,
} from "./permissions"

export interface AgentIdentity {
  /**
   * Stable name for this credential. Appears in every audit row, keys the rate
   * limiter and namespaces idempotency keys, so two credentials with different
   * ids are isolated from each other on all three.
   *
   * Always resolved by the server from the presented secret. Nothing a caller
   * sends can name it — see the note on `authenticateAgent`.
   */
  id: string
  /** Optional human label for logs and the capabilities document. */
  label: string
  permissions: readonly AgentPermission[]
  /**
   * Exempts this credential from the confirmation gate on critical actions
   * (see lib/agent/critical-actions.ts).
   *
   * Opt-out rather than opt-in, and absent means the gate applies: a client
   * configured by someone who never thought about confirmation gets the safe
   * behaviour. Set it only for an unattended internal pipeline whose operator
   * has accepted that it can publish and archive on a single call.
   */
  skipCriticalConfirmation?: boolean
}

interface ConfiguredAgent extends AgentIdentity {
  key: string
}

function parsePermissionValue(value: unknown): AgentPermission[] {
  if (typeof value === "string") return resolvePermissions(value).permissions
  if (Array.isArray(value)) {
    return value.filter((entry): entry is AgentPermission =>
      typeof entry === "string" && isAgentPermission(entry),
    )
  }
  return [...DEFAULT_PERMISSIONS]
}

/**
 * Reads the configured agents from the environment.
 *
 * Two forms, checked in order:
 *
 *   NOTILAB_AGENT_API_KEYS — JSON array, for more than one agent identity:
 *     [{"id":"editorial","key":"...","permissions":"editorial"},
 *      {"id":"seo","key":"...","permissions":["article.read","seo.update"]}]
 *
 *   NOTILAB_AGENT_API_KEY  — a single key, with optional
 *   NOTILAB_AGENT_ID and NOTILAB_AGENT_PERMISSIONS alongside it.
 *
 * Read on every call rather than cached at module load: a cached value would
 * survive an env change until the next cold start, and it makes the behaviour
 * testable without module-registry games.
 */
export function loadConfiguredAgents(): ConfiguredAgent[] {
  const multi = process.env.NOTILAB_AGENT_API_KEYS?.trim()

  if (multi) {
    let parsed: unknown
    try {
      parsed = JSON.parse(multi)
    } catch {
      console.error("[agent/auth] NOTILAB_AGENT_API_KEYS is not valid JSON — ignoring it")
      return []
    }

    if (!Array.isArray(parsed)) {
      console.error("[agent/auth] NOTILAB_AGENT_API_KEYS must be a JSON array — ignoring it")
      return []
    }

    const agents: ConfiguredAgent[] = []
    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) continue
      const record = entry as Record<string, unknown>
      const key = typeof record.key === "string" ? record.key : ""
      const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : "default"

      if (key.length < MIN_KEY_LENGTH) {
        // Named, but never the key itself.
        console.error(
          `[agent/auth] key for agent "${id}" is shorter than ${MIN_KEY_LENGTH} characters — ignoring it`,
        )
        continue
      }

      agents.push({
        id,
        label: typeof record.label === "string" ? record.label : id,
        key,
        permissions: parsePermissionValue(record.permissions),
      })
    }
    return agents
  }

  const single = process.env.NOTILAB_AGENT_API_KEY?.trim()
  if (!single) return []

  if (single.length < MIN_KEY_LENGTH) {
    console.error(
      `[agent/auth] NOTILAB_AGENT_API_KEY is shorter than ${MIN_KEY_LENGTH} characters — refusing it`,
    )
    return []
  }

  const grantString = process.env.NOTILAB_AGENT_PERMISSIONS?.trim()
  let permissions: readonly AgentPermission[] = DEFAULT_PERMISSIONS

  if (grantString) {
    const resolved = resolvePermissions(grantString)
    if (resolved.unknown.length > 0) {
      console.error(
        `[agent/auth] NOTILAB_AGENT_PERMISSIONS contains unknown entries: ${resolved.unknown.join(", ")}`,
      )
    }
    permissions = resolved.permissions
  }

  const id = process.env.NOTILAB_AGENT_ID?.trim() || "default"
  return [{ id, label: id, key: single, permissions }]
}

/** Pulls the presented key out of the request, without deciding whether it is valid. */
function extractPresentedKey(headers: Headers): string | null {
  const authorization = headers.get("authorization")
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())
    if (match) return match[1].trim()
  }

  // Accepted as a fallback because some agent platforms cannot set an
  // Authorization header on a custom action.
  const headerKey = headers.get("x-agent-api-key")
  if (headerKey && headerKey.trim()) return headerKey.trim()

  return null
}

/**
 * Resolves the caller's identity, or throws the AgentError the runner should
 * report. Never reveals which of the two failed — whether a key was absent or
 * simply wrong is information an attacker can use to enumerate.
 */
export function authenticateAgent(headers: Headers): AgentIdentity {
  const agents = loadConfiguredAgents()

  if (agents.length === 0) {
    throw new AgentError(
      "AGENT_API_DISABLED",
      "The Agent API is not configured on this deployment.",
    )
  }

  const presented = extractPresentedKey(headers)
  if (!presented) {
    throw new AgentError(
      "UNAUTHENTICATED",
      "Missing credentials. Send Authorization: Bearer <NOTILAB_AGENT_API_KEY>.",
    )
  }

  // Every candidate is compared, with no early exit, so the time taken does not
  // depend on which position in the list matched.
  let matched: ConfiguredAgent | null = null
  for (const agent of agents) {
    if (secretsMatch(agent.key, presented)) matched = agent
  }

  if (!matched) {
    throw new AgentError("INVALID_API_KEY", "The provided API key is not valid.")
  }

  return { id: matched.id, label: matched.label, permissions: matched.permissions }
}

/** Throws FORBIDDEN unless the identity holds every permission a tool requires. */
export function assertPermissions(
  identity: AgentIdentity,
  required: readonly AgentPermission[],
): void {
  const held = new Set<string>(identity.permissions)
  const missing = required.filter((permission) => !held.has(permission))

  if (missing.length > 0) {
    throw new AgentError(
      "FORBIDDEN",
      `This agent is not granted: ${missing.join(", ")}.`,
      { missing, granted: [...identity.permissions] },
    )
  }
}
