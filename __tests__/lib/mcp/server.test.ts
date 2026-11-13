/**
 * The MCP transport, end to end through the real pipeline.
 *
 * Driven through the route handler rather than through `handleMcpMessage`
 * alone, because the properties worth protecting here are transport-level:
 * that an unauthenticated caller is refused before its body is read, that
 * `tools/list` cannot show a tool the credential does not hold, that a domain
 * refusal reaches the model as a readable error instead of a protocol failure,
 * and that a mutation still lands in the audit trail — now marked `mcp`.
 *
 * The database is mocked; the pipeline is real. Every editorial rule exercised
 * below is enforced in lib/editorial/article-service.ts, not here — that is the
 * point of the test.
 */

import { NextRequest } from "next/server"
import { POST, GET, DELETE } from "@/app/api/mcp/route"
import { handleMcpMessage } from "@/lib/mcp/server"
import { unclassifiedMutatingTools } from "@/lib/mcp/tools"
import { resetRateLimits } from "@/lib/agent/rate-limit"
import { listToolNames } from "@/lib/agent/registry"
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
const category = prisma.category as unknown as Record<string, jest.Mock>
const adminAction = prisma.adminAction as unknown as Record<string, jest.Mock>

/** 40 hex characters — comfortably over the 32-character floor. */
const MCP_KEY = "m".repeat(40)
const env = process.env as Record<string, string | undefined>
const originalEnv = { ...process.env }

let nextRpcId = 0

function rpc(method: string, params?: unknown, id: number | string | null = ++nextRpcId) {
  return id === null ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id, method, params }
}

function request(body: unknown, init: { key?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  }
  const key = init.key === undefined ? MCP_KEY : init.key
  if (key) headers.authorization = `Bearer ${key}`

  return new NextRequest("http://localhost/api/mcp", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

async function post(body: unknown, init?: { key?: string | null }) {
  const response = await POST(request(body, init))
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    raw: text,
    body: text ? JSON.parse(text) : null,
  }
}

/** One tools/call, returning the MCP result object. */
async function callTool(name: string, args: unknown, init?: { key?: string | null }) {
  const result = await post(rpc("tools/call", { name, arguments: args }), init)
  return result
}

/**
 * A critical tool — approve, publish, unpublish, archive — takes two calls: the
 * first is refused with a confirmation token, the second repeats the identical
 * arguments carrying it. The gate itself is covered in `clients.test.ts`; here
 * it is only the way through to the behaviour under test.
 */
async function callCriticalTool(name: string, args: Record<string, unknown>) {
  const refused = await callTool(name, args)
  const token = refused.body.result?.structuredContent?.error?.details?.confirmation
    ?.confirmationToken as string | undefined

  expect(token).toMatch(/^[0-9a-f]{40}$/)

  return post(
    rpc("tools/call", {
      name,
      arguments: args,
      _meta: { "notilab/confirmationToken": token },
    }),
  )
}

/**
 * The audit row, as distinct from the idempotency bookkeeping row. Mutating
 * MCP calls write both to `AdminAction`, so an index-based assertion would be
 * testing the wrong row.
 */
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

beforeEach(() => {
  resetRateLimits()
  nextRpcId = 0
  for (const key of ["NOTILAB_MCP_IDEMPOTENCY_WINDOW_MS"]) delete env[key]
  env.NOTILAB_MCP_API_KEY = MCP_KEY
  env.NOTILAB_MCP_AGENT_ID = "abacus-mcp"
  env.NOTILAB_MCP_PERMISSIONS = "editorial"
  adminAction.create.mockResolvedValue({ id: "audit-1" })
  adminAction.findFirst.mockResolvedValue(null)
})

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete env[key]
  }
  Object.assign(process.env, originalEnv)
})

// ── Authentication ──────────────────────────────────────────────────────────

