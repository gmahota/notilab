/**
 * lib/ranking.ts decides the order of every feed in the product, and it is
 * pure arithmetic over five weighted dimensions — the kind of code where a
 * changed constant produces a plausible-looking but wrong feed, with no error
 * anywhere. AGENTS.md § AI-Content Correctness Rules treats ranking scores as
 * an invariant ("computed from real signals"), so the formula's shape is worth
 * pinning down rather than trusting on read.
 *
 * Two things these tests deliberately lock in rather than assert as "correct":
 * the substring trend matching (see "over-matches on substrings") and the
 * saturating still-trending bonus (see "longevity bonus"). Both are current
 * behaviour with real consequences; if either is changed on purpose, the
 * failing test is the place to record the decision.
 *
 * dimRecency reads Date.now(), so every case runs against a frozen clock.
 */

import {
  FEED_WEIGHTS,
  rankArticles,
  scoreArticle,
  type FeedMode,
  type ScoringInput,
} from "@/lib/ranking"

/** Arbitrary but fixed instant; all publishedAt values are derived from it. */
const NOW = new Date("2026-09-03T12:00:00.000Z")

const HOUR_MS = 3_600_000

/** A publishedAt `hours` before the frozen now. */
function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * HOUR_MS)
}

/**
 * A neutral input: fresh, untagged, mid-trust source, no user context.
 * Each case overrides only the dimension it is about, so an unexpected
 * interaction between dimensions shows up as a failure here rather than
 * being masked by a bespoke fixture per test.
 */
function input(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    publishedAt: NOW,
    tags: [],
    sourcePriority: 50,
    aiImportanceScore: null,
    newsImportanceScore: 0,
    trendingKeywords: [],
    ...overrides,
  }
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW)
})

afterEach(() => {
  jest.useRealTimers()
})

describe("weight profiles", () => {
  const modes = Object.keys(FEED_WEIGHTS) as FeedMode[]

  it.each(modes)("%s weights sum to exactly 1.0", (mode) => {
    // This is what guarantees finalScore stays on the documented 0-100 scale:
    // every dimension is 0-100, so the weighted sum only stays in range while
    // the weights sum to 1. A profile edited to sum to 1.2 would silently push
    // scores against the Math.min(100) ceiling and flatten the top of the feed.
    const sum = Object.values(FEED_WEIGHTS[mode]).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1.0, 10)
  })

  it("covers exactly the four documented feed modes", () => {
    expect(modes.sort()).toEqual(["category", "global", "homepage", "trending"])
  })

  it("lets trend overlap dominate the trending profile", () => {
    // The trending feed is the only place trendBoost outweighs everything else
    // combined short of a tie; asserting it keeps a future re-balance honest.
    expect(FEED_WEIGHTS.trending.trendBoost).toBe(0.5)
    expect(FEED_WEIGHTS.trending.trendBoost).toBeGreaterThan(
      FEED_WEIGHTS.homepage.trendBoost,
    )
  })
})

describe("recency decay", () => {
  it("scores a just-published article at the full 100", () => {
    expect(scoreArticle(input()).breakdown.recency).toBeCloseTo(100, 6)
  })

  it("halves every 24 hours", () => {
    // The documented 24h half-life, stated as the property rather than as a
    // reimplementation of the exponential.
    expect(scoreArticle(input({ publishedAt: hoursAgo(24) })).breakdown.recency).toBeCloseTo(50, 6)
    expect(scoreArticle(input({ publishedAt: hoursAgo(48) })).breakdown.recency).toBeCloseTo(25, 6)
    expect(scoreArticle(input({ publishedAt: hoursAgo(72) })).breakdown.recency).toBeCloseTo(12.5, 6)
  })

  it("decays toward zero without ever reaching a hard cutoff", () => {
    const veryOld = scoreArticle(input({ publishedAt: hoursAgo(24 * 30) })).breakdown.recency
    expect(veryOld).toBeGreaterThan(0)
    expect(veryOld).toBeLessThan(0.001)
  })

  it("clamps a future publishedAt to 100 instead of exceeding it", () => {
    // Ingested feeds do carry future timestamps (timezone bugs upstream).
    // Without the Math.max(0, …) on hoursAgo, e^(+λt) would score such an
    // article above 100 and park it at the top of every feed indefinitely.
    const future = new Date(NOW.getTime() + 48 * HOUR_MS)
    expect(scoreArticle(input({ publishedAt: future })).breakdown.recency).toBe(100)
  })
})

