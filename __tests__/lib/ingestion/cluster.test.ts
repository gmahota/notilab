/**
 * Covers story clustering: which articles ingestion would recognise as the
 * same story across outlets, and — just as important — which it must not.
 *
 * Two cases must never regress. An empty headline must not match another empty
 * headline, or every untitled article collapses into one cluster and a writing
 * step is handed a pile of unrelated text as though it were one story. And
 * clustering must be order-independent: the provider returns articles in
 * whatever order it likes, and a grouping that changes with the input order
 * cannot be reviewed or reproduced.
 */

import {
  storyTokens,
  storySimilarity,
  clusterByStory,
  multiSourceClusters,
  DEFAULT_THRESHOLD,
} from "@/lib/ingestion/cluster"
import type { NormalizedArticle } from "@/lib/ingestion/types"

function article(overrides: Partial<NormalizedArticle> = {}): NormalizedArticle {
  return {
    title:           "FC Porto bate Benfica (3-2) no Dragão Arena",
    content:         "Conteudo do artigo",
    summary:         "Resumo",
    imageUrl:        null,
    sourceUrl:       "https://www.record.pt/porto-benfica",
    sourceName:      "Record",
    publishedAt:     new Date("2026-11-12T20:00:00Z"),
    categorySlug:    "desporto",
    tags:            [],
    importanceScore: 50,
    readTime:        3,
    ...overrides,
  }
}

describe("storyTokens", () => {
  it("drops accents, case, punctuation and short words, and truncates to a stem", () => {
    expect(storyTokens({ title: "FC Porto bate Benfica (3-2) no Dragão Arena" })).toEqual(
      new Set(["porto", "bate", "benfi", "draga", "arena"]),
    )
  })

  it("matches the inflected forms that name a story", () => {
    // The case that made the first real run return zero clusters: two outlets
    // on the same talks, one writing Ukraine/Russia and the other
    // Ukrainian/Russian. Exact token equality finds nothing in common.
    expect(storyTokens({ title: "Ukraine Russia war latest" })).toEqual(
      new Set(["ukrai", "russi", "lates"]),
    )
    expect(storyTokens({ title: "Ukrainian Russian officials" })).toEqual(
      new Set(["ukrai", "russi", "offic"]),
    )
  })

  it("drops connectives that would inflate overlap between unrelated headlines", () => {
    expect(storyTokens({ title: "Depois sobre quando" }).size).toBe(0)
  })
})

describe("storySimilarity", () => {
  it("scores the same story from two outlets above the default threshold", () => {
    const score = storySimilarity(
      { title: "FC Porto bate Benfica (3-2) no Dragão Arena" },
      { title: "Benfica perde no Dragão" },
    )
    expect(score).toBeCloseTo(1 / 3, 5)
    expect(score).toBeGreaterThan(DEFAULT_THRESHOLD)
  })

  it("scores unrelated headlines at zero", () => {
    expect(
      storySimilarity(
        { title: "Chapo anuncia novo governo em Maputo" },
        { title: "Liverpool lose to Fenerbahce in Champions League" },
      ),
    ).toBe(0)
  })

  it("scores two empty headlines 0, never 1", () => {
    expect(storySimilarity({ title: "!!!" }, { title: "???" })).toBe(0)
  })
})

describe("clusterByStory", () => {
  it("groups two outlets covering the same story", () => {
    const clusters = clusterByStory([
      article(),
      article({
        title: "Benfica perde no Dragão",
        sourceName: "A Bola",
        sourceUrl: "https://www.abola.pt/benfica-dragao",
      }),
    ])

    expect(clusters).toHaveLength(1)
    expect(clusters[0].members).toHaveLength(2)
    // Both carry the same publishedAt, so sourceUrl breaks the tie and abola.pt
    // sorts first — the anchor is whichever the ordering picks, never the input
    // order. That is the determinism the reproducibility test relies on.
    expect(clusters[0].sources).toEqual(["A Bola", "Record"])
  })

  it("keeps unrelated stories apart", () => {
    const clusters = clusterByStory([
      article(),
      article({
        title: "Chapo anuncia novo governo em Maputo",
        sourceName: "Jornal Económico",
        sourceUrl: "https://jornaleconomico.pt/chapo",
      }),
    ])

    expect(clusters).toHaveLength(2)
    expect(multiSourceClusters(clusters)).toHaveLength(0)
  })

  it("refuses to group similar headlines published outside the window", () => {
    const clusters = clusterByStory(
      [
        article(),
        article({
          title: "Benfica perde no Dragão",
          sourceName: "A Bola",
          sourceUrl: "https://www.abola.pt/benfica-dragao",
          publishedAt: new Date("2026-10-12T20:00:00Z"),
        }),
      ],
      { windowHours: 48 },
    )

    expect(clusters).toHaveLength(2)
  })

  it("does not collapse untitled articles into one cluster", () => {
    const clusters = clusterByStory([
      article({ title: "!!!", sourceUrl: "https://a.example/1", sourceName: "A" }),
      article({ title: "???", sourceUrl: "https://b.example/2", sourceName: "B" }),
    ])

    expect(clusters).toHaveLength(2)
  })

  it("produces the same clusters whatever order the provider returned", () => {
    const articles = [
      article(),
      article({
        title: "Benfica perde no Dragão",
        sourceName: "A Bola",
        sourceUrl: "https://www.abola.pt/benfica-dragao",
      }),
      article({
        title: "Chapo anuncia novo governo em Maputo",
        sourceName: "Jornal Económico",
        sourceUrl: "https://jornaleconomico.pt/chapo",
      }),
    ]

    const forward = clusterByStory(articles)
    const reversed = clusterByStory([...articles].reverse())

    expect(forward.map((c) => c.members.map((m) => m.sourceUrl).sort())).toEqual(
      reversed.map((c) => c.members.map((m) => m.sourceUrl).sort()),
    )
  })

  it("returns single-outlet stories too, so the threshold can be judged", () => {
    const clusters = clusterByStory([article()])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].sources).toEqual(["Record"])
    expect(multiSourceClusters(clusters)).toHaveLength(0)
  })
})