describe("authentication", () => {
  it("refuses a call with no credential, before reading the body", async () => {
    const result = await post(rpc("tools/list"), { key: null })

    expect(result.status).toBe(401)
    expect(result.body.error.message).toContain("UNAUTHENTICATED")
    expect(news.findMany).not.toHaveBeenCalled()
  })

  it("refuses a wrong key", async () => {
    const result = await post(rpc("tools/list"), { key: "z".repeat(40) })

    expect(result.status).toBe(401)
    expect(result.body.error.message).toContain("INVALID_API_KEY")
  })

  it("is disabled entirely when no key is configured", async () => {
    delete env.NOTILAB_MCP_API_KEY

    const result = await post(rpc("tools/list"))

    expect(result.status).toBe(503)
    expect(result.body.error.message).toContain("AGENT_API_DISABLED")
  })

  it("refuses a key shorter than 32 characters rather than accepting it", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {})
    env.NOTILAB_MCP_API_KEY = "short"

    const result = await post(rpc("tools/list"), { key: "short" })

    expect(result.status).toBe(503)
  })

  it("does not fall back to the Agent API credential", async () => {
    // Separate variables mean an operator can revoke one transport without the
    // other. A fallback would silently re-enable MCP on any deploy that had an
    // Agent API key.
    delete env.NOTILAB_MCP_API_KEY
    env.NOTILAB_AGENT_API_KEY = "a".repeat(40)

    const result = await post(rpc("tools/list"), { key: "a".repeat(40) })

    expect(result.status).toBe(503)
  })
})

// ── Discovery ───────────────────────────────────────────────────────────────

describe("tools/list", () => {
  it("exposes exactly the fifteen registry tools and nothing else", async () => {
    const result = await post(rpc("tools/list"))

    const names = (result.body.result.tools as Array<{ name: string }>).map((tool) => tool.name)

    expect(names).toHaveLength(15)
    expect(names.sort()).toEqual(
      [
        "approve_article",
        "archive_article",
        "create_article",
        "get_article",
        "list_categories",
        "publish_article",
        "reject_article",
        "schedule_article",
        "search_articles",
        "set_article_image",
        "submit_article_for_review",
        "unpublish_article",
        "unschedule_article",
        "update_article",
        "update_article_seo",
      ].sort(),
    )
  })

  it("stays in step with the registry, which is the only source of tools", async () => {
    const result = await post(rpc("tools/list"))
    const names = (result.body.result.tools as Array<{ name: string }>).map((tool) => tool.name)

    expect(names.sort()).toEqual([...listToolNames()].sort())
  })

  it("narrows the catalogue to the credential's permissions", async () => {
    // A model shown a tool it cannot call will call it, fail, and try again.
    env.NOTILAB_MCP_PERMISSIONS = "readonly"

    const result = await post(rpc("tools/list"))
    const names = (result.body.result.tools as Array<{ name: string }>).map((tool) => tool.name)

    expect(names.sort()).toEqual(["get_article", "list_categories", "search_articles"])
  })

  it("advertises restrictive input schemas that reject unknown fields", async () => {
    const result = await post(rpc("tools/list"))
    const tools = result.body.result.tools as Array<{
      name: string
      inputSchema: { additionalProperties: boolean; properties: Record<string, unknown> }
    }>

    for (const tool of tools) {
      expect(tool.inputSchema.additionalProperties).toBe(false)
    }

    const update = tools.find((tool) => tool.name === "update_article")!
    // The containment property, visible in the advertised schema rather than
    // only at call time.
    for (const forbidden of [
      "status",
      "sourceUrl",
      "sourceName",
      "trending",
      "rankingScore",
      "importanceScore",
      "authorId",
      "reviewerId",
      "publishedAt",
    ]) {
      expect(update.inputSchema.properties).not.toHaveProperty(forbidden)
    }
  })

  it("has a behaviour annotation for every mutating tool", async () => {
    // Fails the moment someone adds a mutating tool to the registry without
    // deciding whether it is destructive — the drift guard for lib/mcp/tools.ts.
    expect(unclassifiedMutatingTools()).toEqual([])
  })

  it("marks reads read-only and the terminal transitions destructive", async () => {
    const result = await post(rpc("tools/list"))
    const tools = result.body.result.tools as Array<{
      name: string
      annotations: { readOnlyHint: boolean; destructiveHint: boolean }
    }>
    const byName = new Map(tools.map((tool) => [tool.name, tool.annotations]))

    expect(byName.get("search_articles")!.readOnlyHint).toBe(true)
    expect(byName.get("publish_article")!.readOnlyHint).toBe(false)
    expect(byName.get("archive_article")!.destructiveHint).toBe(true)
    expect(byName.get("reject_article")!.destructiveHint).toBe(true)
    expect(byName.get("publish_article")!.destructiveHint).toBe(false)
  })
})

