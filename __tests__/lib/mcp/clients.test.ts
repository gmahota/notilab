/**
 * Several MCP clients, one endpoint.
 *
 * The properties under test are the ones that make a shared endpoint safe to
 * hand to more than one agent platform:
 *
 *   - a client is *identified by its secret*, never by anything it says about
 *     itself, so a request cannot be attributed to a client that did not make it;
 *   - permissions are per client, enforced in the shared pipeline rather than in
 *     the transport, so `readonly` means the same thing on every door;
 *   - the audit trail, the rate limiter and idempotency keys are all isolated
 *     per client;
 *   - the four critical actions are gated for every client that has not been
 *     explicitly exempted.
 *
 * Driven through the real route handler and the real pipeline; only Prisma is
 * mocked. Nothing here reaches a database, and no article is published.
 */

import { NextRequest } from "next/server"
import { POST } from "@/app/api/mcp/route"
import { GET as HEALTH } from "@/app/api/mcp/health/route"
import { loadMcpClients } from "@/lib/mcp/auth"
import { resetRateLimits } from "@/lib/agent/rate-limit"
import { CRITICAL_ACTION_TOOLS } from "@/lib/agent/critical-actions"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    news: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    category: { findUnique: jest.fn(), findMany: jest.fn() },
    adminAction: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

const news = prisma.news as unknown as Record<string, jest.Mock>
const adminAction = prisma.adminAction as unknown as Record<string, jest.Mock>

/** Distinct 40-character keys — comfortably over the 32-character floor. */
const ABACUS_KEY = "a".repeat(40)
const CHATGPT_KEY = "c".repeat(40)
const RETIRED_KEY = "r".repeat(40)

const env = process.env as Record<string, string | undefined>
const originalEnv = { ...process.env }

let nextRpcId = 0

function rpc(method: string, params?: unknown) {
  return { jsonrpc: "2.0", id: ++nextRpcId, method, params }
}

function request(body: unknown, key: string | null): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  }
  if (key) headers.authorization = `Bearer ${key}`

  return new NextRequest("http://localhost/api/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

async function post(body: unknown, key: string | null) {
  const response = await POST(request(body, key))
  const text = await response.text()
  return { status: response.status, raw: text, body: text ? JSON.parse(text) : null }
}

async function callTool(key: string | null, name: string, args: unknown, meta?: unknown) {
  const params: Record<string, unknown> = { name, arguments: args }
  if (meta) params._meta = meta
  const result = await post(rpc("tools/call", params), key)
  return result.body.result as {
    isError?: boolean
    structuredContent: Record<string, unknown>
    content: Array<{ text: string }>
  }
}

async function toolNames(key: string): Promise<string[]> {
  const result = await post(rpc("tools/list"), key)
  return (result.body.result.tools as Array<{ name: string }>).map((tool) => tool.name).sort()
}

/** The editorial audit rows, excluding the idempotency bookkeeping rows. */
function auditRows(): Array<Record<string, unknown>> {
  return adminAction.create.mock.calls
    .map((call) => call[0].data as Record<string, unknown>)
    .filter((data) => data.resource !== "AGENT_IDEMPOTENCY")
}

function idempotencyRows(): Array<Record<string, unknown>> {
  return adminAction.create.mock.calls
    .map((call) => call[0].data as Record<string, unknown>)
    .filter((data) => data.resource === "AGENT_IDEMPOTENCY")
}

function errorOf(result: { structuredContent: Record<string, unknown> }) {
  return result.structuredContent.error as {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

function mutationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "article-1",
    status: "APPROVED",
    title: "Título original",
    slug: "titulo-original",
    summary: "Resumo",
    content: "Corpo do artigo com texto suficiente.",
    imageUrl: null,
    categoryId: "cat-1",
    tags: ["economia"],
    priority: "NORMAL",
    readTime: 3,
    publishedAt: new Date("2026-08-01T10:00:00Z"),
    ...overrides,
  }
}

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    ...mutationRow(overrides),
    sourceUrl: "https://example.test/story",
    sourceName: "Example",
    trending: false,
    createdAt: new Date("2026-08-01T09:00:00Z"),
    updatedAt: new Date("2026-08-01T09:30:00Z"),
    rankingScore: 0,
    importanceScore: 0,
    authorId: null,
    category: { id: "cat-1", name: "Economia", slug: "economia", color: "#000" },
    aiSummary: null,
    sentiment: null,
    articleAI: null,
    _count: { reactions: 0, readHistory: 0, savedBy: 0 },
  }
}

