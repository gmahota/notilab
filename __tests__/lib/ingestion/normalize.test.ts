/**
 * Covers `normalizeArticles` — the drop rules it enforces and the fields it
 * derives — plus the categoriser and the taxonomy parity that categoriser
 * depends on.
 *
 * Two things must never regress here:
 *
 *  1. A slug `CATEGORY_RULES` can emit must have a `Category` row waiting for
 *     it. When it does not, nothing fails — the article is quietly demoted to
 *     the fallback, which is the silent mis-categorisation bug roadmap #15
 *     already fixed once.
 *  2. Keywords must not match more than they name. The matcher is a plain
 *     substring test, so a short keyword like "inter" would match
 *     "international" and hand unrelated articles to `desporto`. The rules are
 *     deliberately multiword for that reason, and this suite pins it.
 */

import {
  CATEGORY_SLUGS,
  FALLBACK_CATEGORY_SLUG,
  detectCategorySlug,
  normalizeArticles,
} from "@/lib/ingestion/normalize"
import {
  CATEGORY_CATALOG,
  catalogEntriesWithNoRule,
  slugsMissingFromCatalog,
} from "@/lib/ingestion/category-catalog"
import type { RawArticle } from "@/lib/ingestion/types"

describe("taxonomy parity", () => {
  it("has a catalog row for every slug the categoriser can emit", () => {
    expect(slugsMissingFromCatalog(CATEGORY_SLUGS)).toEqual([])
  })

  it("includes the fallback slug, which also needs a row", () => {
    expect(CATEGORY_SLUGS).toContain(FALLBACK_CATEGORY_SLUG)
    expect(CATEGORY_CATALOG[FALLBACK_CATEGORY_SLUG]).toBeDefined()
  })

  it("emits no duplicate slugs", () => {
    expect(new Set(CATEGORY_SLUGS).size).toBe(CATEGORY_SLUGS.length)
  })

  it("reports catalog entries no rule can reach, so a dead slug is visible", () => {
    // Retired categories legitimately keep their rows. This asserts the helper
    // reports the state rather than asserting the state itself — the list is an
    // editorial decision, not an invariant.
    expect(Array.isArray(catalogEntriesWithNoRule(CATEGORY_SLUGS))).toBe(true)
  })
})

describe("detectCategorySlug — the 2026-11-12 scope", () => {
  it.each([
    ["Arsenal beat Liverpool in the Premier League", "desporto"],
    ["Benfica contrata avançado", "desporto"],
    ["Real Madrid gana el clásico", "desporto"],
    ["Juventus held by Napoli in Serie A", "desporto"],
    ["Paris Saint-Germain sign a midfielder", "desporto"],
    ["Taylor Swift announces a new tour", "celebridades"],
    ["Zendaya on the red carpet", "celebridades"],
    ["Wall Street closes higher as the Federal Reserve holds", "economia"],
    ["Euronext sobe com a descida das taxas de juro", "economia"],
  ])("routes %j to %s", (title, expected) => {
    expect(detectCategorySlug(title, "")).toBe(expected)
  })

  it("falls back when nothing matches", () => {
    expect(detectCategorySlug("Council approves new bus route", "")).toBe(
      FALLBACK_CATEGORY_SLUG,
    )
  })

  it("matches on the body as well as the title", () => {
    expect(detectCategorySlug("Match report", "Chelsea FC won away")).toBe("desporto")
  })

  it("is case-insensitive", () => {
    expect(detectCategorySlug("TAYLOR SWIFT TOUR", "")).toBe("celebridades")
  })
})

describe("detectCategorySlug — keywords must not over-match", () => {
  // The matcher lowercases but does not strip accents, unlike the relevance
  // gate in quality.ts. Both spellings are listed in the rules for that reason,
  // and these cases are what prove the listing is still complete.
  it.each([
    ["Beyoncé lança novo álbum", "celebridades"],
    ["Beyonce releases a new album", "celebridades"],
    ["A inflação abranda em Outubro", "economia"],
    ["Inflacao abranda em Outubro", "economia"],
  ])("handles the accented and unaccented spelling of %j", (title, expected) => {
    expect(detectCategorySlug(title, "")).toBe(expected)
  })

  it.each([
    "The international summit opens in Geneva",
    "Interest rates were not discussed",
  ])("does not let a short football keyword match %j", (title) => {
    // "inter" would match both of these; the rule says "inter milan".
    expect(detectCategorySlug(title, "")).toBe(FALLBACK_CATEGORY_SLUG)
  })

  it("does not route a generic Porto city story to desporto", () => {
    // The rule is "fc porto", not "porto" — a bare "porto" matched tourism and
    // port-wine copy before.
    expect(detectCategorySlug("Porto elected best European destination", "")).toBe(
      FALLBACK_CATEGORY_SLUG,
    )
  })

  it("routes any Kardashian the relevance gate admits, not only Kim", () => {
    // providers.ts admits bare "kardashian" in mustMatch, so a Khloé or Kourtney
    // story clears the gate. While the rule carried only "kim kardashian" those
    // articles reached the fallback instead — the gate and the categoriser have to
    // admit the same people.
    expect(detectCategorySlug("Khloe Kardashian launches a new brand", "")).toBe(
      "celebridades",
    )
    expect(detectCategorySlug("Kourtney Kardashian on the red carpet", "")).toBe(
      "celebridades",
    )
  })

  it("does not route a generic celebrity-free entertainment story", () => {
    expect(detectCategorySlug("Local theatre announces winter season", "")).toBe(
      FALLBACK_CATEGORY_SLUG,
    )
  })
})

