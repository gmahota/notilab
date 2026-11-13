/**
 * Covers the three ingestion quality gates — source, shape, relevance.
 *
 * The relevance gate is the one that earns its keep. Providers do full-text OR
 * matching, so an article comes back for merely mentioning a query term
 * somewhere in the body; `mustMatch` against the title and lead is what
 * separates "about this" from "mentions this". It matches accent-blind
 * substrings, which is why a short term like "inter" must be spelled out in the
 * query definition — these cases pin that behaviour so the next person widening
 * `SYNC_QUERIES` can see what the matcher will and will not do.
 */

import { applyQualityGate, isRelevant } from "@/lib/ingestion/quality"
import type { RawArticle } from "@/lib/ingestion/types"

const LEAD = "x".repeat(250)

function article(overrides: Partial<RawArticle> = {}): RawArticle {
  return {
    title:       "Arsenal beat Liverpool",
    content:     `Match report. ${LEAD}`,
    description: `Match report. ${LEAD}`,
    imageUrl:    null,
    sourceUrl:   "https://www.bbc.com/sport/football/12345",
    sourceName:  "BBC Sport",
    publishedAt: new Date("2026-11-12T20:00:00.000Z"),
    provider:    "gnews",
    mustMatch:   ["premier league", "arsenal"],
    ...overrides,
  }
}

describe("source gate", () => {
  it("accepts an allowlisted host", () => {
    const report = applyQualityGate([article()])
    expect(report.kept).toHaveLength(1)
    expect(report.rejected.source).toBe(0)
  })

  it("accepts a subdomain of an allowlisted host", () => {
    const report = applyQualityGate([
      article({ sourceUrl: "https://www.cnbc.com/2026/11/12/markets.html" }),
    ])
    expect(report.kept).toHaveLength(1)
  })

  it("rejects a host that is not on the allowlist", () => {
    const report = applyQualityGate([
      article({ sourceUrl: "https://some-random-blog.net/post" }),
    ])
    expect(report.kept).toHaveLength(0)
    expect(report.rejected.source).toBe(1)
  })

  it("rejects a blocked aggregator even though it looks like news", () => {
    const report = applyQualityGate([article({ sourceUrl: "https://www.msn.com/story" })])
    expect(report.kept).toHaveLength(0)
    expect(report.rejected.source).toBe(1)
  })

  it("is not fooled by an allowlisted domain appearing as a suffix", () => {
    // `cnn.com.fake.net` must not inherit cnn.com's credibility.
    const report = applyQualityGate([
      article({ sourceUrl: "https://cnn.com.fake.net/story" }),
    ])
    expect(report.kept).toHaveLength(0)
    expect(report.rejected.source).toBe(1)
  })

  it("reports each dropped hostname once, sorted, for tuning the allowlist", () => {
    const report = applyQualityGate([
      article({ sourceUrl: "https://zzz-blog.net/a" }),
      article({ sourceUrl: "https://aaa-blog.net/b" }),
      article({ sourceUrl: "https://zzz-blog.net/c" }),
    ])
    expect(report.rejectedSources).toEqual(["aaa-blog.net", "zzz-blog.net"])
  })
})

describe("shape gate", () => {
  it("rejects a scene-release listing", () => {
    const report = applyQualityGate([
      article({ title: "Some.Show.S01E01.1080p.WEB.H264-GROUP" }),
    ])
    expect(report.kept).toHaveLength(0)
    expect(report.rejected.shape).toBe(1)
  })

  it("rejects a link roundup", () => {
    const report = applyQualityGate([article({ title: "Monday news and links" })])
    expect(report.rejected.shape).toBe(1)
  })

  it("rejects a liveblog index", () => {
    const report = applyQualityGate([article({ title: "LIVE: transfer deadline day" })])
    expect(report.rejected.shape).toBe(1)
  })

  it("rejects a body too short to summarise", () => {
    const report = applyQualityGate([
      article({ content: "Too short.", description: "Too short." }),
    ])
    expect(report.kept).toHaveLength(0)
    expect(report.rejected.shape).toBe(1)
  })

  it("accepts a body at the 200-character floor", () => {
    const body = "y".repeat(200)
    const report = applyQualityGate([article({ content: body, description: body })])
    expect(report.kept).toHaveLength(1)
  })
})

describe("relevance gate — isRelevant", () => {
  it("accepts when the term is in the title", () => {
    expect(
      isRelevant(article({ title: "Premier League roundup", mustMatch: ["premier league"] })),
    ).toBe(true)
  })

  it("accepts when the term is in the lead", () => {
    expect(
      isRelevant(
        article({
          title: "Match report",
          description: `Arsenal won away. ${LEAD}`,
          mustMatch: ["arsenal"],
        }),
      ),
    ).toBe(true)
  })

  it("rejects a passing mention beyond the 400-character lead", () => {
    expect(
      isRelevant(
        article({
          title: "Council budget approved",
          description: `${"z".repeat(500)} arsenal`,
          mustMatch: ["arsenal"],
        }),
      ),
    ).toBe(false)
  })

  it("matches accent-blind in both directions", () => {
    expect(
      isRelevant(article({ title: "Inflação abranda", mustMatch: ["inflacao"] })),
    ).toBe(true)
    expect(
      isRelevant(article({ title: "Inflacao abranda", mustMatch: ["inflação"] })),
    ).toBe(true)
    expect(
      isRelevant(article({ title: "Beyoncé em digressão", mustMatch: ["beyonce"] })),
    ).toBe(true)
  })

  it("requires a multi-word term to match as a phrase", () => {
    expect(
      isRelevant(
        article({
          title: "Real estate prices in Madrid",
          description: `Nothing to do with football. ${LEAD}`,
          mustMatch: ["real madrid"],
        }),
      ),
    ).toBe(false)
  })

  it("matches as a substring, which is why short terms must be spelled out", () => {
    // This is the trap: "inter" is satisfied by "international". The queries say
    // "inter milan" precisely so this cannot happen in production.
    expect(isRelevant(article({ title: "International summit", mustMatch: ["inter"] }))).toBe(
      true,
    )
    expect(
      isRelevant(
        article({
          title: "International summit",
          description: `Diplomacy only. ${LEAD}`,
          mustMatch: ["inter milan"],
        }),
      ),
    ).toBe(false)
  })

  it("accepts everything when a query declares no terms", () => {
    expect(isRelevant(article({ title: "Anything at all", mustMatch: [] }))).toBe(true)
  })
})

describe("applyQualityGate — gate order", () => {
  it("counts a disallowed source once and does not also count its shape", () => {
    const report = applyQualityGate([
      article({ sourceUrl: "https://some-random-blog.net/x", title: "news and links" }),
    ])
    expect(report.rejected).toEqual({ source: 1, shape: 0, relevance: 0 })
  })

  it("counts shape before relevance", () => {
    const report = applyQualityGate([
      article({ content: "short", description: "short", mustMatch: ["nothing here"] }),
    ])
    expect(report.rejected).toEqual({ source: 0, shape: 1, relevance: 0 })
  })

  it("keeps a mixed batch and reports each rejection reason", () => {
    const report = applyQualityGate([
      article(),
      article({ sourceUrl: "https://some-random-blog.net/x" }),
      article({ title: "Weekend news and links" }),
      article({ title: "Council budget", description: `No match. ${LEAD}`, mustMatch: ["arsenal"] }),
    ])
    expect(report.kept).toHaveLength(1)
    expect(report.rejected).toEqual({ source: 1, shape: 1, relevance: 1 })
  })
})