/**
 * The roster the tests run against: Abacus with full editorial rights, ChatGPT
 * read-only, and a third client left disabled to prove revocation.
 */
function roster(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    abacus: { apiKey: ABACUS_KEY, permissions: "editorial", label: "Abacus.ai" },
    chatgpt: { apiKey: CHATGPT_KEY, permissions: "readonly", label: "ChatGPT" },
    retired: { apiKey: RETIRED_KEY, permissions: "editorial", disabled: true },
    ...overrides,
  })
}

beforeEach(() => {
  resetRateLimits()
  nextRpcId = 0
  for (const key of [
    "NOTILAB_MCP_API_KEY",
    "NOTILAB_MCP_AGENT_ID",
    "NOTILAB_MCP_PERMISSIONS",
    "NOTILAB_AGENT_RATE_LIMIT",
  ]) {
    delete env[key]
  }
  env.NOTILAB_MCP_CLIENTS_JSON = roster()
  adminAction.create.mockResolvedValue({ id: "audit-1" })
  adminAction.findFirst.mockResolvedValue(null)
})

afterEach(() => {
  jest.restoreAllMocks()
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete env[key]
  }
  Object.assign(process.env, originalEnv)
})

// ── Authentication ──────────────────────────────────────────────────────────

describe("multi-client authentication", () => {
  it("accepts the Abacus token", async () => {
    const result = await post(rpc("ping"), ABACUS_KEY)
    expect(result.status).toBe(200)
    expect(result.body.result).toEqual({})
  })

  it("accepts the ChatGPT token", async () => {
    const result = await post(rpc("ping"), CHATGPT_KEY)
    expect(result.status).toBe(200)
    expect(result.body.result).toEqual({})
  })

  it("refuses an invalid token", async () => {
    const result = await post(rpc("tools/list"), "z".repeat(40))

    expect(result.status).toBe(401)
    expect(result.body.error.message).toContain("INVALID_API_KEY")
    expect(news.findMany).not.toHaveBeenCalled()
  })

  it("refuses a missing token, before reading the body", async () => {
    const result = await post(rpc("tools/list"), null)

    expect(result.status).toBe(401)
    expect(result.body.error.message).toContain("UNAUTHENTICATED")
    expect(news.findMany).not.toHaveBeenCalled()
  })

  it("refuses a revoked client, whose key is still in the roster", async () => {
    // `disabled: true` is how a client is turned off without losing its config.
    const result = await post(rpc("tools/list"), RETIRED_KEY)

    expect(result.status).toBe(401)
    expect(result.body.error.message).toContain("INVALID_API_KEY")
  })

  it("is disabled entirely when no client is configured", async () => {
    delete env.NOTILAB_MCP_CLIENTS_JSON

    const result = await post(rpc("tools/list"), ABACUS_KEY)

    expect(result.status).toBe(503)
    expect(result.body.error.message).toContain("AGENT_API_DISABLED")
  })

  it("does not fall back to the Agent API credential", async () => {
    delete env.NOTILAB_MCP_CLIENTS_JSON
    env.NOTILAB_AGENT_API_KEY = "g".repeat(40)

    const result = await post(rpc("tools/list"), "g".repeat(40))

    expect(result.status).toBe(503)
  })

  it("still honours the single-key variables, so an existing deploy keeps working", async () => {
    delete env.NOTILAB_MCP_CLIENTS_JSON
    env.NOTILAB_MCP_API_KEY = ABACUS_KEY
    env.NOTILAB_MCP_AGENT_ID = "abacus-mcp"
    env.NOTILAB_MCP_PERMISSIONS = "editorial"

    expect(await toolNames(ABACUS_KEY)).toHaveLength(15)
  })

  it("runs the roster and the legacy key side by side during a migration", async () => {
    env.NOTILAB_MCP_API_KEY = "l".repeat(40)
    env.NOTILAB_MCP_AGENT_ID = "legacy"
    env.NOTILAB_MCP_PERMISSIONS = "readonly"

    expect((await post(rpc("ping"), ABACUS_KEY)).status).toBe(200)
    expect((await post(rpc("ping"), "l".repeat(40))).status).toBe(200)
    expect(loadMcpClients().map((client) => client.id).sort()).toEqual([
      "abacus",
      "chatgpt",
      "legacy",
    ])
  })

  it("never echoes or logs any client key, on success or refusal", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {})
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
    news.findMany.mockResolvedValue([])
    news.count.mockResolvedValue(0)

    const ok = await post(rpc("tools/list"), ABACUS_KEY)
    const refused = await post(rpc("tools/list"), "z".repeat(40))

    const logged = [...error.mock.calls, ...warn.mock.calls].flat().map(String).join(" ")
    for (const secret of [ABACUS_KEY, CHATGPT_KEY, RETIRED_KEY, "z".repeat(40)]) {
      expect(ok.raw).not.toContain(secret)
      expect(refused.raw).not.toContain(secret)
      expect(logged).not.toContain(secret)
    }
  })
})

