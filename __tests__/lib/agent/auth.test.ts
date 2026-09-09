/**
 * Authentication and authorisation for the Agent API.
 *
 * These are the cases where a mistake is silent in production: a deployment
 * with no key configured that answers 200, a permission list with a typo that
 * quietly grants everything, a comparison that leaks. Each one is pinned here.
 *
 * next/jest loads .env, so the agent variables can arrive already set from a
 * developer's machine. Every case clears them first rather than trusting the
 * ambient environment.
 */

import { assertPermissions, authenticateAgent, loadConfiguredAgents } from "@/lib/agent/auth"
import { AgentError } from "@/lib/agent/errors"
import { resolvePermissions } from "@/lib/agent/permissions"

const AGENT_VARS = [
  "NOTILAB_AGENT_API_KEY",
  "NOTILAB_AGENT_API_KEYS",
  "NOTILAB_AGENT_ID",
  "NOTILAB_AGENT_PERMISSIONS",
] as const

const env = process.env as Record<string, string | undefined>
const originalEnv = { ...process.env }

/** Long enough to satisfy the 32-character minimum. */
const VALID_KEY = "a".repeat(40)
const OTHER_KEY = "b".repeat(40)

beforeEach(() => {
  for (const key of AGENT_VARS) delete env[key]
  jest.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete env[key]
  }
  Object.assign(process.env, originalEnv)
})

function headers(init: Record<string, string> = {}): Headers {
  return new Headers(init)
}

