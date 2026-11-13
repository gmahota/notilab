/**
 * End-to-end through the request pipeline, which is the only place the ordering
 * guarantees can be tested: authentication before authorisation, authorisation
 * before validation, validation before any business call, audit after every
 * write. A tool that skipped one of those would still pass its own unit tests.
 *
 * The database is mocked; the pipeline is real.
 */

import { NextRequest } from "next/server"
import { runTool } from "@/lib/agent/runner"
import { resetRateLimits } from "@/lib/agent/rate-limit"
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
    category: { findUnique: jest.fn() },
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

const KEY = "k".repeat(40)
const env = process.env as Record<string, string | undefined>
const originalEnv = { ...process.env }

function request(
  tool: string,
  body: unknown,
  init: { key?: string | null; headers?: Record<string, string> } = {},
): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers ?? {}),
  }
  const key = init.key === undefined ? KEY : init.key
  if (key) headers.authorization = `Bearer ${key}`

  return new NextRequest(`http://localhost/api/agent/tools/${tool}`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

async function call(
  tool: string,
  body: unknown,
  init?: { key?: string | null; headers?: Record<string, string> },
) {
  const response = await runTool(tool, request(tool, body, init))
  return { status: response.status, body: await response.json(), headers: response.headers }
}

/**
 * A critical tool — approve, publish, unpublish, archive — takes two calls: the
 * first is refused with a confirmation token, the second repeats the identical
 * body carrying it as `confirmationToken`. Over HTTP the token travels in the
 * body; MCP has to route it through `_meta`, because its advertised schemas
 * reject undeclared fields.
 */
async function callCritical(
  tool: string,
  body: Record<string, unknown>,
  init?: { key?: string | null; headers?: Record<string, string> },
) {
  const refused = await call(tool, body, init)

  expect(refused.status).toBe(409)
  expect(refused.body.error.code).toBe("CONFIRMATION_REQUIRED")

  const token = refused.body.meta?.confirmation?.confirmationToken as string | undefined
  expect(token).toMatch(/^[0-9a-f]{40}$/)

  return call(tool, { ...body, confirmationToken: token }, init)
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
  for (const key of ["NOTILAB_AGENT_API_KEYS", "NOTILAB_AGENT_PERMISSIONS"]) delete env[key]
  env.NOTILAB_AGENT_API_KEY = KEY
  env.NOTILAB_AGENT_ID = "abacus"
  env.NOTILAB_AGENT_PERMISSIONS = "editorial"
  adminAction.create.mockResolvedValue({ id: "audit-1" })
  adminAction.findFirst.mockResolvedValue(null)
})

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete env[key]
  }
  Object.assign(process.env, originalEnv)
})

describe("authentication and dispatch", () => {
  it("refuses an unauthenticated call before touching the database", async () => {
    const result = await call("get_article", { id: "article-1" }, { key: null })

    expect(result.status).toBe(401)
    expect(result.body.success).toBe(false)
    expect(result.body.error.code).toBe("UNAUTHENTICATED")
    expect(news.findFirst).not.toHaveBeenCalled()
  })

  it("refuses a wrong key", async () => {
    const result = await call("get_article", { id: "article-1" }, { key: "z".repeat(40) })
    expect(result.status).toBe(401)
    expect(result.body.error.code).toBe("INVALID_API_KEY")
  })

  it("answers TOOL_NOT_FOUND for a name outside the registry", async () => {
    const result = await call("delete_all_articles", {})
    expect(result.status).toBe(404)
    expect(result.body.error.code).toBe("TOOL_NOT_FOUND")
    expect(result.body.error.details.availableTools).toContain("search_articles")
  })

  it("returns a request id on every response, including failures", async () => {
    const result = await call("get_article", { id: "x" }, { key: null })
    expect(result.body.meta.requestId).toMatch(/[0-9a-f-]{36}/)
    expect(result.headers.get("X-Agent-Request-Id")).toBe(result.body.meta.requestId)
  })

  it("rejects a malformed body", async () => {
    const result = await call("get_article", "{not json", {})
    expect(result.status).toBe(400)
    expect(result.body.error.code).toBe("MALFORMED_JSON")
  })
})

describe("authorisation", () => {
  it("refuses a tool the credential does not hold, without calling it", async () => {
    env.NOTILAB_AGENT_PERMISSIONS = "readonly"

    const result = await call("publish_article", { id: "article-1" })

    expect(result.status).toBe(403)
    expect(result.body.error.code).toBe("FORBIDDEN")
    expect(result.body.error.details.missing).toEqual(["article.publish"])
    expect(news.update).not.toHaveBeenCalled()
  })

  it("checks permissions before validating input", async () => {
    // Order matters: a forbidden agent must not learn a tool's schema by
    // probing it with bad payloads.
    env.NOTILAB_AGENT_PERMISSIONS = "readonly"
    const result = await call("publish_article", {})
    expect(result.body.error.code).toBe("FORBIDDEN")
  })
})