// ── Roster integrity ────────────────────────────────────────────────────────

describe("roster integrity", () => {
  it("refuses a client whose key is under the 32-character floor", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {})
    env.NOTILAB_MCP_CLIENTS_JSON = JSON.stringify({
      weak: { apiKey: "hunter2", permissions: "editorial" },
      abacus: { apiKey: ABACUS_KEY, permissions: "editorial" },
    })

    expect(loadMcpClients().map((client) => client.id)).toEqual(["abacus"])
    // The client is named so an operator can find it; the key never is.
    expect(String(spy.mock.calls.flat())).toContain("weak")
    expect(String(spy.mock.calls.flat())).not.toContain("hunter2")
  })

  it("refuses both clients when two share a key, rather than picking one", async () => {
    // Attribution is the whole point of separate credentials. If two clients
    // presented the same secret, no audit row could name the caller honestly.
    const spy = jest.spyOn(console, "error").mockImplementation(() => {})
    env.NOTILAB_MCP_CLIENTS_JSON = JSON.stringify({
      abacus: { apiKey: ABACUS_KEY, permissions: "editorial" },
      chatgpt: { apiKey: ABACUS_KEY, permissions: "readonly" },
    })

    expect(loadMcpClients()).toEqual([])
    expect((await post(rpc("ping"), ABACUS_KEY)).status).toBe(503)
    expect(String(spy.mock.calls.flat())).toContain("shares its apiKey")
  })

  it("ignores a malformed roster instead of authenticating a partial one", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {})
    env.NOTILAB_MCP_CLIENTS_JSON = "{not json"

    expect(loadMcpClients()).toEqual([])
  })

  it("grants readonly, never more, to a client with no permissions field", async () => {
    env.NOTILAB_MCP_CLIENTS_JSON = JSON.stringify({
      forgotten: { apiKey: ABACUS_KEY },
    })

    expect(await toolNames(ABACUS_KEY)).toEqual([
      "get_article",
      "list_categories",
      "search_articles",
    ])
  })

  it("accepts the array form as well as the object form", async () => {
    env.NOTILAB_MCP_CLIENTS_JSON = JSON.stringify([
      { id: "abacus", key: ABACUS_KEY, permissions: "editorial" },
    ])

    expect(loadMcpClients().map((client) => client.id)).toEqual(["abacus"])
    expect(await toolNames(ABACUS_KEY)).toHaveLength(15)
  })
})

// ── Permissions ─────────────────────────────────────────────────────────────