describe("trend boost", () => {
  it("is zero when the article has no tags", () => {
    expect(
      scoreArticle(input({ tags: [], trendingKeywords: ["ukraine"] })).breakdown.trendBoost,
    ).toBe(0)
  })

  it("is zero when nothing is trending", () => {
    expect(
      scoreArticle(input({ tags: ["ukraine"], trendingKeywords: [] })).breakdown.trendBoost,
    ).toBe(0)
  })

  it("reaches 100 at three matching tags and caps there", () => {
    const three = scoreArticle(
      input({
        tags: ["ukraine", "russia", "nato"],
        trendingKeywords: ["ukraine", "russia", "nato"],
      }),
    ).breakdown.trendBoost
    expect(three).toBe(100)

    const four = scoreArticle(
      input({
        tags: ["ukraine", "russia", "nato", "hormuz"],
        trendingKeywords: ["ukraine", "russia", "nato", "hormuz"],
      }),
    ).breakdown.trendBoost
    expect(four).toBe(100)
  })

  it("scales linearly below the three-match target", () => {
    expect(
      scoreArticle(input({ tags: ["ukraine"], trendingKeywords: ["ukraine"] })).breakdown
        .trendBoost,
    ).toBeCloseTo(100 / 3, 6)
  })

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(
      scoreArticle(input({ tags: ["  Ukraine "], trendingKeywords: ["UKRAINE"] })).breakdown
        .trendBoost,
    ).toBeCloseTo(100 / 3, 6)
  })

  it("over-matches on substrings, in both directions", () => {
    // Current behaviour, not an endorsement: the match is
    // `kw.includes(tag) || tag.includes(kw)`, so a two-letter tag matches any
    // keyword containing it. "ai" scores against a "spain" trend. This is the
    // same class of over-broad matching that filled the feed with junk on the
    // ingestion side; narrowing it is a ranking-behaviour decision, so it is
    // pinned here rather than quietly relied upon.
    expect(
      scoreArticle(input({ tags: ["ai"], trendingKeywords: ["spain"] })).breakdown.trendBoost,
    ).toBeGreaterThan(0)

    // The reverse direction: a broad tag swallowed by a specific keyword.
    expect(
      scoreArticle(input({ tags: ["madrid"], trendingKeywords: ["real madrid"] })).breakdown
        .trendBoost,
    ).toBeGreaterThan(0)
  })

  it("applies the longevity bonus only past 72 hours", () => {
    const tags = ["ukraine", "russia"]
    const trendingKeywords = ["ukraine", "russia"]

    const fresh = scoreArticle(input({ publishedAt: hoursAgo(70), tags, trendingKeywords }))
      .breakdown.trendBoost
    const aged = scoreArticle(input({ publishedAt: hoursAgo(100), tags, trendingKeywords }))
      .breakdown.trendBoost

    expect(fresh).toBeCloseTo(200 / 3, 6)
    expect(aged).toBeGreaterThan(fresh)
  })

  it("saturates the longevity bonus at 100 for every eligible article", () => {
    // Worth stating plainly: the bonus needs base >= 60, and base only takes
    // the values 0, 33.3, 66.7, 100 for 0-3 matches. So both eligible cases
    // (2 and 3 matches) multiply to at least 100 and the 1.5x multiplier can
    // never produce an intermediate value — the boost is effectively binary.
    // toBeCloseTo, not toBe: 2/3*100*1.5 is 99.99999999999999 in floating
    // point, so that case slips under Math.min(100) rather than being clamped
    // by it. Any change to TREND_MATCH_TARGET or TREND_ALIVE_MIN_BOOST changes
    // this shape.
    for (const matches of [2, 3]) {
      const tags = ["ukraine", "russia", "nato"].slice(0, matches)
      expect(
        scoreArticle(input({ publishedAt: hoursAgo(100), tags, trendingKeywords: tags }))
          .breakdown.trendBoost,
      ).toBeCloseTo(100, 6)
    }

    // One match stays below the threshold and gets no bonus at all.
    expect(
      scoreArticle(
        input({ publishedAt: hoursAgo(100), tags: ["ukraine"], trendingKeywords: ["ukraine"] }),
      ).breakdown.trendBoost,
    ).toBeCloseTo(100 / 3, 6)
  })
})