describe("authenticateAgent", () => {
  it("refuses every call when no credential is configured", () => {
    // A deployment nobody has given a key to must not be operable, rather than
    // falling back to some default identity.
    expect(() => authenticateAgent(headers({ authorization: `Bearer ${VALID_KEY}` }))).toThrow(
      expect.objectContaining({ code: "AGENT_API_DISABLED" }),
    )
  })

  it("rejects a configured key that is too short to be safe", () => {
    env.NOTILAB_AGENT_API_KEY = "short-key"
    expect(loadConfiguredAgents()).toHaveLength(0)
    expect(() => authenticateAgent(headers({ authorization: "Bearer short-key" }))).toThrow(
      expect.objectContaining({ code: "AGENT_API_DISABLED" }),
    )
  })

  it("reports a missing credential distinctly from a wrong one", () => {
    env.NOTILAB_AGENT_API_KEY = VALID_KEY

    expect(() => authenticateAgent(headers())).toThrow(
      expect.objectContaining({ code: "UNAUTHENTICATED" }),
    )
    expect(() => authenticateAgent(headers({ authorization: `Bearer ${OTHER_KEY}` }))).toThrow(
      expect.objectContaining({ code: "INVALID_API_KEY" }),
    )
  })

  it("never echoes the presented key in the error", () => {
    env.NOTILAB_AGENT_API_KEY = VALID_KEY
    try {
      authenticateAgent(headers({ authorization: `Bearer ${OTHER_KEY}` }))
      throw new Error("expected a rejection")
    } catch (err) {
      expect((err as AgentError).message).not.toContain(OTHER_KEY)
      expect(JSON.stringify((err as AgentError).details ?? {})).not.toContain(OTHER_KEY)
    }
  })

  it("rejects a wrong key of the same length as the real one", () => {
    // The case the comparison exists for. Both operands are keyed-hashed to a
    // fixed 32 bytes before timingSafeEqual, so a same-length guess and a
    // wildly-wrong-length one take the same path — no throw, no length signal.
    env.NOTILAB_AGENT_API_KEY = VALID_KEY

    expect(() => authenticateAgent(headers({ authorization: `Bearer ${OTHER_KEY}` }))).toThrow(
      expect.objectContaining({ code: "INVALID_API_KEY" }),
    )
    expect(() => authenticateAgent(headers({ authorization: "Bearer x" }))).toThrow(
      expect.objectContaining({ code: "INVALID_API_KEY" }),
    )
    expect(() =>
      authenticateAgent(headers({ authorization: `Bearer ${"a".repeat(4000)}` })),
    ).toThrow(expect.objectContaining({ code: "INVALID_API_KEY" }))
  })

  it("accepts a key differing from another agent's only in the last character", () => {
    // Guards against any comparison that stops early: two keys sharing a long
    // prefix must still resolve to their own identities.
    const shared = "c".repeat(39)
    env.NOTILAB_AGENT_API_KEYS = JSON.stringify([
      { id: "first", key: `${shared}1`, permissions: "readonly" },
      { id: "second", key: `${shared}2`, permissions: "readonly" },
    ])

    expect(authenticateAgent(headers({ authorization: `Bearer ${shared}1` })).id).toBe("first")
    expect(authenticateAgent(headers({ authorization: `Bearer ${shared}2` })).id).toBe("second")
    expect(() => authenticateAgent(headers({ authorization: `Bearer ${shared}3` }))).toThrow(
      expect.objectContaining({ code: "INVALID_API_KEY" }),
    )
  })

  it("carries the critical-confirmation exemption through, and only when asked", () => {
    // The MCP roster spells this the same way. An exemption honoured on one
    // transport and ignored on the other would be a reason to move an
    // integration to the laxer door.
    env.NOTILAB_AGENT_API_KEYS = JSON.stringify([
      { id: "gated", key: VALID_KEY, permissions: "editorial" },
      {
        id: "exempt",
        key: OTHER_KEY,
        permissions: "editorial",
        skipCriticalConfirmation: true,
      },
    ])

    expect(
      authenticateAgent(headers({ authorization: `Bearer ${VALID_KEY}` })).skipCriticalConfirmation,
    ).toBeUndefined()
    expect(
      authenticateAgent(headers({ authorization: `Bearer ${OTHER_KEY}` })).skipCriticalConfirmation,
    ).toBe(true)
  })

  it("does not accept a truthy-but-not-true exemption", () => {
    // Opt-out of a safety gate takes the literal boolean, so a stray "false"
    // string or a 1 from a config generator cannot switch it on.
    env.NOTILAB_AGENT_API_KEYS = JSON.stringify([
      { id: "sloppy", key: VALID_KEY, permissions: "editorial", skipCriticalConfirmation: "false" },
    ])

    expect(
      authenticateAgent(headers({ authorization: `Bearer ${VALID_KEY}` })).skipCriticalConfirmation,
    ).toBeUndefined()
  })

  it("accepts a valid key over Authorization or X-Agent-Api-Key", () => {
    env.NOTILAB_AGENT_API_KEY = VALID_KEY
    env.NOTILAB_AGENT_ID = "abacus"

    expect(authenticateAgent(headers({ authorization: `Bearer ${VALID_KEY}` })).id).toBe("abacus")
    expect(authenticateAgent(headers({ "x-agent-api-key": VALID_KEY })).id).toBe("abacus")
  })

  it("defaults to read-only when no permissions are configured", () => {
    // The important direction: a forgotten env var must under-grant, never
    // over-grant.
    env.NOTILAB_AGENT_API_KEY = VALID_KEY

    const identity = authenticateAgent(headers({ authorization: `Bearer ${VALID_KEY}` }))
    expect([...identity.permissions].sort()).toEqual(["article.read", "taxonomy.read"])
  })

  it("resolves a preset name into its permission set", () => {
    env.NOTILAB_AGENT_API_KEY = VALID_KEY
    env.NOTILAB_AGENT_PERMISSIONS = "seo"

    const identity = authenticateAgent(headers({ authorization: `Bearer ${VALID_KEY}` }))
    expect(identity.permissions).toContain("seo.update")
    expect(identity.permissions).not.toContain("article.publish")
  })

  it("supports several agents with different grants under one deployment", () => {
    env.NOTILAB_AGENT_API_KEYS = JSON.stringify([
      { id: "editorial", key: VALID_KEY, permissions: "editorial" },
      { id: "seo-bot", key: OTHER_KEY, permissions: ["article.read", "seo.update"] },
    ])

    const editorial = authenticateAgent(headers({ authorization: `Bearer ${VALID_KEY}` }))
    const seo = authenticateAgent(headers({ authorization: `Bearer ${OTHER_KEY}` }))

    expect(editorial.id).toBe("editorial")
    expect(editorial.permissions).toContain("article.publish")
    expect(seo.id).toBe("seo-bot")
    expect(seo.permissions).not.toContain("article.publish")
  })

  it("ignores a malformed NOTILAB_AGENT_API_KEYS instead of failing open", () => {
    env.NOTILAB_AGENT_API_KEYS = "{not json"
    expect(loadConfiguredAgents()).toHaveLength(0)
  })
})

describe("assertPermissions", () => {
  const identity = {
    id: "seo-bot",
    label: "seo-bot",
    permissions: ["article.read", "seo.update"] as const,
  }

  it("allows a call whose permissions are all held", () => {
    expect(() => assertPermissions(identity, ["article.read"])).not.toThrow()
  })

  it("refuses a call and names what is missing", () => {
    try {
      assertPermissions(identity, ["article.publish"])
      throw new Error("expected a rejection")
    } catch (err) {
      const agentError = err as AgentError
      expect(agentError.code).toBe("FORBIDDEN")
      expect(agentError.details?.missing).toEqual(["article.publish"])
    }
  })
})

describe("resolvePermissions", () => {
  it("separates unknown entries instead of silently dropping them", () => {
    // A typo must be visible in the log. Swallowing it looks like an agent bug.
    const resolved = resolvePermissions("article.read, article.pubish")
    expect(resolved.permissions).toEqual(["article.read"])
    expect(resolved.unknown).toEqual(["article.pubish"])
  })

  it("mixes presets and individual permissions without duplicating", () => {
    const resolved = resolvePermissions("readonly, article.read, seo.update")
    expect(resolved.unknown).toHaveLength(0)
    expect([...resolved.permissions].sort()).toEqual([
      "article.read",
      "seo.update",
      "taxonomy.read",
    ])
  })
})