describe("per-client permissions", () => {
  it("shows a readonly client three tools and an editorial client fifteen", async () => {
    expect(await toolNames(CHATGPT_KEY)).toEqual([
      "get_article",
      "list_categories",
      "search_articles",
    ])
    expect(await toolNames(ABACUS_KEY)).toHaveLength(15)
  })

  it.each(["search_articles", "get_article", "list_categories"])(
    "lets a readonly client call %s",
    async (tool) => {
      news.findMany.mockResolvedValue([])
      news.count.mockResolvedValue(0)
      news.findFirst.mockResolvedValue(detailRow())
      ;(prisma.category as unknown as Record<string, jest.Mock>).findMany.mockResolvedValue([])

      const result = await callTool(CHATGPT_KEY, tool, tool === "get_article" ? { id: "a" } : {})

      expect(result.isError).toBeUndefined()
    },
  )

  it.each(["update_article", "publish_article"])(
    "refuses a readonly client on %s",
    async (tool) => {
      const result = await callTool(CHATGPT_KEY, tool, { id: "article-1", title: "Novo título" })

      expect(result.isError).toBe(true)
      expect(errorOf(result).code).toBe("FORBIDDEN")
      expect(news.update).not.toHaveBeenCalled()
    },
  )

  it("lets an editorial client reach an editorial tool", async () => {
    news.findUnique.mockResolvedValue(mutationRow())
    news.findFirst.mockResolvedValue(detailRow({ title: "Título novo" }))
    news.update.mockResolvedValue({})

    const result = await callTool(ABACUS_KEY, "update_article", {
      id: "article-1",
      title: "Título novo",
    })

    expect(result.isError).toBeUndefined()
    expect(result.structuredContent.changed).toEqual(["title"])
  })
})

// ── Isolation ───────────────────────────────────────────────────────────────

describe("client isolation", () => {
  it("attributes a write to the client that made it", async () => {
    news.findUnique.mockResolvedValue(mutationRow())
    news.findFirst.mockResolvedValue(detailRow({ title: "Título novo" }))
    news.update.mockResolvedValue({})

    await callTool(ABACUS_KEY, "update_article", { id: "article-1", title: "Título novo" })

    const [row] = auditRows()
    const details = row.details as Record<string, unknown>
    expect(row.userId).toBe("agent:abacus")
    expect(details.agentId).toBe("abacus")
    expect(details.transport).toBe("mcp")
  })

  it("attributes a refused write to the client that attempted it", async () => {
    await callTool(CHATGPT_KEY, "publish_article", { id: "article-1" })

    const [row] = auditRows()
    const details = row.details as Record<string, unknown>
    expect(row.userId).toBe("agent:chatgpt")
    expect(details.agentId).toBe("chatgpt")
    expect(details.errorCode).toBe("FORBIDDEN")
  })

  it("keeps two clients in separate audit identities within one run", async () => {
    news.findUnique.mockResolvedValue(mutationRow())
    news.findFirst.mockResolvedValue(detailRow({ title: "Título novo" }))
    news.update.mockResolvedValue({})

    await callTool(ABACUS_KEY, "update_article", { id: "article-1", title: "Título novo" })
    await callTool(CHATGPT_KEY, "publish_article", { id: "article-1" })

    expect(auditRows().map((row) => row.userId)).toEqual(["agent:abacus", "agent:chatgpt"])
  })

  it("cannot be talked into another client's identity by the request", async () => {
    // clientInfo is the only place an MCP client names itself, and it is
    // advisory. The server resolves identity from the secret alone.
    news.findUnique.mockResolvedValue(mutationRow())
    news.findFirst.mockResolvedValue(detailRow({ title: "Título novo" }))
    news.update.mockResolvedValue({})

    await POST(
      request(
        {
          jsonrpc: "2.0",
          id: 99,
          method: "tools/call",
          params: {
            name: "update_article",
            arguments: { id: "article-1", title: "Título novo" },
            _meta: { "notilab/agentId": "abacus", clientInfo: { name: "abacus" } },
          },
        },
        CHATGPT_KEY,
      ),
    )

    // Still refused as ChatGPT, still audited as ChatGPT.
    const [row] = auditRows()
    expect(row.userId).toBe("agent:chatgpt")
    expect((row.details as Record<string, unknown>).errorCode).toBe("FORBIDDEN")
  })

  it("gives each client its own rate-limit budget", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {})
    env.NOTILAB_AGENT_RATE_LIMIT = "2"
    news.findFirst.mockResolvedValue(detailRow())

    await callTool(ABACUS_KEY, "get_article", { id: "article-1" })
    await callTool(ABACUS_KEY, "get_article", { id: "article-1" })
    const abacusBlocked = await callTool(ABACUS_KEY, "get_article", { id: "article-1" })

    // Abacus exhausted its own window; ChatGPT is untouched.
    expect(errorOf(abacusBlocked).code).toBe("RATE_LIMITED")
    const chatgpt = await callTool(CHATGPT_KEY, "get_article", { id: "article-1" })
    expect(chatgpt.isError).toBeUndefined()
  })

  it("namespaces idempotency keys per client, so the same key does not collide", async () => {
    env.NOTILAB_MCP_CLIENTS_JSON = roster({
      chatgpt: { apiKey: CHATGPT_KEY, permissions: "editorial" },
    })
    ;(prisma.category as unknown as Record<string, jest.Mock>).findUnique.mockResolvedValue({
      id: "cat-1",
    })
    news.create.mockResolvedValue({ id: "new-1" })
    news.findFirst.mockResolvedValue(detailRow({ id: "new-1", status: "DRAFT" }))

    const args = {
      title: "Peça nova",
      content: "Corpo do artigo com texto suficiente para passar a validação.",
      categorySlug: "economia",
    }
    const meta = { "notilab/idempotencyKey": "brief-01" }

    await callTool(ABACUS_KEY, "create_article", args, meta)
    await callTool(CHATGPT_KEY, "create_article", args, meta)

    const claims = idempotencyRows()
    expect(claims).toHaveLength(2)
    // Same literal key, different clients — different storage rows, so neither
    // client can replay or block the other's call.
    expect(claims[0].resourceId).not.toBe(claims[1].resourceId)
    expect(claims[0].userId).toBe("agent:abacus")
    expect(claims[1].userId).toBe("agent:chatgpt")
  })
})