describe("detectCategorySlug — first match wins", () => {
  it("prefers desporto when a story mentions both football and a market term", () => {
    // Order in CATEGORY_RULES is the tie-break and is deliberate: a transfer-fee
    // story mentioning the stock market is sport, not economics.
    const slug = detectCategorySlug(
      "Manchester United shares rise on Premier League deal",
      "The stock market reacted to the transfer window",
    )
    expect(slug).toBe("desporto")
  })

  it("still routes the retired slugs when an article genuinely is about them", () => {
    // No sync query feeds these under the current scope, but the rules remain so
    // a stray lands somewhere truthful rather than in the fallback.
    expect(detectCategorySlug("Frelimo e Renamo reúnem-se em Maputo", "")).toBe(
      "mocambique",
    )
    expect(detectCategorySlug("Xenophobia flares again", "")).toBe("africa-do-sul")
  })
})

// ─── normalizeArticles ────────────────────────────────────────────────────────

const LEAD = "lorem ipsum ".repeat(30)

function raw(overrides: Partial<RawArticle> = {}): RawArticle {
  return {
    title:       "Arsenal beat Liverpool in the Premier League",
    content:     `Match report. ${LEAD}`,
    description: `Arsenal won at Anfield. ${LEAD}`,
    imageUrl:    null,
    sourceUrl:   "https://www.bbc.com/sport/football/12345",
    sourceName:  "BBC Sport",
    publishedAt: new Date(Date.now() - 2 * 3_600_000),
    provider:    "gnews",
    mustMatch:   ["arsenal"],
    ...overrides,
  }
}

describe("normalizeArticles — what it drops", () => {
  const dropCases: [string, Partial<RawArticle>][] = [
    ["an empty title",              { title: "" }],
    ["a whitespace-only title",     { title: "   " }],
    ["an empty sourceUrl",          { sourceUrl: "" }],
    ["a whitespace-only sourceUrl", { sourceUrl: "   " }],
    ["an unparseable publishedAt",  { publishedAt: new Date("not a date") }],
    ["the NewsAPI [Removed] title", { title: "[Removed]" }],
    ["the NewsAPI removed.com URL", { sourceUrl: "https://removed.com" }],
  ]

  it.each(dropCases)("drops %s", (_label, overrides) => {
    expect(normalizeArticles([raw(overrides)])).toEqual([])
  })

  it("drops an article carrying no publishedAt at all", () => {
    // The guard is `isNaN(a.publishedAt?.getTime())`. A provider that omits the
    // field must not reach the database with an Invalid Date, which would then
    // poison every recency window that keys off publishedAt.
    expect(normalizeArticles([raw({ publishedAt: undefined as unknown as Date })])).toEqual([])
  })

  it("keeps the survivors of a mixed batch, in order", () => {
    const out = normalizeArticles([
      raw({ title: "Benfica contrata avançado" }),
      raw({ title: "[Removed]" }),
      raw({ title: "Real Madrid gana el clásico" }),
    ])
    expect(out.map((a) => a.title)).toEqual([
      "Benfica contrata avançado",
      "Real Madrid gana el clásico",
    ])
  })
})