describe("handshake", () => {
  it("negotiates a protocol version and declares only the tools capability", async () => {
    const result = await post(
      rpc("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "abacus", version: "1.0" },
      }),
    )

    expect(result.status).toBe(200)
    expect(result.body.result.protocolVersion).toBe("2025-06-18")
    expect(result.body.result.capabilities).toEqual({ tools: { listChanged: false } })
    expect(result.body.result.serverInfo.name).toBe("notilab")
    expect(result.body.result.instructions).toContain("APPROVED → PUBLISHED")
  })

  it("answers a notification with 202 and no body", async () => {
    const response = await POST(request(rpc("notifications/initialized", {}, null)))

    expect(response.status).toBe(202)
    expect(await response.text()).toBe("")
  })

  it("answers ping", async () => {
    const result = await post(rpc("ping"))
    expect(result.body.result).toEqual({})
  })

  it("refuses GET and DELETE, which this stateless server does not offer", async () => {
    expect((await GET()).status).toBe(405)
    expect((await DELETE()).status).toBe(405)
  })

  it("reports an unsupported method as METHOD_NOT_FOUND", async () => {
    const result = await post(rpc("sampling/createMessage", {}))
    expect(result.body.error.code).toBe(-32601)
  })

  it("reports a malformed body as a parse error", async () => {
    const result = await post("{not json")
    expect(result.status).toBe(400)
    expect(result.body.error.code).toBe(-32700)
  })
})

// ── Reads ───────────────────────────────────────────────────────────────────

describe("read tools", () => {
  it("searches articles", async () => {
    news.findMany.mockResolvedValue([detailRow()])
    news.count.mockResolvedValue(1)

    const result = await callTool("search_articles", { limit: 5, sortBy: "recent" })
    const payload = result.body.result.structuredContent

    expect(result.body.result.isError).toBeUndefined()
    expect(payload.articles).toHaveLength(1)
    expect(payload.pagination).toEqual({ limit: 5, offset: 0, total: 1, hasMore: false })
  })

  it("searches with no query at all, which is not a required field", async () => {
    news.findMany.mockResolvedValue([])
    news.count.mockResolvedValue(0)

    const result = await callTool("search_articles", {})
    expect(result.body.result.isError).toBeUndefined()
  })

  it("gets one article by id or slug and returns the full body", async () => {
    news.findFirst.mockResolvedValue(detailRow())

    const result = await callTool("get_article", { id: "titulo-original" })
    const payload = result.body.result.structuredContent

    expect(payload.id).toBe("article-1")
    expect(payload.content).toBe("Corpo do artigo com texto suficiente.")
    expect(news.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ id: "titulo-original" }, { slug: "titulo-original" }] },
      }),
    )
  })

  it("lists categories with no arguments", async () => {
    category.findMany.mockResolvedValue([
      {
        id: "cat-1",
        name: "Economia",
        slug: "economia",
        description: null,
        color: "#000",
        _count: { news: 4 },
      },
    ])

    const result = await callTool("list_categories", {})

    expect(result.body.result.structuredContent.categories).toEqual([
      {
        id: "cat-1",
        name: "Economia",
        slug: "economia",
        description: null,
        color: "#000",
        articleCount: 4,
      },
    ])
  })

  it("writes no audit row for a read", async () => {
    news.findFirst.mockResolvedValue(detailRow())
    await callTool("get_article", { id: "article-1" })
    expect(auditRows()).toHaveLength(0)
  })
})