// ── Critical actions ────────────────────────────────────────────────────────

describe("the confirmation gate on critical actions", () => {
  /** Runs a critical tool twice: once to be refused, once with the token. */
  async function confirmAndRun(tool: string, args: Record<string, unknown>) {
    const refused = await callTool(ABACUS_KEY, tool, args)
    const token = (
      errorOf(refused).details?.confirmation as { confirmationToken: string } | undefined
    )?.confirmationToken
    const confirmed = token
      ? await callTool(ABACUS_KEY, tool, args, { "notilab/confirmationToken": token })
      : null
    return { refused, token, confirmed }
  }

  it.each([...CRITICAL_ACTION_TOOLS])("halts %s on the first call", async (tool) => {
    news.findUnique.mockResolvedValue(mutationRow({ status: "PENDING_REVIEW" }))

    const result = await callTool(ABACUS_KEY, tool, { id: "article-1" })

    expect(result.isError).toBe(true)
    expect(errorOf(result).code).toBe("CONFIRMATION_REQUIRED")
    // Nothing happened: the gate sits in front of the business layer.
    expect(news.update).not.toHaveBeenCalled()
  })

  it("hands back a token and the route to use it", async () => {
    news.findUnique.mockResolvedValue(mutationRow())

    const result = await callTool(ABACUS_KEY, "publish_article", { id: "article-1" })
    const details = errorOf(result).details!

    const confirmation = details.confirmation as Record<string, string>
    expect(confirmation.reason).toBe("critical_action")
    expect(confirmation.summary).toContain("visible to every reader")
    expect(confirmation.confirmationToken).toMatch(/^[0-9a-f]{40}$/)
    expect(details.howToConfirm).toContain("notilab/confirmationToken")
  })

  it("lets the identical call through when the token comes back", async () => {
    news.findUnique.mockResolvedValue(mutationRow({ status: "APPROVED" }))
    news.findFirst.mockResolvedValue(detailRow({ status: "PUBLISHED" }))
    news.update.mockResolvedValue({})

    const { confirmed } = await confirmAndRun("publish_article", { id: "article-1" })

    expect(confirmed!.isError).toBeUndefined()
    expect(news.update).toHaveBeenCalledWith({
      where: { id: "article-1" },
      data: { status: "PUBLISHED" },
    })
  })

  it("refuses a token issued for different arguments", async () => {
    // The token is a fingerprint of the payload, so approving one act cannot be
    // replayed to authorise another.
    news.findUnique.mockResolvedValue(mutationRow())

    const first = await callTool(ABACUS_KEY, "archive_article", { id: "article-1" })
    const token = (
      errorOf(first).details!.confirmation as { confirmationToken: string }
    ).confirmationToken

    const reused = await callTool(
      ABACUS_KEY,
      "archive_article",
      { id: "article-2" },
      { "notilab/confirmationToken": token },
    )

    expect(errorOf(reused).code).toBe("CONFIRMATION_REQUIRED")
    expect(news.update).not.toHaveBeenCalled()
  })

  it("refuses a token issued to another client", async () => {
    env.NOTILAB_MCP_CLIENTS_JSON = roster({
      chatgpt: { apiKey: CHATGPT_KEY, permissions: "editorial" },
    })
    news.findUnique.mockResolvedValue(mutationRow())

    const first = await callTool(ABACUS_KEY, "publish_article", { id: "article-1" })
    const token = (
      errorOf(first).details!.confirmation as { confirmationToken: string }
    ).confirmationToken

    const stolen = await callTool(
      CHATGPT_KEY,
      "publish_article",
      { id: "article-1" },
      { "notilab/confirmationToken": token },
    )

    expect(errorOf(stolen).code).toBe("CONFIRMATION_REQUIRED")
    expect(news.update).not.toHaveBeenCalled()
  })

  it("records the refusal and the confirmed call as separate audit rows", async () => {
    news.findUnique.mockResolvedValue(mutationRow({ status: "APPROVED" }))
    news.findFirst.mockResolvedValue(detailRow({ status: "PUBLISHED" }))
    news.update.mockResolvedValue({})

    await confirmAndRun("publish_article", { id: "article-1" })

    const rows = auditRows().map((row) => row.details as Record<string, unknown>)
    expect(rows).toHaveLength(2)
    expect(rows[0].outcome).toBe("error")
    expect(rows[0].errorCode).toBe("CONFIRMATION_REQUIRED")
    expect(rows[0].confirmation).toEqual({ required: true, satisfied: false })
    expect(rows[1].outcome).toBe("success")
    expect(rows[1].confirmation).toEqual({ required: true, satisfied: true })
  })

  it("leaves ordinary writes ungated", async () => {
    news.findUnique.mockResolvedValue(mutationRow())
    news.findFirst.mockResolvedValue(detailRow({ title: "Título novo" }))
    news.update.mockResolvedValue({})

    const result = await callTool(ABACUS_KEY, "update_article", {
      id: "article-1",
      title: "Título novo",
    })

    expect(result.isError).toBeUndefined()
    expect((auditRows()[0].details as Record<string, unknown>).confirmation).toBeNull()
  })

  it("exempts a client the operator has explicitly opted out", async () => {
    // Documented as a deliberate risk acceptance for an unattended pipeline.
    env.NOTILAB_MCP_CLIENTS_JSON = roster({
      abacus: { apiKey: ABACUS_KEY, permissions: "editorial", skipCriticalConfirmation: true },
    })
    news.findUnique.mockResolvedValue(mutationRow({ status: "APPROVED" }))
    news.findFirst.mockResolvedValue(detailRow({ status: "PUBLISHED" }))
    news.update.mockResolvedValue({})

    const result = await callTool(ABACUS_KEY, "publish_article", { id: "article-1" })

    expect(result.isError).toBeUndefined()
    expect(news.update).toHaveBeenCalled()
  })

  it("gates every other client even when one is exempt", async () => {
    env.NOTILAB_MCP_CLIENTS_JSON = roster({
      abacus: { apiKey: ABACUS_KEY, permissions: "editorial", skipCriticalConfirmation: true },
      chatgpt: { apiKey: CHATGPT_KEY, permissions: "editorial" },
    })
    news.findUnique.mockResolvedValue(mutationRow({ status: "APPROVED" }))

    const result = await callTool(CHATGPT_KEY, "publish_article", { id: "article-1" })

    expect(errorOf(result).code).toBe("CONFIRMATION_REQUIRED")
  })
})