describe("source trust", () => {
  it("treats a missing source as neutral rather than untrusted", () => {
    // An article with no linked NewsSource must not be penalised as if it came
    // from a low-credibility one — most ingested articles have no source row.
    expect(scoreArticle(input({ sourcePriority: null })).breakdown.sourceTrust).toBe(50)
  })

  it("clamps out-of-range priorities into 0-100", () => {
    expect(scoreArticle(input({ sourcePriority: 250 })).breakdown.sourceTrust).toBe(100)
    expect(scoreArticle(input({ sourcePriority: -40 })).breakdown.sourceTrust).toBe(0)
  })

  it("discounts the final score by 30% below the trust threshold", () => {
    const trusted = scoreArticle(input({ sourcePriority: 20 })).finalScore
    const untrusted = scoreArticle(input({ sourcePriority: 19 })).finalScore

    // 20 is the threshold itself and is not discounted; 19 is.
    const trustedAtNineteen =
      scoreArticle(input({ sourcePriority: 19 })).breakdown.sourceTrust * 0.15 +
      100 * 0.3 +
      50 * 0.1
    expect(untrusted).toBeCloseTo(trustedAtNineteen * 0.7, 2)
    expect(untrusted).toBeLessThan(trusted)
  })

  it("discounts a genuine zero priority instead of reading it as neutral", () => {
    // The discount check is `(sourcePriority ?? 50) < 20`, and ?? does not
    // catch 0 — so a source explicitly scored 0 is correctly discounted. A
    // switch to `||` here would flip that to neutral and silently promote the
    // least trustworthy sources.
    const zero = scoreArticle(input({ sourcePriority: 0 }))
    expect(zero.breakdown.sourceTrust).toBe(0)

    const undiscounted = 100 * 0.3 + 0 * 0.15 + 50 * 0.1
    expect(zero.finalScore).toBeCloseTo(undiscounted * 0.7, 2)
  })
})

describe("AI importance", () => {
  it("prefers the AI score when enrichment has run", () => {
    expect(
      scoreArticle(input({ aiImportanceScore: 90, newsImportanceScore: 10 })).breakdown
        .aiImportance,
    ).toBe(90)
  })

  it("falls back to the ingestion score while enrichment is pending", () => {
    expect(
      scoreArticle(input({ aiImportanceScore: null, newsImportanceScore: 42 })).breakdown
        .aiImportance,
    ).toBe(42)
  })

  it("uses an AI score of zero rather than falling through to the fallback", () => {
    // Same ?? -vs- || trap as the trust threshold: an article the AI actively
    // judged unimportant must not inherit the ingestion score instead.
    expect(
      scoreArticle(input({ aiImportanceScore: 0, newsImportanceScore: 80 })).breakdown
        .aiImportance,
    ).toBe(0)
  })

  it("clamps both the AI score and the fallback into 0-100", () => {
    expect(scoreArticle(input({ aiImportanceScore: 130 })).breakdown.aiImportance).toBe(100)
    expect(
      scoreArticle(input({ aiImportanceScore: null, newsImportanceScore: -5 })).breakdown
        .aiImportance,
    ).toBe(0)
  })
})

describe("user affinity", () => {
  it("is neutral for an anonymous visitor", () => {
    // 50, not 0: the feed has to be fair when there is no user context at all.
    expect(scoreArticle(input()).breakdown.userAffinity).toBe(50)
    expect(scoreArticle(input({ userCategoryIds: [] })).breakdown.userAffinity).toBe(50)
  })

  it("boosts a preferred category and penalises the rest", () => {
    const withPrefs = (articleCategoryId: string) =>
      scoreArticle(input({ userCategoryIds: ["cat-football"], articleCategoryId })).breakdown
        .userAffinity

    expect(withPrefs("cat-football")).toBe(100)
    expect(withPrefs("cat-politics")).toBe(20)
  })

  it("sits between the two when the article has no category", () => {
    expect(
      scoreArticle(input({ userCategoryIds: ["cat-football"] })).breakdown.userAffinity,
    ).toBe(40)
  })
})

