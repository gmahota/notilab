/**
 * GET /api/news is a public endpoint, and it was the only one of the four
 * public read routes that did not filter on status. Every sibling gets this
 * right — app/api/news/feed, app/api/news/category/[slug] and
 * app/api/news/[id] all pin `status: "PUBLISHED"` — so unpublishing or
 * archiving an article removed it from the feed, the category pages and the
 * detail route while it stayed readable here. Unreviewed DRAFT and
 * PENDING_REVIEW articles were publicly readable through this route.
 *
 * These tests assert on the `where` clause handed to Prisma rather than on the
 * response body: the filter is the invariant, and a mocked Prisma cannot
 * enforce it for us. The route only ever calls findMany once, so
 * `mock.calls[0][0].where` is unambiguous.
 */

import { NextRequest } from "next/server"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    news: {
      findMany: jest.fn(),
    },
  },
}))

import { GET } from "@/app/api/news/route"
import { prisma } from "@/lib/prisma"

const findMany = prisma.news.findMany as unknown as jest.Mock

/** A row shaped the way the route's transform expects to find it. */
function publishedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "article-1",
    title: "Published story",
    summary: "A summary",
    content: "Body",
    imageUrl: null,
    sourceUrl: "https://example.com/story",
    sourceName: "Example",
    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    category: { name: "Tecnologia", slug: "tecnologia", color: "#007BFF" },
    tags: ["ai"],
    trending: false,
    priority: 0,
    aiSummary: null,
    sentiment: null,
    readTime: 3,
    reactions: [{ type: "LIKE" }],
    readHistory: [],
    ...overrides,
  }
}

/** The `where` object the route passed to prisma.news.findMany. */
function capturedWhere(): Record<string, unknown> {
  expect(findMany).toHaveBeenCalledTimes(1)
  return findMany.mock.calls[0][0].where as Record<string, unknown>
}

async function get(query = ""): Promise<Response> {
  return GET(new NextRequest(`http://localhost:3000/api/news${query}`))
}

beforeEach(() => {
  findMany.mockResolvedValue([publishedRow()])
})

describe("GET /api/news status filter", () => {
  it("only ever asks Prisma for PUBLISHED articles", async () => {
    await get()
    expect(capturedWhere()).toEqual({ status: "PUBLISHED" })
  })

  it("keeps the status filter when a category is selected", async () => {
    await get("?category=tecnologia")
    expect(capturedWhere()).toEqual({
      status: "PUBLISHED",
      category: { slug: "tecnologia" },
    })
  })

  it("keeps the status filter for category=all", async () => {
    // "all" is the sentinel the UI sends for no category; it must not be
    // treated as a slug, and it must not drop the status filter either.
    await get("?category=all")
    expect(capturedWhere()).toEqual({ status: "PUBLISHED" })
  })

  it("ANDs the status filter with the search OR rather than being replaced by it", async () => {
    // The search branch assigns `where.OR`. If status ever moved inside that
    // OR — or the clause were rebuilt — drafts would match on title again.
    await get("?search=eleicoes")
    const where = capturedWhere()
    expect(where.status).toBe("PUBLISHED")
    expect(where.OR).toEqual([
      { title: { contains: "eleicoes", mode: "insensitive" } },
      { summary: { contains: "eleicoes", mode: "insensitive" } },
      { tags: { has: "eleicoes" } },
    ])
  })

  it("keeps the status filter across every sortBy branch", async () => {
    for (const sortBy of ["recent", "popular", "views", "trending", "ranked", "bogus"]) {
      findMany.mockClear()
      await get(`?sortBy=${sortBy}`)
      expect(capturedWhere()).toEqual({ status: "PUBLISHED" })
    }
  })

  it("cannot be talked out of the filter by a query parameter", async () => {
    // There is no `status` parameter, and there must not be one: this endpoint
    // is unauthenticated. An admin surface that needs DRAFT or PENDING_REVIEW
    // articles needs its own authenticated route.
    await get("?status=DRAFT&published=false")
    expect(capturedWhere()).toEqual({ status: "PUBLISHED" })
  })
})

describe("GET /api/news response", () => {
  it("still returns the transformed articles Prisma gave it", async () => {
    // The filter must not have broken the payload contract clients read.
    const response = await get()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      id: "article-1",
      title: "Published story",
      category: { name: "Tecnologia", slug: "tecnologia", color: "#007BFF" },
      reactions: [{ type: "LIKE", count: 1 }],
    })
  })

  it("returns an empty list rather than an error when nothing is published", async () => {
    findMany.mockResolvedValue([])
    const response = await get()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })
})