// ── Idempotency under retry ─────────────────────────────────────────────────

describe("idempotency", () => {
  it("replays a completed call rather than acting twice", async () => {
    adminAction.findFirst.mockResolvedValue({
      id: "idem-1",
      details: { status: "completed", response: { id: "new-1" } },
    })

    const result = await callTool(
      ABACUS_KEY,
      "create_article",
      {
        title: "Peça nova",
        content: "Corpo do artigo com texto suficiente para passar a validação.",
        categorySlug: "economia",
      },
      { "notilab/idempotencyKey": "brief-01" },
    )

    expect(result.isError).toBeUndefined()
    expect(news.create).not.toHaveBeenCalled()
  })

  it("does not repeat a confirmed publish on a retry with the same key", async () => {
    // The scenario the brief names: publish → timeout → retry. The second call
    // must find the claim already completed and replay it.
    news.findUnique.mockResolvedValue(mutationRow({ status: "APPROVED" }))
    news.findFirst.mockResolvedValue(detailRow({ status: "PUBLISHED" }))
    news.update.mockResolvedValue({})

    const args = { id: "article-1" }
    const refused = await callTool(ABACUS_KEY, "publish_article", args)
    const token = (
      errorOf(refused).details!.confirmation as { confirmationToken: string }
    ).confirmationToken
    const meta = { "notilab/confirmationToken": token, "notilab/idempotencyKey": "publish-01" }

    await callTool(ABACUS_KEY, "publish_article", args, meta)
    expect(news.update).toHaveBeenCalledTimes(1)

    // The retry finds the completed claim.
    adminAction.findFirst.mockResolvedValue({
      id: "idem-1",
      details: { status: "completed", response: { article: { id: "article-1" } } },
    })
    const retried = await callTool(ABACUS_KEY, "publish_article", args, meta)

    expect(retried.isError).toBeUndefined()
    expect(news.update).toHaveBeenCalledTimes(1)
  })

  it("refuses a reused key carrying a different payload", async () => {
    adminAction.findFirst.mockResolvedValue({
      id: "idem-1",
      details: { status: "completed", payloadHash: "not-the-same-payload" },
    })

    const result = await callTool(
      ABACUS_KEY,
      "create_article",
      {
        title: "Outra peça",
        content: "Corpo do artigo com texto suficiente para passar a validação.",
        categorySlug: "economia",
      },
      { "notilab/idempotencyKey": "brief-01" },
    )

    expect(errorOf(result).code).toBe("IDEMPOTENCY_PAYLOAD_MISMATCH")
    expect(news.create).not.toHaveBeenCalled()
  })

  it("claims no key for a read", async () => {
    news.findFirst.mockResolvedValue(detailRow())
    await callTool(CHATGPT_KEY, "get_article", { id: "article-1" })
    expect(idempotencyRows()).toHaveLength(0)
  })
})

// ── Health ──────────────────────────────────────────────────────────────────

describe("health check", () => {
  it("reports the service without naming a single client", async () => {
    const body = await (await HEALTH()).json()

    expect(body).toMatchObject({
      status: "ok",
      service: "notilab-mcp",
      transport: "streamable-http",
      configured: true,
    })
    expect(typeof body.version).toBe("string")

    const serialised = JSON.stringify(body)
    for (const leak of ["abacus", "chatgpt", "retired", ABACUS_KEY, CHATGPT_KEY, "editorial"]) {
      expect(serialised).not.toContain(leak)
    }
    // Nor how many there are.
    expect(serialised).not.toContain("clients")
  })

  it("reports configured: false when the roster is empty", async () => {
    delete env.NOTILAB_MCP_CLIENTS_JSON

    const body = await (await HEALTH()).json()

    expect(body.status).toBe("ok")
    expect(body.configured).toBe(false)
  })
})