describe("composite score", () => {
  it("is the weighted sum of the five dimensions", () => {
    // homepage: 0.30 recency + 0.25 trend + 0.15 trust + 0.20 ai + 0.10 affinity
    // = 100*0.30 + 0*0.25 + 80*0.15 + 90*0.20 + 50*0.10 = 65
    const { finalScore } = scoreArticle(
      input({ sourcePriority: 80, aiImportanceScore: 90, newsImportanceScore: 10 }),
    )
    expect(finalScore).toBe(65)
  })

  it("defaults to the homepage profile", () => {
    const scored = input({ sourcePriority: 80, aiImportanceScore: 90 })
    expect(scoreArticle(scored).finalScore).toBe(scoreArticle(scored, "homepage").finalScore)
  })

  it("rates a trend-heavy article highest in the trending profile", () => {
    const trendHeavy = input({
      publishedAt: hoursAgo(48),
      tags: ["ukraine", "russia", "nato"],
      trendingKeywords: ["ukraine", "russia", "nato"],
      sourcePriority: 80,
      aiImportanceScore: 30,
    })

    const trending = scoreArticle(trendHeavy, "trending").finalScore
    for (const mode of ["homepage", "category", "global"] as const) {
      expect(trending).toBeGreaterThan(scoreArticle(trendHeavy, mode).finalScore)
    }
  })

  it("rates an AI-important but ageing article higher in global than homepage", () => {
    // The global profile is the one stored in News.rankingScore, and it is
    // meant to be the most stable: it leads on AI importance (0.25 vs 0.20)
    // and leans less on recency (0.25 vs 0.30) than homepage does. An article
    // the AI rated highly two days ago is exactly where that shows.
    const ageingButImportant = input({
      publishedAt: hoursAgo(48),
      aiImportanceScore: 100,
    })

    expect(scoreArticle(ageingButImportant, "global").finalScore).toBeGreaterThan(
      scoreArticle(ageingButImportant, "homepage").finalScore,
    )
  })

  it("stays within 0-100 across the extremes of every dimension", () => {
    const best = scoreArticle(
      input({
        tags: ["ukraine", "russia", "nato"],
        trendingKeywords: ["ukraine", "russia", "nato"],
        sourcePriority: 100,
        aiImportanceScore: 100,
        articleCategoryId: "cat-football",
        userCategoryIds: ["cat-football"],
      }),
    )
    expect(best.finalScore).toBe(100)

    const worst = scoreArticle(
      input({
        publishedAt: hoursAgo(24 * 365),
        sourcePriority: 0,
        aiImportanceScore: 0,
        articleCategoryId: "cat-politics",
        userCategoryIds: ["cat-football"],
      }),
    )
    expect(worst.finalScore).toBeGreaterThanOrEqual(0)
    expect(worst.finalScore).toBeLessThan(5)
  })

  it("rounds to two decimals so stored scores compare consistently", () => {
    // finalScore is persisted to News.rankingScore and ordered on directly, so
    // it must not carry float noise that makes two equal articles jitter.
    const { finalScore } = scoreArticle(input({ sourcePriority: 19 }))
    expect(finalScore).toBe(Math.round(finalScore * 100) / 100)
    expect(String(finalScore).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2)
  })
})

describe("rankArticles", () => {
  const articles = [
    { id: "old-untagged", publishedAt: hoursAgo(96), importanceScore: 10 },
    { id: "fresh-trending", publishedAt: hoursAgo(1), tags: ["ukraine"], importanceScore: 80 },
    { id: "mid", publishedAt: hoursAgo(24), importanceScore: 40 },
  ]

  it("orders by descending score and attaches it to each article", () => {
    const ranked = rankArticles(articles, { trendingKeywords: ["ukraine"] })

    expect(ranked.map((a) => a.id)).toEqual(["fresh-trending", "mid", "old-untagged"])
    for (const article of ranked) {
      expect(typeof article.rankScore).toBe("number")
    }
    expect(ranked[0].rankScore).toBeGreaterThan(ranked[2].rankScore)
  })

  it("preserves every other field on the article", () => {
    const [top] = rankArticles([{ ...articles[1], sourceName: "BBC" }], {})
    expect(top).toMatchObject({ id: "fresh-trending", sourceName: "BBC" })
  })

  it("does not mutate the input array or its elements", () => {
    // It is called on server-rendered page data that is reused afterwards, so
    // an in-place sort or an injected rankScore would leak into the response.
    const original = [...articles]
    rankArticles(articles, { trendingKeywords: ["ukraine"] })

    expect(articles).toEqual(original)
    expect(articles.map((a) => a.id)).toEqual(["old-untagged", "fresh-trending", "mid"])
    expect(articles[0]).not.toHaveProperty("rankScore")
  })

  it("resolves source trust through the sourceScores map", () => {
    const article = { publishedAt: NOW, importanceScore: 50, sourceName: "Tabloid" }

    const [distrusted] = rankArticles([article], { sourceScores: { Tabloid: 5 } })
    const [trusted] = rankArticles([article], { sourceScores: { Tabloid: 95 } })

    expect(distrusted.rankScore).toBeLessThan(trusted.rankScore)
  })

  it("treats a source missing from the map as neutral, not untrusted", () => {
    const article = { publishedAt: NOW, importanceScore: 50, sourceName: "Unknown Wire" }

    const [unmapped] = rankArticles([article], { sourceScores: {} })
    const [neutral] = rankArticles([{ ...article, sourceName: undefined }], {})

    // Both resolve to sourcePriority: null -> trust 50 and no discount, so an
    // unrecognised source is not silently punished as low-credibility.
    expect(unmapped.rankScore).toBe(neutral.rankScore)
  })

  it("returns an empty array unchanged", () => {
    expect(rankArticles([], { trendingKeywords: ["ukraine"] })).toEqual([])
  })

  it("scores against the ingestion importance only, never the AI score", () => {
    // rankArticles hardcodes aiImportanceScore: null — it works off in-memory
    // article rows that carry no ArticleAI relation. Feeds that need the AI
    // signal must use the cron-computed News.rankingScore instead.
    const [low] = rankArticles([{ publishedAt: NOW, importanceScore: 0 }], {})
    const [high] = rankArticles([{ publishedAt: NOW, importanceScore: 100 }], {})

    expect(high.rankScore).toBeGreaterThan(low.rankScore)
  })
})
