/**
 * Covers the categoriser and the taxonomy parity it depends on.
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
} from "@/lib/ingestion/normalize"
import {
  CATEGORY_CATALOG,
  catalogEntriesWithNoRule,
  slugsMissingFromCatalog,
} from "@/lib/ingestion/category-catalog"

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