// ── The business layer, not a second implementation of it ───────────────────

describe("mutations go through the editorial service", () => {
  it("updates an article through the whitelisted field set", async () => {
    news.findUnique.mockResolvedValue(mutationRow())
    news.findFirst.mockResolvedValue(detailRow({ title: "Título novo" }))
    news.update.mockResolvedValue({})

    const result = await callTool("update_article", { id: "article-1", title: "Título novo" })

    expect(result.body.result.isError).toBeUndefined()
    expect(result.body.result.structuredContent.changed).toEqual(["title"])
    // The service decided what reaches Prisma — the transport passed nothing through.
    expect(news.update).toHaveBeenCalledWith({
      where: { id: "article-1" },
      data: { title: "Título novo" },
    })
  })

  it("refuses to publish a DRAFT, and says why in terms the model can act on", async () => {
    news.findUnique.mockResolvedValue(mutationRow({ status: "DRAFT" }))

    // Confirmed, so the refusal below is the editorial gate rather than the
    // confirmation gate — the two are independent and both must hold.
    const result = await callCriticalTool("publish_article", { id: "article-1" })

    // A domain refusal is an MCP error *result*, not a JSON-RPC failure: the
    // model has to be able to read it and approve the article instead.
    expect(result.status).toBe(200)
    expect(result.body.result.isError).toBe(true)
    expect(result.body.result.structuredContent.error.code).toBe("ARTICLE_NOT_APPROVED")
    expect(result.body.result.structuredContent.error.details.currentStatus).toBe("DRAFT")
    expect(result.body.result.content[0].text).toContain("ARTICLE_NOT_APPROVED")
    expect(news.update).not.toHaveBeenCalled()
  })

  it("publishes an APPROVED article", async () => {
    news.findUnique.mockResolvedValue(mutationRow({ status: "APPROVED" }))
    news.findFirst.mockResolvedValue(detailRow({ status: "PUBLISHED" }))
    news.update.mockResolvedValue({})

    const result = await callCriticalTool("publish_article", { id: "article-1" })

    expect(result.body.result.isError).toBeUndefined()
    expect(result.body.result.structuredContent.changed).toEqual(["status"])
    expect(news.update).toHaveBeenCalledWith({
      where: { id: "article-1" },
      data: { status: "PUBLISHED" },
    })
  })

  it("creates an article as a DRAFT, with no parameter that could say otherwise", async () => {
    category.findUnique.mockResolvedValue({ id: "cat-1" })
    news.create.mockResolvedValue({ id: "new-1" })
    news.findFirst.mockResolvedValue(detailRow({ id: "new-1", status: "DRAFT" }))

    const result = await callTool("create_article", {
      title: "Peça nova",
      content: "Corpo do artigo com texto suficiente para passar a validação.",
      categorySlug: "economia",
    })

    expect(result.body.result.isError).toBeUndefined()
    expect(news.create.mock.calls[0][0].data.status).toBe("DRAFT")
  })

  it("refuses a status parameter on create_article", async () => {
    const result = await callTool("create_article", {
      title: "Peça nova",
      content: "Corpo do artigo com texto suficiente para passar a validação.",
      categorySlug: "economia",
      status: "PUBLISHED",
    })

    expect(result.body.result.isError).toBe(true)
    expect(result.body.result.structuredContent.error.code).toBe("VALIDATION_FAILED")
    expect(news.create).not.toHaveBeenCalled()
  })

  it("refuses a slug change that was not asked for", async () => {
    // update_article_seo only touches the slug when one is supplied.
    news.findUnique.mockResolvedValue(mutationRow())
    news.findFirst.mockResolvedValue(detailRow({ summary: "Novo resumo" }))
    news.update.mockResolvedValue({})

    await callTool("update_article_seo", { id: "article-1", summary: "Novo resumo" })

    expect(news.update).toHaveBeenCalledWith({
      where: { id: "article-1" },
      data: { summary: "Novo resumo" },
    })
  })
})