describe("validation", () => {
  it("rejects an unauthorised field with the field named", async () => {
    // The core containment property: an agent cannot write status through
    // update_article, and it is told so.
    const result = await call("update_article", { id: "article-1", status: "PUBLISHED" })

    expect(result.status).toBe(422)
    expect(result.body.error.code).toBe("VALIDATION_FAILED")
    expect(result.body.error.details.fields).toContainEqual({
      field: "status",
      message: "unknown field — not accepted by this tool",
    })
    expect(news.update).not.toHaveBeenCalled()
  })

  it("rejects an attempt to rewrite provenance", async () => {
    const result = await call("update_article", {
      id: "article-1",
      sourceName: "Reuters",
    })

    expect(result.status).toBe(422)
    expect(news.update).not.toHaveBeenCalled()
  })

  it("rejects an attempt to set a computed score", async () => {
    const result = await call("update_article", { id: "article-1", rankingScore: 99 })
    expect(result.status).toBe(422)
  })

  it("reports a missing required field", async () => {
    const result = await call("get_article", {})
    expect(result.status).toBe(422)
    expect(result.body.error.details.fields).toContainEqual({ field: "id", message: "is required" })
  })
})

describe("reads", () => {
  it("returns an article and does not write an audit row", async () => {
    news.findFirst.mockResolvedValue(detailRow())
    adminAction.findFirst.mockResolvedValue(null)

    const result = await call("get_article", { id: "article-1" })

    expect(result.status).toBe(200)
    expect(result.body.success).toBe(true)
    expect(result.body.data.id).toBe("article-1")
    expect(result.body.data.schedule).toBeNull()
    expect(adminAction.create).not.toHaveBeenCalled()
  })

  it("reports a missing article as ARTICLE_NOT_FOUND", async () => {
    news.findFirst.mockResolvedValue(null)
    const result = await call("get_article", { id: "nope" })

    expect(result.status).toBe(404)
    expect(result.body.error.code).toBe("ARTICLE_NOT_FOUND")
  })

  it("searches with filters and returns pagination", async () => {
    news.findMany.mockResolvedValue([detailRow()])
    news.count.mockResolvedValue(1)

    const result = await call("search_articles", { published: false, hasImage: false, limit: 5 })

    expect(result.status).toBe(200)
    expect(result.body.data.pagination).toEqual({
      limit: 5,
      offset: 0,
      total: 1,
      hasMore: false,
    })
  })
})

describe("writes and the audit trail", () => {
  it("updates an article and records before/after", async () => {
    news.findUnique.mockResolvedValue(mutationRow())
    news.findFirst.mockResolvedValue(detailRow({ title: "Título novo" }))
    news.update.mockResolvedValue({})

    const result = await call("update_article", { id: "article-1", title: "Título novo" })

    expect(result.status).toBe(200)
    expect(result.body.data.changed).toEqual(["title"])
    expect(result.body.meta.auditRecorded).toBe(true)

    const audited = adminAction.create.mock.calls[0][0].data
    expect(audited.userId).toBe("agent:abacus")
    expect(audited.action).toBe("ARTICLE_UPDATE")
    expect(audited.resourceId).toBe("article-1")
    expect((audited.details as Record<string, unknown>).changes).toEqual({
      title: { before: "Título original", after: "Título novo" },
    })
  })

  it("records a refused write as well as a successful one", async () => {
    // "This agent tried to publish a draft nine times" is exactly what an
    // operator needs to be able to see afterwards.
    news.findUnique.mockResolvedValue(mutationRow({ status: "DRAFT" }))

    const result = await callCritical("publish_article", { id: "article-1" })

    expect(result.status).toBe(409)
    expect(result.body.error.code).toBe("ARTICLE_NOT_APPROVED")

    // Two rows: the confirmation refusal, then the editorial one.
    const rows = adminAction.create.mock.calls.map((c) => c[0].data)
    expect((rows[0].details as Record<string, unknown>).errorCode).toBe("CONFIRMATION_REQUIRED")

    const audited = rows[1]
    expect(audited.action).toBe("ARTICLE_PUBLISH")
    expect((audited.details as Record<string, unknown>).outcome).toBe("error")
    expect((audited.details as Record<string, unknown>).errorCode).toBe("ARTICLE_NOT_APPROVED")
  })

  it("records a forbidden attempt", async () => {
    env.NOTILAB_AGENT_PERMISSIONS = "readonly"
    await call("publish_article", { id: "article-1" })

    const audited = adminAction.create.mock.calls[0][0].data
    expect((audited.details as Record<string, unknown>).errorCode).toBe("FORBIDDEN")
  })

  it("reports the gap when a write succeeds but its audit row does not", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {})
    news.findUnique.mockResolvedValue(mutationRow())
    news.findFirst.mockResolvedValue(detailRow({ title: "Outro" }))
    news.update.mockResolvedValue({})
    adminAction.create.mockRejectedValue(new Error("audit table unavailable"))

    const result = await call("update_article", { id: "article-1", title: "Outro" })

    expect(result.status).toBe(200)
    expect(result.body.meta.auditRecorded).toBe(false)
  })

  it("publishes an approved article", async () => {
    news.findUnique.mockResolvedValue(mutationRow({ status: "APPROVED" }))
    news.findFirst.mockResolvedValue(detailRow({ status: "PUBLISHED" }))
    news.update.mockResolvedValue({})

    const result = await callCritical("publish_article", { id: "article-1" })

    expect(result.status).toBe(200)
    expect(result.body.data.changed).toEqual(["status"])
  })
})

