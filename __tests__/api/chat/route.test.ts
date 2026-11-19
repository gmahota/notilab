/**
 * `/api/chat` is the only AI call an anonymous visitor can trigger, so it is
 * the only one whose cost follows traffic rather than our own cron schedule.
 * `NOTIBOT_ENABLED` is the switch that decides whether it may spend, and it is
 * off by default on purpose — a forgotten variable should cost nothing.
 *
 * These tests assert on whether `callAI` was called, not on the wording of the
 * answer. The money is the invariant; the prose is not. A regression here would
 * not fail loudly, it would quietly start billing, which is exactly the kind of
 * defect a test has to hold down.
 */

import { NextRequest } from "next/server"

jest.mock("@/lib/ai-processing/call-ai", () => ({
  callAI: jest.fn(),
  hasAIProvider: jest.fn(() => true),
}))

jest.mock("@/lib/chat-service", () => ({
  retrieveContext: jest.fn(),
  buildGroundedPrompt: jest.fn(() => "prompt"),
  parseGroundedAnswer: jest.fn(() => ({
    answer: "composed answer",
    sourceIds: ["article-1"],
    suggestions: [],
  })),
}))

import { POST } from "@/app/api/chat/route"
import { callAI } from "@/lib/ai-processing/call-ai"
import { retrieveContext } from "@/lib/chat-service"

const callAIMock = callAI as unknown as jest.Mock
const retrieveContextMock = retrieveContext as unknown as jest.Mock

/** One real-shaped article, so the route takes the grounded path. */
const ARTICLE = {
  id: "article-1",
  title: "Uma notícia real",
  sourceName: "Example",
  publishedAt: new Date("2026-11-01T00:00:00.000Z"),
  summary: "resumo",
  content: "corpo",
}

function chatRequest(message = "o que há de novo?") {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  })
}

const originalFlag = process.env.NOTIBOT_ENABLED

beforeEach(() => {
  jest.clearAllMocks()
  retrieveContextMock.mockResolvedValue({ mode: "articles", articles: [ARTICLE] })
  callAIMock.mockResolvedValue("raw model output")
  delete process.env.NOTIBOT_ENABLED
})

afterAll(() => {
  if (originalFlag === undefined) delete process.env.NOTIBOT_ENABLED
  else process.env.NOTIBOT_ENABLED = originalFlag
})

describe("NOTIBOT_ENABLED unset (the default)", () => {
  it("never calls the model", async () => {
    await POST(chatRequest())
    expect(callAIMock).not.toHaveBeenCalled()
  })

  it("still answers, from real retrieved articles", async () => {
    const body = await (await POST(chatRequest())).json()

    expect(body.grounded).toBe(true)
    expect(body.composed).toBe(false)
    expect(body.sources).toHaveLength(1)
    expect(body.sources[0].title).toBe("Uma notícia real")
    // The headline it returns must be the one retrieval actually produced.
    expect(body.message).toContain("Uma notícia real")
  })

  it.each(["", "0", "false", "no", "off"])(
    "treats %p as off rather than as a value",
    async (value) => {
      process.env.NOTIBOT_ENABLED = value
      await POST(chatRequest())
      expect(callAIMock).not.toHaveBeenCalled()
    },
  )
})

describe("NOTIBOT_ENABLED set", () => {
  it.each(["1", "true", "yes", "YES", " true "])("calls the model for %p", async (value) => {
    process.env.NOTIBOT_ENABLED = value
    await POST(chatRequest())
    expect(callAIMock).toHaveBeenCalledTimes(1)
  })
})

describe("regardless of the switch", () => {
  it("does not reach the model when there is nothing to ground an answer in", async () => {
    process.env.NOTIBOT_ENABLED = "1"
    retrieveContextMock.mockResolvedValue({ mode: "none", articles: [] })

    const body = await (await POST(chatRequest())).json()

    expect(callAIMock).not.toHaveBeenCalled()
    expect(body.grounded).toBe(false)
  })

  it("rejects an empty message before retrieval or the model", async () => {
    process.env.NOTIBOT_ENABLED = "1"

    const response = await POST(chatRequest("   "))

    expect(response.status).toBe(400)
    expect(retrieveContextMock).not.toHaveBeenCalled()
    expect(callAIMock).not.toHaveBeenCalled()
  })
})