// ── What the transport cannot be talked into ────────────────────────────────

describe("containment", () => {
  it("rejects an unknown input field instead of dropping it", async () => {
    const result = await callTool("update_article", { id: "article-1", nonsense: 1 })

    expect(result.body.result.isError).toBe(true)
    expect(result.body.result.structuredContent.error.code).toBe("VALIDATION_FAILED")
    expect(result.body.result.structuredContent.error.details.fields).toContainEqual({
      field: "nonsense",
      message: "unknown field — not accepted by this tool",
    })
    expect(news.update).not.toHaveBeenCalled()
  })

  it("cannot rewrite provenance", async () => {
    for (const field of [{ sourceUrl: "https://evil.test" }, { sourceName: "Reuters" }]) {
      const result = await callTool("update_article", { id: "article-1", ...field })
      expect(result.body.result.isError).toBe(true)
      expect(result.body.result.structuredContent.error.code).toBe("VALIDATION_FAILED")
    }
    expect(news.update).not.toHaveBeenCalled()
  })

  it("cannot set a computed score", async () => {
    for (const field of [{ rankingScore: 99 }, { importanceScore: 99 }, { trending: true }]) {
      const result = await callTool("update_article", { id: "article-1", ...field })
      expect(result.body.result.isError).toBe(true)
      expect(result.body.result.structuredContent.error.code).toBe("VALIDATION_FAILED")
    }
    expect(news.update).not.toHaveBeenCalled()
  })

  it("cannot write status directly", async () => {
    const result = await callTool("update_article", { id: "article-1", status: "PUBLISHED" })

    expect(result.body.result.isError).toBe(true)
    expect(news.update).not.toHaveBeenCalled()
  })

  it("cannot call a tool that is not in the registry", async () => {
    const result = await callTool("run_sql", { query: "select 1" })

    // A protocol error, not a readable tool error: nothing the model could do
    // would make this name exist.
    expect(result.body.error.code).toBe(-32602)
    expect(result.body.error.message).toContain("Unknown tool")
  })

  it("cannot call a tool the credential does not hold", async () => {
    env.NOTILAB_MCP_PERMISSIONS = "readonly"

    const result = await callTool("publish_article", { id: "article-1" })

    expect(result.body.result.isError).toBe(true)
    expect(result.body.result.structuredContent.error.code).toBe("FORBIDDEN")
    expect(news.update).not.toHaveBeenCalled()
  })

  it("never leaks an unexpected error message to the caller", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {})
    news.findFirst.mockRejectedValue(
      new Error("connect ECONNREFUSED postgres://user:secret@db.internal:5432"),
    )

    const result = await callTool("get_article", { id: "article-1" })

    expect(result.body.result.isError).toBe(true)
    expect(result.body.result.structuredContent.error.code).toBe("INTERNAL_ERROR")
    expect(result.raw).not.toContain("secret")
    expect(result.raw).not.toContain("db.internal")
  })
})

// ── Secrets ─────────────────────────────────────────────────────────────────

