/**
 * The rewrite worker's failure semantics, which are the whole point of it
 * being a separate module.
 *
 * § 3.5 of docs/editor/ingestion-editorial-workflow.md: a failed rewrite stays
 * failed. It never falls back to the source text as if it were ours — that is
 * the exact outcome the editorial gate exists to prevent, and reaching it
 * through an error handler instead of a decision would be worse, not better.
 * The enrichment path next door does fall back, and records the failure as a
 * success; these tests exist so that behaviour cannot leak in here.
 */

import { runRewriteBatch } from "@/lib/ai-processing/rewrite/worker"
import { prisma } from "@/lib/prisma"
import { callAI } from "@/lib/ai-processing/call-ai"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    articleAI: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock("@/lib/ai-processing/call-ai", () => ({
  callAI: jest.fn(),
  hasAIProvider: jest.fn(() => true),
}))

const articleAI = prisma.articleAI as unknown as Record<string, jest.Mock>
const ai = callAI as unknown as jest.Mock

const SOURCE = "Texto original do órgão de comunicação, com tamanho suficiente. ".repeat(12)
const BODY = "O nosso parágrafo, escrito de raiz, com substância bastante. ".repeat(6)

function stub(overrides: Record<string, unknown> = {}) {
  return {
    id: "stub-1",
    articleId: "article-1",
    rewriteAttempts: 0,
    article: {
      id: "article-1",
      title: "Manchete original",
      content: SOURCE,
      summary: "Resumo",
      sourceName: "Record",
      sourceUrl: "https://www.record.pt/x",
    },
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  articleAI.update.mockResolvedValue({})
})

describe("runRewriteBatch", () => {
  it("writes both columns and the timestamp together on success", async () => {
    articleAI.findMany.mockResolvedValue([stub()])
    ai.mockResolvedValue(JSON.stringify({ title: "A nossa manchete", content: BODY }))

    const result = await runRewriteBatch()

    expect(result.succeeded).toBe(1)
    expect(articleAI.update).toHaveBeenCalledWith({
      where: { id: "stub-1" },
      data: {
        titleRewritten: "A nossa manchete",
        contentRewritten: BODY.trim(),
        rewrittenAt: expect.any(Date),
        rewriteError: null,
      },
    })
  })

  it("never writes a body when the provider fails", async () => {
    articleAI.findMany.mockResolvedValue([stub()])
    ai.mockRejectedValue(new Error("provider 503"))

    const result = await runRewriteBatch()

    expect(result.failed).toBe(1)
    const written = articleAI.update.mock.calls[0][0].data
    expect(written.contentRewritten).toBeUndefined()
    expect(written.titleRewritten).toBeUndefined()
    expect(written.rewrittenAt).toBeUndefined()
    expect(written.rewriteAttempts).toBe(1)
    expect(written.rewriteError).toMatch(/provider 503/)
  })

  it("never writes the source text as if it were ours", async () => {
    articleAI.findMany.mockResolvedValue([stub()])
    ai.mockRejectedValue(new Error("timeout"))

    await runRewriteBatch()

    const written = JSON.stringify(articleAI.update.mock.calls[0][0].data)
    expect(written).not.toContain(SOURCE.slice(0, 40))
  })

  it("never stamps a truncated rewrite as finished", async () => {
    articleAI.findMany.mockResolvedValue([stub()])
    ai.mockResolvedValue(JSON.stringify({ title: "Manchete", content: "Curto demais." }))

    const result = await runRewriteBatch()

    expect(result.failed).toBe(1)
    const written = articleAI.update.mock.calls[0][0].data
    expect(written.rewrittenAt).toBeUndefined()
    expect(written.rewriteError).toMatch(/too short/)
  })

  it("exhausts the counter when the model judges the source insufficient", async () => {
    // Re-running cannot change the source, so spending two more provider calls
    // to be told the same thing is waste — it goes straight to a human.
    articleAI.findMany.mockResolvedValue([stub()])
    ai.mockResolvedValue("INSUFICIENTE")

    const result = await runRewriteBatch()

    expect(result.failed).toBe(1)
    expect(articleAI.update.mock.calls[0][0].data.rewriteAttempts).toBe(3)
  })

  it("skips a thin source without spending an attempt on it", async () => {
    articleAI.findMany.mockResolvedValue([stub({ article: { ...stub().article, content: "curto", summary: null } })])

    const result = await runRewriteBatch()

    expect(result.skipped).toBe(1)
    expect(ai).not.toHaveBeenCalled()
    expect(articleAI.update).not.toHaveBeenCalled()
  })

  it("selects only unrewritten articles below the retry cap, so a re-run converges", async () => {
    articleAI.findMany.mockResolvedValue([])

    await runRewriteBatch()

    const where = articleAI.findMany.mock.calls[0][0].where
    expect(where.rewrittenAt).toBeNull()
    expect(where.rewriteAttempts).toEqual({ lt: 3 })
  })

  it("saves each article as it completes rather than batching at the end", async () => {
    // Neon dropping mid-batch is a known failure here; per-article saves are
    // what make the next run resume instead of redoing the whole batch.
    articleAI.findMany.mockResolvedValue([stub(), stub({ id: "stub-2", articleId: "article-2" })])
    ai.mockResolvedValue(JSON.stringify({ title: "Manchete", content: BODY }))

    await runRewriteBatch()

    expect(articleAI.update).toHaveBeenCalledTimes(2)
  })
})
