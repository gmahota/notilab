/**
 * lib/mcp/auth.ts — Who is on the other end of /api/mcp.
 *
 * One endpoint, several clients. Abacus.ai, ChatGPT and any future internal
 * agent all POST to the same URL and run the same tools; what separates them is
 * the credential they present, and everything downstream keys off the identity
 * this module resolves from it:
 *
 *   - the rate limiter counts per `identity.id`, so a looping ChatGPT session
 *     cannot exhaust Abacus's budget;
 *   - idempotency keys are namespaced by `identity.id`, so two clients retrying
 *     "create-brief-01" do not collide;
 *   - every audit row is written as `agent:<identity.id>` with
 *     `details.transport = "mcp"`, so "who published this?" has one answer;
 *   - `tools/list` is narrowed to that client's permissions.
 *
 * The identity is resolved from the secret and **only** from the secret. There
 * is no header, argument or `clientInfo` field that names it — a client that
 * claims to be Abacus is not believed, it is authenticated. That is the property
 * that makes the per-client audit trail worth anything.
 *
 * Still separate from `NOTILAB_AGENT_API_KEY`, and still not a fallback to it: a
 * deployment with an Agent API key but no MCP configuration exposes no MCP.
 *
 * What is *not* separate: permissions. They resolve through the same
 * `lib/agent/permissions.ts` catalogue and presets as every other transport, so
 * there is one vocabulary of what an agent may do and one place to widen it.
 */

import { AgentError } from "@/lib/agent/errors"
import { MIN_KEY_LENGTH, secretsMatch } from "@/lib/agent/secret-compare"
import type { AgentIdentity } from "@/lib/agent/auth"
import {
  DEFAULT_PERMISSIONS,
  isAgentPermission,
  resolvePermissions,
  type AgentPermission,
} from "@/lib/agent/permissions"

/** Identity used when the legacy single-key variables name none. */
export const DEFAULT_MCP_AGENT_ID = "abacus-mcp"

/** A resolved client, with its secret. Never leaves this module. */
interface ConfiguredMcpClient extends AgentIdentity {
  key: string
}

/**
 * A client as an operator writes it in the environment.
 *
 * `id` comes from the object key in the preferred form, so it is not repeated
 * inside the entry; in the array form it is a field. Both are accepted because
 * `NOTILAB_AGENT_API_KEYS` already uses the array shape and an operator who
 * knows one should not be surprised by the other.
 */
interface RawClientEntry {
  /** Either spelling. `apiKey` reads better; `key` matches NOTILAB_AGENT_API_KEYS. */
  apiKey?: unknown
  key?: unknown
  permissions?: unknown
  label?: unknown
  /** Revokes the client without deleting its configuration. */
  disabled?: unknown
  /** Opt-out of the confirmation gate on critical actions. Deliberately explicit. */
  skipCriticalConfirmation?: unknown
  /** Only meaningful in the array form; the object form takes the key. */
  id?: unknown
}

function parsePermissionValue(value: unknown, clientId: string): readonly AgentPermission[] {
  if (typeof value === "string") {
    const resolved = resolvePermissions(value)
    if (resolved.unknown.length > 0) {
      // Visible in the log rather than silently reducing what the client can
      // do, which would look like a bug in the client.
      console.error(
        `[mcp/auth] client "${clientId}" has unknown permission entries: ${resolved.unknown.join(", ")}`,
      )
    }
    return resolved.permissions
  }

  if (Array.isArray(value)) {
    return value.filter((entry): entry is AgentPermission =>
      typeof entry === "string" && isAgentPermission(entry),
    )
  }

  // Absent means read-only, never more. A client an operator forgot to grant
  // anything to should be able to look, and nothing else.
  return DEFAULT_PERMISSIONS
}

/**
 * Turns one raw entry into a client, or null with a logged reason.
 *
 * Every rejection names the client id and never the key — an operator debugging
 * a 401 needs to know *which* client is misconfigured, and a log line is not a
 * safe place for a secret.
 */
function toClient(id: string, entry: RawClientEntry): ConfiguredMcpClient | null {
  if (entry.disabled === true) {
    // Not an error: this is how a client is revoked without losing its config.
    return null
  }

  const rawKey = typeof entry.apiKey === "string" ? entry.apiKey : entry.key
  const key = typeof rawKey === "string" ? rawKey.trim() : ""

  if (key.length === 0) {
    console.error(`[mcp/auth] client "${id}" has no apiKey — ignoring it`)
    return null
  }

  if (key.length < MIN_KEY_LENGTH) {
    console.error(
      `[mcp/auth] apiKey for client "${id}" is shorter than ${MIN_KEY_LENGTH} characters — refusing it`,
    )
    return null
  }

  return {
    id,
    label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : id,
    key,
    permissions: parsePermissionValue(entry.permissions, id),
    ...(entry.skipCriticalConfirmation === true ? { skipCriticalConfirmation: true } : {}),
  }
}

/**
 * Parses `NOTILAB_MCP_CLIENTS_JSON`.
 *
 * Preferred shape — an object keyed by client id, which is the one that reads
 * like a roster:
 *
 *   {"abacus":  {"apiKey":"…","permissions":"editorial"},
 *    "chatgpt": {"apiKey":"…","permissions":"readonly"}}
 *
 * Also accepted — an array, matching `NOTILAB_AGENT_API_KEYS`:
 *
 *   [{"id":"abacus","apiKey":"…","permissions":"editorial"}]
 *
 * A malformed value yields no clients rather than a partial roster with a
 * surprising member. Bad JSON here is an operator error worth failing loudly on.
 */