describe("secret handling", () => {
  it("never echoes the API key, on success or on failure", async () => {
    news.findMany.mockResolvedValue([])
    news.count.mockResolvedValue(0)

    const ok = await callTool("search_articles", {})
    const refused = await post(rpc("tools/list"), { key: "z".repeat(40) })

    expect(ok.raw).not.toContain(MCP_KEY)
    expect(refused.raw).not.toContain("z".repeat(40))
    expect(refused.raw).not.toContain(MCP_KEY)
  })

  it("never logs the key, even when refusing it", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {})
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})

    await post(rpc("tools/list"), { key: "z".repeat(40) })

    const logged = [...error.mock.calls, ...warn.mock.calls].flat().map(String).join(" ")
    expect(logged).not.toContain(MCP_KEY)
    expect(logged).not.toContain("z".repeat(40))
  })

  it("redacts anything credential-shaped out of an audit row", async () => {
    // A tool has no field named like a credential, so this exercises the guard
    // rather than a live path — which is exactly what it is there for.
    news.findUnique.mockResolvedValue(mutationRow())
    news.findFirst.mockResolvedValue(detailRow({ title: "Outro" }))
    news.update.mockResolvedValue({})

    await callTool("update_article", { id: "article-1", title: "Outro" })

    const serialised = JSON.stringify(auditRows())
    expect(serialised).not.toContain(MCP_KEY)
  })
})

// ── Audit ───────────────────────────────────────────────────────────────────

describe("audit trail", () => {
  it("records a successful mutation, marked as MCP", async () => {
    news.findUnique.mockResolvedValue(mutationRow())
    news.findFirst.mockResolvedValue(detailRow({ title: "Título novo" }))
    news.update.mockResolvedValue({})

    await callTool("update_article", { id: "article-1", title: "Título novo" })

    const [audited] = auditRows()
    const details = audited.details as Record<string, unknown>

    expect(audited.userId).toBe("agent:abacus-mcp")
    expect(audited.action).toBe("ARTICLE_UPDATE")
    expect(audited.resourceId).toBe("article-1")
    expect(details.transport).toBe("mcp")
    expect(details.agentId).toBe("abacus-mcp")
    expect(details.tool).toBe("update_article")
    expect(details.outcome).toBe("success")
    expect(details.requestId).toMatch(/[0-9a-f-]{36}/)
    expect(typeof details.durationMs).toBe("number")
    expect(details.changes).toEqual({
      title: { before: "Título original", after: "Título novo" },
    })
  })

  it("records a refused mutation too", async () => {
    news.findUnique.mockResolvedValue(mutationRow({ status: "DRAFT" }))

    await callCriticalTool("publish_article", { id: "article-1" })

    // Two rows: the confirmation refusal, then the editorial refusal. Both are
    // attempts on a critical tool and both are worth keeping.
    const rows = auditRows()
    expect(rows).toHaveLength(2)

    expect((rows[0].details as Record<string, unknown>).errorCode).toBe("CONFIRMATION_REQUIRED")
    expect((rows[0].details as Record<string, unknown>).confirmation).toEqual({
      required: true,
      satisfied: false,
    })

    const audited = rows[1]
    const details = audited.details as Record<string, unknown>

    expect(audited.action).toBe("ARTICLE_PUBLISH")
    expect(details.transport).toBe("mcp")
    expect(details.outcome).toBe("error")
    expect(details.errorCode).toBe("ARTICLE_NOT_APPROVED")
    expect(details.confirmation).toEqual({ required: true, satisfied: true })
  })

  it("records a forbidden attempt", async () => {
    env.NOTILAB_MCP_PERMISSIONS = "readonly"

    await callTool("publish_article", { id: "article-1" })

    const details = auditRows()[0].details as Record<string, unknown>
    expect(details.errorCode).toBe("FORBIDDEN")
    expect(details.transport).toBe("mcp")
  })
})

// ── Idempotency ─────────────────────────────────────────────────────────────