describe("the confirmation gate over HTTP", () => {
  it.each(["approve_article", "publish_article", "unpublish_article", "archive_article"])(
    "halts %s on the first call, before the business layer",
    async (tool) => {
      news.findUnique.mockResolvedValue(mutationRow())

      const result = await call(tool, { id: "article-1" })

      expect(result.status).toBe(409)
      expect(result.body.error.code).toBe("CONFIRMATION_REQUIRED")
      expect(result.body.meta.confirmation.reason).toBe("critical_action")
      expect(news.update).not.toHaveBeenCalled()
    },
  )

  it("leaves an ordinary write ungated", async () => {
    news.findUnique.mockResolvedValue(mutationRow())
    news.findFirst.mockResolvedValue(detailRow({ title: "Título novo" }))
    news.update.mockResolvedValue({})

    const result = await call("update_article", { id: "article-1", title: "Título novo" })

    expect(result.status).toBe(200)
  })

  it("refuses a token minted for a different payload", async () => {
    news.findUnique.mockResolvedValue(mutationRow())

    const refused = await call("archive_article", { id: "article-1" })
    const token = refused.body.meta.confirmation.confirmationToken

    const reused = await call("archive_article", { id: "article-2", confirmationToken: token })

    expect(reused.body.error.code).toBe("CONFIRMATION_REQUIRED")
    expect(news.update).not.toHaveBeenCalled()
  })
})

describe("idempotency", () => {
  it("replays the stored response instead of acting twice", async () => {
    adminAction.findFirst.mockResolvedValue({
      id: "idem-1",
      details: { status: "completed", payloadHash: undefined, response: { article: { id: "new-1" } } },
    })

    const result = await call(
      "create_article",
      { title: "Nova", content: "Corpo com texto suficiente.", categorySlug: "economia" },
      { headers: { "idempotency-key": "retry-1" } },
    )

    expect(result.status).toBe(200)
    expect(result.body.meta.idempotentReplay).toBe(true)
    expect(news.create).not.toHaveBeenCalled()
  })

  it("refuses to reuse a key with a different payload", async () => {
    adminAction.findFirst.mockResolvedValue({
      id: "idem-1",
      details: { status: "completed", payloadHash: "a-different-hash", response: {} },
    })

    const result = await call(
      "create_article",
      { title: "Outra", content: "Corpo com texto suficiente.", categorySlug: "economia" },
      { headers: { "idempotency-key": "retry-1" } },
    )

    expect(result.status).toBe(409)
    expect(result.body.error.code).toBe("IDEMPOTENCY_PAYLOAD_MISMATCH")
  })

  it("reports a claim that is still running", async () => {
    adminAction.findFirst.mockResolvedValue({
      id: "idem-1",
      details: { status: "in_progress", payloadHash: undefined },
    })

    const result = await call(
      "create_article",
      { title: "Nova", content: "Corpo com texto suficiente.", categorySlug: "economia" },
      { headers: { "idempotency-key": "retry-1" } },
    )

    expect(result.status).toBe(409)
    expect(result.body.error.code).toBe("IDEMPOTENCY_IN_PROGRESS")
  })

  it("ignores the header on a read, which needs no protection", async () => {
    news.findFirst.mockResolvedValue(detailRow())

    const result = await call(
      "get_article",
      { id: "article-1" },
      { headers: { "idempotency-key": "retry-1" } },
    )

    expect(result.status).toBe(200)
    expect(result.body.meta.idempotentReplay).toBeUndefined()
  })
})

describe("failure containment", () => {
  it("never leaks an unexpected error message to the caller", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {})
    news.findFirst.mockRejectedValue(
      new Error('connect ECONNREFUSED postgres://user:secret@db.internal:5432'),
    )

    const result = await call("get_article", { id: "article-1" })

    expect(result.status).toBe(500)
    expect(result.body.error.code).toBe("INTERNAL_ERROR")
    expect(JSON.stringify(result.body)).not.toContain("secret")
    expect(JSON.stringify(result.body)).not.toContain("db.internal")
  })
})

describe("rate limiting", () => {
  it("blocks an agent that exceeds its window and says when to retry", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {})
    env.NOTILAB_AGENT_RATE_LIMIT = "3"
    news.findFirst.mockResolvedValue(detailRow())

    for (let i = 0; i < 3; i += 1) {
      const allowed = await call("get_article", { id: "article-1" })
      expect(allowed.status).toBe(200)
    }

    const blocked = await call("get_article", { id: "article-1" })
    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe("RATE_LIMITED")
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0)

    delete env.NOTILAB_AGENT_RATE_LIMIT
  })
})