function parseClientsJson(raw: string): ConfiguredMcpClient[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error("[mcp/auth] NOTILAB_MCP_CLIENTS_JSON is not valid JSON — ignoring it")
    return []
  }

  const entries: Array<[string, RawClientEntry]> = []

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue
      const entry = item as RawClientEntry
      const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : ""
      if (!id) {
        console.error("[mcp/auth] NOTILAB_MCP_CLIENTS_JSON array entry has no id — ignoring it")
        continue
      }
      entries.push([id, entry])
    }
  } else if (typeof parsed === "object" && parsed !== null) {
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) {
        console.error(`[mcp/auth] client "${id}" is not an object — ignoring it`)
        continue
      }
      entries.push([id.trim(), value as RawClientEntry])
    }
  } else {
    console.error(
      "[mcp/auth] NOTILAB_MCP_CLIENTS_JSON must be a JSON object or array — ignoring it",
    )
    return []
  }

  const clients: ConfiguredMcpClient[] = []
  for (const [id, entry] of entries) {
    if (!id) {
      console.error("[mcp/auth] a client id is empty — ignoring that entry")
      continue
    }
    const client = toClient(id, entry)
    if (client) clients.push(client)
  }
  return clients
}

/**
 * The legacy single-client variables, still honoured.
 *
 * They stay because a deployment configured before multi-client existed must
 * keep working across the deploy that introduces it — an MCP integration that
 * goes dark on a Tuesday afternoon because a variable was renamed is exactly the
 * kind of change AGENTS.md calls avoidable. `NOTILAB_MCP_CLIENTS_JSON` is the
 * form to write new configuration in; this one is the migration path.
 */
function loadLegacyClient(): ConfiguredMcpClient | null {
  const key = process.env.NOTILAB_MCP_API_KEY?.trim()
  if (!key) return null

  return toClient(process.env.NOTILAB_MCP_AGENT_ID?.trim() || DEFAULT_MCP_AGENT_ID, {
    apiKey: key,
    permissions: process.env.NOTILAB_MCP_PERMISSIONS?.trim(),
  })
}

/**
 * Every client this deployment will authenticate.
 *
 * Read on every call rather than cached at module load: a cached roster would
 * survive an env change until the next cold start — which is the opposite of
 * what an operator revoking a client expects — and it makes the behaviour
 * testable without module-registry games.
 *
 * Two roster-level integrity rules, both enforced by dropping rather than by
 * guessing:
 *
 *   - **A duplicate id is refused.** Two clients answering to the same name
 *     would share a rate-limit bucket and an audit identity, which is precisely
 *     the isolation this module exists to provide.
 *   - **A shared key is refused, for every client holding it.** If two clients
 *     were configured with the same secret, no request could be attributed to
 *     either of them, and the answer to "who published this?" would be a guess.
 *     Both are dropped rather than one silently winning — a copy-paste mistake
 *     in the roster must fail visibly, not resolve to whichever entry happens
 *     to be first.
 */
export function loadMcpClients(): ConfiguredMcpClient[] {
  const fromJson = process.env.NOTILAB_MCP_CLIENTS_JSON?.trim()
  const candidates = fromJson ? parseClientsJson(fromJson) : []

  const legacy = loadLegacyClient()
  if (legacy) candidates.push(legacy)

  const byId = new Map<string, ConfiguredMcpClient>()
  for (const client of candidates) {
    if (byId.has(client.id)) {
      console.error(`[mcp/auth] duplicate client id "${client.id}" — keeping only the first`)
      continue
    }
    byId.set(client.id, client)
  }

  const keyCounts = new Map<string, number>()
  for (const client of byId.values()) {
    keyCounts.set(client.key, (keyCounts.get(client.key) ?? 0) + 1)
  }

  const clients: ConfiguredMcpClient[] = []
  for (const client of byId.values()) {
    if ((keyCounts.get(client.key) ?? 0) > 1) {
      console.error(
        `[mcp/auth] client "${client.id}" shares its apiKey with another client — ` +
          "refusing both, because a request could not be attributed to either",
      )
      continue
    }
    clients.push(client)
  }

  return clients
}

/** Whether this deployment exposes MCP at all. Safe to answer unauthenticated. */
export function isMcpConfigured(): boolean {
  return loadMcpClients().length > 0
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
 * Resolves the calling client's identity, or throws the AgentError the transport
 * should report.
 *
 * The returned identity is derived entirely from the presented secret. Nothing
 * in the request — no header, no `clientInfo.name`, no tool argument — can
 * influence which client the server believes it is talking to.
 *
 * Never echoes the presented key, and never says which of "absent" and "wrong"
 * a failure was beyond the two codes the Agent API already uses.
 */
export function authenticateMcp(headers: Headers): AgentIdentity {
  const clients = loadMcpClients()

  if (clients.length === 0) {
    throw new AgentError(
      "AGENT_API_DISABLED",
      "The NotiLab MCP server is not configured on this deployment.",
    )
  }

  const presented = extractPresentedKey(headers)
  if (!presented) {
    throw new AgentError(
      "UNAUTHENTICATED",
      "Missing credentials. Send Authorization: Bearer <your NotiLab MCP API key>.",
    )
  }

  // Every candidate is compared, with no early exit, so the time taken does not
  // depend on which position in the roster matched — otherwise a caller could
  // learn how many clients are configured, and roughly where theirs sits.
  let matched: ConfiguredMcpClient | null = null
  for (const client of clients) {
    if (secretsMatch(client.key, presented)) matched = client
  }

  if (!matched) {
    throw new AgentError("INVALID_API_KEY", "The provided API key is not valid.")
  }

  return {
    id: matched.id,
    label: matched.label,
    permissions: matched.permissions,
    ...(matched.skipCriticalConfirmation ? { skipCriticalConfirmation: true } : {}),
  }
}
