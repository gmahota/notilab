/**
 * The editorial business layer. These cases cover the rules that must hold no
 * matter which caller asks — an agent, a future admin UI, a script:
 *
 *   - an article reaches PUBLISHED only from APPROVED (business-rules.md);
 *   - the update surface is a whitelist, so status, provenance and computed
 *     scores are unreachable;
 *   - repeating a lifecycle call is a no-op, not an error, so agents can retry;
 *   - contradictory search filters are refused rather than silently resolved.
 */

import {
  canTransition,
  createArticle,
  searchArticles,
  transitionArticle,
  updateArticle,
} from "@/lib/editorial/article-service"
import { AgentError } from "@/lib/agent/errors"
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
  },
}))

const news = prisma.news as unknown as Record<string, jest.Mock>
const category = prisma.category as unknown as Record<string, jest.Mock>

/** A row shaped like what loadForMutation selects. */
function mutationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "article-1",
    status: "DRAFT",
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

/** A row shaped like what getArticle selects. */
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

describe("canTransition", () => {
  it("permits the documented lifecycle", () => {
    expect(canTransition("DRAFT", "PENDING_REVIEW")).toBe(true)
    expect(canTransition("PENDING_REVIEW", "APPROVED")).toBe(true)
    expect(canTransition("APPROVED", "PUBLISHED")).toBe(true)
    expect(canTransition("PUBLISHED", "APPROVED")).toBe(true)
  })

  it("refuses to publish anything that has not been approved", () => {
    expect(canTransition("DRAFT", "PUBLISHED")).toBe(false)
    expect(canTransition("PENDING_REVIEW", "PUBLISHED")).toBe(false)
  })

  it("keeps REJECTED and ARCHIVED terminal", () => {
    expect(canTransition("ARCHIVED", "DRAFT")).toBe(false)
    expect(canTransition("REJECTED", "DRAFT")).toBe(false)
  })
})

describe("transitionArticle", () => {
  it("blocks publishing a draft with an actionable error code", async () => {
    news.findUnique.mockResolvedValue(mutationRow({ status: "DRAFT" }))

    await expect(transitionArticle("article-1", "PUBLISHED")).rejects.toMatchObject({
      code: "ARTICLE_NOT_APPROVED",
    })
    expect(news.update).not.toHaveBeenCalled()
  })

  it("publishes an approved article", async () => {
    news.findUnique.mockResolvedValue(mutationRow({ status: "APPROVED" }))
    news.findFirst.mockResolvedValue(detailRow({ status: "PUBLISHED" }))
    news.update.mockResolvedValue({})

    const result = await transitionArticle("article-1", "PUBLISHED")

    expect(news.update).toHaveBeenCalledWith({
      where: { id: "article-1" },
      data: { status: "PUBLISHED" },
    })
    expect(result.changes.status).toEqual({ before: "APPROVED", after: "PUBLISHED" })
  })

  it("leaves publishedAt alone unless one is supplied", async () => {
    // For a syndicated story publishedAt is the outlet's date. Rewriting it to
    // "now" on every republish would reorder the public feed.
    news.findUnique.mockResolvedValue(mutationRow({ status: "APPROVED" }))
    news.findFirst.mockResolvedValue(detailRow({ status: "PUBLISHED" }))
    news.update.mockResolvedValue({})

    await transitionArticle("article-1", "PUBLISHED")
    expect(news.update.mock.calls[0][0].data).not.toHaveProperty("publishedAt")
  })

  it("treats a repeat of the same transition as a successful no-op", async () => {
    // What makes publish_article safe for an agent to retry after a timeout.
    news.findUnique.mockResolvedValue(mutationRow({ status: "PUBLISHED" }))
    news.findFirst.mockResolvedValue(detailRow({ status: "PUBLISHED" }))

    const result = await transitionArticle("article-1", "PUBLISHED")

    expect(result.alreadyInState).toBe(true)
    expect(result.changes).toEqual({})
    expect(news.update).not.toHaveBeenCalled()
  })

  it("refuses an illegal move and reports what was allowed", async () => {
    news.findUnique.mockResolvedValue(mutationRow({ status: "ARCHIVED" }))

    try {
      await transitionArticle("article-1", "PENDING_REVIEW")
      throw new Error("expected a rejection")
    } catch (err) {
      const agentError = err as AgentError
      expect(agentError.code).toBe("INVALID_STATUS_TRANSITION")
      expect(agentError.details?.allowed).toEqual([])
    }
  })

  it("reports a missing article rather than creating one", async () => {
    news.findUnique.mockResolvedValue(null)
    await expect(transitionArticle("nope", "APPROVED")).rejects.toMatchObject({
      code: "ARTICLE_NOT_FOUND",
    })
  })
})