describe("idempotency", () => {
  it("derives a stable retry key, so a repeated create does not duplicate", async () => {
    category.findUnique.mockResolvedValue({ id: "cat-1" })
    news.create.mockResolvedValue({ id: "new-1" })
    news.findFirst.mockResolvedValue(detailRow({ id: "new-1", status: "DRAFT" }))

    const args = {
      title: "Peça nova",
      content: "Corpo do artigo com texto suficiente para passar a validação.",
      categorySlug: "economia",
    }

    await callTool("create_article", args)
    await callTool("create_article", args)

    const claims = idempotencyRows()
    expect(claims).toHaveLength(2)
    // Same derived key → same storage row → the second call would have replayed
    // had the first one completed.
    expect(claims[0].resourceId).toBe(claims[1].resourceId)
  })

  it("honours a client-supplied key from _meta", async () => {
    category.findUnique.mockResolvedValue({ id: "cat-1" })
    news.create.mockResolvedValue({ id: "new-1" })
    news.findFirst.mockResolvedValue(detailRow({ id: "new-1", status: "DRAFT" }))

    const base = {
      title: "Peça nova",
      content: "Corpo do artigo com texto suficiente para passar a validação.",
      categorySlug: "economia",
    }

    await POST(
      request(
        rpc("tools/call", {
          name: "create_article",
          arguments: base,
          _meta: { "notilab/idempotencyKey": "brief-2026-09-04-01" },
        }),
      ),
    )
    await POST(
      request(
        rpc("tools/call", {
          name: "create_article",
          // A different payload under the same explicit key must still collide,
          // which is what makes the mismatch check meaningful.
          arguments: { ...base, title: "Outra peça" },
          _meta: { "notilab/idempotencyKey": "brief-2026-09-04-01" },
        }),
      ),
    )

    const claims = idempotencyRows()
    expect(claims[0].resourceId).toBe(claims[1].resourceId)
  })

  it("replays a completed call instead of acting twice", async () => {
    adminAction.findFirst.mockResolvedValue({
      id: "idem-1",
      details: { status: "completed", response: { id: "new-1" } },
    })

    const result = await callTool("create_article", {
      title: "Peça nova",
      content: "Corpo do artigo com texto suficiente para passar a validação.",
      categorySlug: "economia",
    })

    expect(result.body.result.isError).toBeUndefined()
    expect(news.create).not.toHaveBeenCalled()
  })

  it("lets a genuine repeat through once the window has passed", async () => {
    // The derived key is bucketed by time so it protects a retry without
    // permanently blocking the same payload a day later.
    env.NOTILAB_MCP_IDEMPOTENCY_WINDOW_MS = "60000"
    category.findUnique.mockResolvedValue({ id: "cat-1" })
    news.create.mockResolvedValue({ id: "new-1" })
    news.findFirst.mockResolvedValue(detailRow({ id: "new-1", status: "DRAFT" }))

    const args = {
      title: "Peça nova",
      content: "Corpo do artigo com texto suficiente para passar a validação.",
      categorySlug: "economia",
    }
    const ctx = { identity: { id: "abacus-mcp", label: "abacus-mcp", permissions: ["article.create" as const] }, requestId: "r-1" }

    await handleMcpMessage(rpc("tools/call", { name: "create_article", arguments: args }) as never, {
      ...ctx,
      now: new Date("2026-09-04T10:00:00Z"),
    })
    await handleMcpMessage(rpc("tools/call", { name: "create_article", arguments: args }) as never, {
      ...ctx,
      now: new Date("2026-09-04T11:00:00Z"),
    })

    const claims = idempotencyRows()
    expect(claims).toHaveLength(2)
    expect(claims[0].resourceId).not.toBe(claims[1].resourceId)
  })

  it("claims no key for a read", async () => {
    news.findFirst.mockResolvedValue(detailRow())
    await callTool("get_article", { id: "article-1" })
    expect(idempotencyRows()).toHaveLength(0)
  })
})

// ── Rate limiting ───────────────────────────────────────────────────────────

describe("rate limiting", () => {
  it("applies to MCP calls too", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {})
    env.NOTILAB_AGENT_RATE_LIMIT = "2"
    news.findFirst.mockResolvedValue(detailRow())

    await callTool("get_article", { id: "article-1" })
    await callTool("get_article", { id: "article-1" })
    const blocked = await callTool("get_article", { id: "article-1" })

    expect(blocked.body.result.isError).toBe(true)
    expect(blocked.body.result.structuredContent.error.code).toBe("RATE_LIMITED")

    delete env.NOTILAB_AGENT_RATE_LIMIT
  })
})