describe("normalizeArticles — derived fields", () => {
  it("strips HTML and collapses runs of whitespace", () => {
    const [out] = normalizeArticles([
      raw({
        title:       "<h1>Arsenal   beat</h1> Liverpool",
        content:     `<p>Match   report.</p> ${LEAD}`,
        description: `<p>Arsenal   won.</p> ${LEAD}`,
      }),
    ])
    expect(out.title).toBe("Arsenal beat Liverpool")
    expect(out.content).not.toMatch(/[<>]/)
    expect(out.summary).not.toMatch(/[<>]/)
    expect(out.content).not.toMatch(/\s{2,}/)
  })

  it("falls back to the description when the provider sends no content", () => {
    const [out] = normalizeArticles([
      raw({ content: "", description: `Arsenal won at Anfield. ${LEAD}` }),
    ])
    expect(out.content).toBe(`Arsenal won at Anfield. ${LEAD}`.trim())
  })

  it("falls back to the title when there is no body at all", () => {
    // An article with no body still has to be storable — content is non-null in
    // the schema, and the title is the only honest thing left to put there.
    const [out] = normalizeArticles([
      raw({ title: "Benfica contrata avançado", content: "", description: "" }),
    ])
    expect(out.content).toBe("Benfica contrata avançado")
    expect(out.summary).toBe("Benfica contrata avançado")
  })

  it("takes the summary from the description when there is one", () => {
    const [out] = normalizeArticles([
      raw({ description: "Arsenal won at Anfield.", content: `Long report. ${LEAD}` }),
    ])
    expect(out.summary).toBe("Arsenal won at Anfield.")
  })

  it("truncates the summary to 200 characters of content when there is no description", () => {
    const [out] = normalizeArticles([raw({ description: "", content: "k".repeat(500) })])
    expect(out.summary).toBe("k".repeat(200))
  })

  it("trims the sourceUrl", () => {
    const [out] = normalizeArticles([raw({ sourceUrl: "  https://www.bbc.com/a  " })])
    expect(out.sourceUrl).toBe("https://www.bbc.com/a")
  })

  it("carries imageUrl, sourceName and publishedAt through untouched", () => {
    const publishedAt = new Date("2026-11-12T20:00:00.000Z")
    const [out] = normalizeArticles([
      raw({ imageUrl: "https://img.example/1.jpg", sourceName: "BBC Sport", publishedAt }),
    ])
    expect(out.imageUrl).toBe("https://img.example/1.jpg")
    expect(out.sourceName).toBe("BBC Sport")
    expect(out.publishedAt).toBe(publishedAt)
  })

  it("categorises from the normalised title and body together", () => {
    const [out] = normalizeArticles([
      raw({ title: "Match report", content: `Chelsea FC won away. ${LEAD}`, description: "" }),
    ])
    expect(out.categorySlug).toBe("desporto")
    expect(out.tags).toContain("desporto")
  })
})

describe("normalizeArticles — tags", () => {
  it("takes at most four title keywords plus the category slug", () => {
    const [out] = normalizeArticles([
      raw({ title: "Arsenal beat Liverpool in the Premier League" }),
    ])
    expect(out.tags).toEqual(["arsenal", "beat", "liverpool", "premier", "desporto"])
  })

  it("drops stop words and words of three characters or fewer", () => {
    const [out] = normalizeArticles([
      raw({ title: "The quick brown fox", content: "", description: "" }),
    ])
    expect(out.tags).toEqual(["quick", "brown", FALLBACK_CATEGORY_SLUG])
  })

  it("strips punctuation before splitting", () => {
    const [out] = normalizeArticles([
      raw({ title: "Arsenal's late winner!", content: "", description: "" }),
    ])
    expect(out.tags).toEqual(["arsenals", "late", "winner", FALLBACK_CATEGORY_SLUG])
  })

  it("de-duplicates a keyword that is already the category slug", () => {
    const [out] = normalizeArticles([
      raw({ title: "Benfica domina o desporto nacional", content: "", description: "" }),
    ])
    expect(out.tags).toEqual(["benfica", "domina", "desporto", "nacional"])
    expect(out.tags.filter((t) => t === "desporto")).toHaveLength(1)
  })
})

describe("normalizeArticles — importanceScore recency bands", () => {
  const bands: [number, number][] = [
    [0.5, 95],
    [3, 85],
    [12, 72],
    [48, 55],
    [100, 35],
    [300, 15],
  ]

  it.each(bands)("scores an article %s hours old at %s", (ageHours, expected) => {
    const [out] = normalizeArticles([
      raw({ publishedAt: new Date(Date.now() - ageHours * 3_600_000) }),
    ])
    expect(out.importanceScore).toBe(expected)
  })
})

describe("normalizeArticles — readTime", () => {
  it("never reports less than a minute", () => {
    const [out] = normalizeArticles([raw({ content: "Three words only", description: "" })])
    expect(out.readTime).toBe(1)
  })

  it("estimates at about 200 words a minute", () => {
    const [out] = normalizeArticles([
      raw({ content: "palavra ".repeat(500), description: "" }),
    ])
    expect(out.readTime).toBe(3)
  })
})