describe("updateArticle", () => {
  it("writes only the fields that changed", async () => {
    news.findUnique.mockResolvedValue(mutationRow())
    news.findFirst.mockResolvedValue(detailRow())
    news.update.mockResolvedValue({})

    const result = await updateArticle("article-1", {
      title: "Título novo",
      // Unchanged — must not appear in the update or in the audit diff.
      priority: "NORMAL",
    })

    expect(news.update.mock.calls[0][0].data).toEqual({ title: "Título novo" })
    expect(Object.keys(result.changes)).toEqual(["title"])
  })

  it("refuses a no-op update instead of writing an empty audit row", async () => {
    news.findUnique.mockResolvedValue(mutationRow())

    await expect(updateArticle("article-1", { title: "Título original" })).rejects.toMatchObject({
      code: "NO_FIELDS_TO_UPDATE",
    })
    expect(news.update).not.toHaveBeenCalled()
  })

  it("resolves a category slug and refuses an unknown one", async () => {
    news.findUnique.mockResolvedValue(mutationRow())
    category.findUnique.mockResolvedValue(null)

    await expect(
      updateArticle("article-1", { categorySlug: "nao-existe" }),
    ).rejects.toMatchObject({ code: "CATEGORY_NOT_FOUND" })

    category.findUnique.mockResolvedValue({ id: "cat-2" })
    news.findFirst.mockResolvedValue(detailRow({ categoryId: "cat-2" }))
    news.update.mockResolvedValue({})

    const result = await updateArticle("article-1", { categorySlug: "economia" })
    expect(news.update.mock.calls[0][0].data).toEqual({ categoryId: "cat-2" })
    expect(result.changes.categoryId).toEqual({ before: "cat-1", after: "cat-2" })
  })
})

describe("createArticle", () => {
  it("always creates a DRAFT, never a published article", async () => {
    // AGENTS.md § AI-Content Correctness: AI-originated content must not bypass
    // the editorial workflow. There is no parameter that changes this.
    category.findUnique.mockResolvedValue({ id: "cat-1" })
    news.create.mockResolvedValue({ id: "new-1" })
    news.findFirst.mockResolvedValue(detailRow({ id: "new-1" }))

    await createArticle(
      { title: "Nova notícia", content: "Corpo com texto suficiente.", categorySlug: "economia" },
      "abacus",
    )

    expect(news.create.mock.calls[0][0].data.status).toBe("DRAFT")
  })

  it("stamps agent-authored articles with honest provenance", async () => {
    // Never an invented outlet: the byline names the agent, and the source URI
    // is internal and traceable.
    category.findUnique.mockResolvedValue({ id: "cat-1" })
    news.create.mockResolvedValue({ id: "new-1" })
    news.findFirst.mockResolvedValue(detailRow({ id: "new-1" }))

    await createArticle(
      { title: "Nova notícia", content: "Corpo com texto suficiente.", categorySlug: "economia" },
      "abacus",
    )

    const data = news.create.mock.calls[0][0].data
    expect(data.sourceName).toBe("NotiLab (agent:abacus)")
    expect(data.sourceUrl).toMatch(/^notilab:agent\/abacus\//)
  })

  it("rejects a non-http source or image URL", async () => {
    category.findUnique.mockResolvedValue({ id: "cat-1" })

    await expect(
      createArticle(
        {
          title: "Nova",
          content: "Corpo com texto suficiente.",
          categorySlug: "economia",
          imageUrl: "javascript:alert(1)",
        },
        "abacus",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" })
  })

  it("maps a duplicate source URL to a distinct error code", async () => {
    category.findUnique.mockResolvedValue({ id: "cat-1" })
    news.create.mockRejectedValue(new Error("Unique constraint failed on the fields: (`sourceUrl`)"))

    await expect(
      createArticle(
        {
          title: "Nova",
          content: "Corpo com texto suficiente.",
          categorySlug: "economia",
          sourceUrl: "https://example.test/story",
        },
        "abacus",
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE_SOURCE_URL" })
  })
})

describe("searchArticles", () => {
  beforeEach(() => {
    news.findMany.mockResolvedValue([])
    news.count.mockResolvedValue(0)
  })

  it("refuses contradictory filters rather than picking one", async () => {
    await expect(
      searchArticles({ status: "DRAFT", published: true }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" })
  })

  it("refuses an inverted date range", async () => {
    await expect(
      searchArticles({
        publishedFrom: new Date("2026-09-01T00:00:00Z"),
        publishedTo: new Date("2026-08-01T00:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" })
  })

  it("caps the page size whatever the caller asks for", async () => {
    await searchArticles({ limit: 5_000 })
    expect(news.findMany.mock.calls[0][0].take).toBe(50)
  })

  it("treats a placeholder image as no image", async () => {
    // The whole point of hasImage: /placeholder.svg is what the feed renders
    // when an article has none, so it must not count as having one.
    await searchArticles({ hasImage: false })

    const where = JSON.stringify(news.findMany.mock.calls[0][0].where)
    expect(where).toContain("/placeholder.svg")
  })

  it("maps published:false to everything not live", async () => {
    await searchArticles({ published: false })
    expect(news.findMany.mock.calls[0][0].where).toEqual({
      AND: [{ NOT: { status: "PUBLISHED" } }],
    })
  })

  it("reports hasMore from the total, not from the page length", async () => {
    news.findMany.mockResolvedValue([])
    news.count.mockResolvedValue(120)

    const result = await searchArticles({ limit: 20, offset: 0 })
    expect(result.pagination).toEqual({ limit: 20, offset: 0, total: 120, hasMore: true })
  })
})
