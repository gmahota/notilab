/**
 * Covers the image-rights matcher: which image URLs ingestion may keep, and
 * that a rejected image never costs the article.
 *
 * The suffix-attack case is the one that must never regress — an allowlist
 * matched with a plain `includes`/`endsWith` on the raw host would hand
 * `cnn.com.fake.net` the credibility of `cnn.com`.
 */

import {
  checkImageRights,
  applyImageRights,
  LICENSED_IMAGE_REMOTE_PATTERNS,
} from "@/lib/ingestion/image-rights"
import type { NormalizedArticle } from "@/lib/ingestion/types"

function article(overrides: Partial<NormalizedArticle> = {}): NormalizedArticle {
  return {
    title:           "Chapo anuncia novo governo",
    content:         "Conteudo do artigo",
    summary:         "Resumo",
    imageUrl:        null,
    sourceUrl:       "https://www.cnn.com/2026/11/06/world/story",
    sourceName:      "CNN",
    publishedAt:     new Date("2026-11-06T08:00:00.000Z"),
    categorySlug:    "general",
    tags:            ["general"],
    importanceScore: 72,
    readTime:        2,
    ...overrides,
  }
}

describe("checkImageRights — licensed hosts (rule 1)", () => {
  it("accepts an apex licensed host", () => {
    const decision = checkImageRights(
      "https://unsplash.com/photos/abc/full.jpg",
      "https://example-outlet.com/story",
    )
    expect(decision.url).toBe("https://unsplash.com/photos/abc/full.jpg")
    expect(decision.rejectedAs).toBeNull()
  })

  it("accepts a subdomain of a licensed host", () => {
    const decision = checkImageRights(
      "https://images.unsplash.com/photo-123.jpg",
      "https://example-outlet.com/story",
    )
    expect(decision.url).toBe("https://images.unsplash.com/photo-123.jpg")
    expect(decision.rejectedAs).toBeNull()
  })

  it("accepts Wikimedia upload subdomain and NotiLab's own storage", () => {
    expect(
      checkImageRights(
        "https://upload.wikimedia.org/wikipedia/commons/a/ab/Photo.jpg",
        "https://example-outlet.com/story",
      ).url,
    ).not.toBeNull()
    expect(
      checkImageRights(
        "https://rthfa4e7dp.ufs.sh/f/filekey.jpg",
        "https://example-outlet.com/story",
      ).url,
    ).not.toBeNull()
  })

  it("rejects the suffix attack on a licensed host", () => {
    const decision = checkImageRights(
      "https://unsplash.com.evil.net/photo.jpg",
      "https://example-outlet.com/story",
    )
    expect(decision.url).toBeNull()
    expect(decision.rejectedAs).toBe("unlicensed-host")
  })
})

describe("checkImageRights — same origin as the article (rule 2)", () => {
  it("accepts the outlet's own image subdomain for its own story", () => {
    const decision = checkImageRights(
      "https://media.cnn.com/api/v1/images/stellar/prod/photo.jpg",
      "https://www.cnn.com/2026/11/06/world/story",
    )
    expect(decision.url).toBe("https://media.cnn.com/api/v1/images/stellar/prod/photo.jpg")
    expect(decision.rejectedAs).toBeNull()
  })

  it("accepts an apex image host for a subdomain article", () => {
    const decision = checkImageRights(
      "https://cnn.com/photo.jpg",
      "https://edition.cnn.com/2026/11/06/world/story",
    )
    expect(decision.rejectedAs).toBeNull()
  })

  it("rejects an unrelated host even when the article's outlet is allowed", () => {
    const decision = checkImageRights(
      "https://cdn.some-stock-library.io/photo.jpg",
      "https://www.cnn.com/2026/11/06/world/story",
    )
    expect(decision.url).toBeNull()
    expect(decision.rejectedAs).toBe("unlicensed-host")
    expect(decision.host).toBe("cdn.some-stock-library.io")
  })

  it("rejects the suffix attack: cnn.com.fake.net is not cnn.com", () => {
    const decision = checkImageRights(
      "https://cnn.com.fake.net/photo.jpg",
      "https://www.cnn.com/2026/11/06/world/story",
    )
    expect(decision.url).toBeNull()
    expect(decision.rejectedAs).toBe("unlicensed-host")
    expect(decision.host).toBe("cnn.com.fake.net")
  })

  it("does not let one article's source vouch for another outlet's image", () => {
    const decision = checkImageRights(
      "https://media.cnn.com/photo.jpg",
      "https://www.bbc.com/news/story",
    )
    expect(decision.url).toBeNull()
    expect(decision.rejectedAs).toBe("unlicensed-host")
  })
})

describe("checkImageRights — known outlet CDNs (rule 3)", () => {
  it("accepts the BBC asset domain for a BBC article", () => {
    const decision = checkImageRights(
      "https://ichef.bbci.co.uk/news/1024/branded_news/photo.jpg",
      "https://www.bbc.com/news/world-africa-123",
    )
    expect(decision.rejectedAs).toBeNull()
  })

  it("rejects the BBC asset domain for a different outlet's article", () => {
    const decision = checkImageRights(
      "https://ichef.bbci.co.uk/news/1024/branded_news/photo.jpg",
      "https://www.cnn.com/2026/11/06/world/story",
    )
    expect(decision.url).toBeNull()
    expect(decision.rejectedAs).toBe("unlicensed-host")
  })
})

describe("checkImageRights — malformed, missing and insecure URLs", () => {
  it("returns null without a rejection when there is no image", () => {
    for (const empty of [null, undefined, "", "   "]) {
      const decision = checkImageRights(empty, "https://www.cnn.com/story")
      expect(decision.url).toBeNull()
      expect(decision.rejectedAs).toBeNull()
    }
  })

  it("rejects an unusable URL", () => {
    const decision = checkImageRights("not a url at all", "https://www.cnn.com/story")
    expect(decision.url).toBeNull()
    expect(decision.rejectedAs).toBe("unusable-url")
    expect(decision.host).toBeNull()
  })

  it("rejects http even on an otherwise licensed host", () => {
    const decision = checkImageRights(
      "http://images.unsplash.com/photo-123.jpg",
      "https://www.cnn.com/story",
    )
    expect(decision.url).toBeNull()
    expect(decision.rejectedAs).toBe("insecure")
  })

  it("rejects an http image from the article's own origin", () => {
    const decision = checkImageRights(
      "http://media.cnn.com/photo.jpg",
      "https://www.cnn.com/story",
    )
    expect(decision.rejectedAs).toBe("insecure")
  })
})

describe("checkImageRights — non-photo assets, from the URL alone", () => {
  it.each([
    "https://media.cnn.com/pixel.gif",
    "https://media.cnn.com/t/1x1.png",
    "https://media.cnn.com/assets/favicon.ico",
    "https://media.cnn.com/assets/logo.png",
    "https://media.cnn.com/users/avatar.jpg",
    "https://media.cnn.com/img/60x40/photo.jpg",
    "https://media.cnn.com/img/100x75/photo.jpg",
    "https://media.cnn.com/img/80x60/photo.jpg",
    "https://media.cnn.com/photo.jpg?w=80",
  ])("rejects %s", (url) => {
    const decision = checkImageRights(url, "https://www.cnn.com/story")
    expect(decision.url).toBeNull()
    expect(decision.rejectedAs).toBe("non-photo")
  })

  it("keeps a full-size photo whose slug merely contains a blocked word", () => {
    const decision = checkImageRights(
      "https://media.cnn.com/img/1200x800/google-pixel-10-review.jpg?w=1200",
      "https://www.cnn.com/story",
    )
    expect(decision.rejectedAs).toBeNull()
  })

  /**
   * Regression: news CDNs put the crop *ratio* in the same `WxH` slot as real
   * dimensions, and reading `/16x9/` as a 16-pixel-wide image silently cost us
   * genuine Globo and CNN photographs. A ratio has at least one single-digit
   * side; a real thumbnail does not.
   */
  it.each([
    "https://s2-g1.glbimg.com/abc/e.jpg/16x9/original/photo.jpg",
    "https://s2-g1.glbimg.com/abc/e.jpg/4x3/smart/photo.jpg",
    "https://s2-g1.glbimg.com/abc/e.jpg/0x0/photo.jpg",
    "https://media.cnn.com/api/v1/images/stellar/prod/photo.jpg/16x9/photo.jpg",
    "https://media.cnn.com/img/3x2/photo.jpg",
    "https://media.cnn.com/img/9x16/photo.jpg",
    "https://media.cnn.com/img/21x9/photo.jpg",
  ])("keeps the aspect-ratio segment in %s", (url) => {
    const sourceUrl = url.includes("glbimg")
      ? "https://g1.globo.com/mundo/noticia/story.ghtml"
      : "https://www.cnn.com/2026/11/06/world/story"
    const decision = checkImageRights(url, sourceUrl)
    expect(decision.rejectedAs).toBeNull()
    expect(decision.url).toBe(url)
  })

  it("still rejects a 1x1 tracking pixel despite the ratio exemption", () => {
    // Caught by the segment-stem rule before the WxH rule is reached.
    const decision = checkImageRights(
      "https://media.cnn.com/img/1x1.gif",
      "https://www.cnn.com/story",
    )
    expect(decision.rejectedAs).toBe("non-photo")
  })

  it("still rejects real pixel dimensions below the minimum edge", () => {
    expect(
      checkImageRights(
        "https://media.cnn.com/img/652x1160/photo.jpg",
        "https://www.cnn.com/story",
      ).rejectedAs,
    ).toBeNull()
    expect(
      checkImageRights(
        "https://media.cnn.com/img/159x1160/photo.jpg",
        "https://www.cnn.com/story",
      ).rejectedAs,
    ).toBe("non-photo")
  })
})

describe("applyImageRights", () => {
  it("keeps every article and only nulls the images it cannot justify", () => {
    const input = [
      article({ imageUrl: "https://media.cnn.com/good.jpg" }),
      article({ imageUrl: "https://cdn.unknown-host.io/photo.jpg" }),
      article({ imageUrl: "http://media.cnn.com/insecure.jpg" }),
      article({ imageUrl: "nonsense" }),
      article({ imageUrl: null }),
    ]

    const report = applyImageRights(input)

    expect(report.articles).toHaveLength(input.length)
    expect(report.articles.map((a) => a.imageUrl)).toEqual([
      "https://media.cnn.com/good.jpg",
      null,
      null,
      null,
      null,
    ])
    expect(report.rejected).toEqual({
      unlicensedHost: 1,
      insecure: 1,
      nonPhoto: 0,
      unusableUrl: 1,
    })
    // Titles untouched: a failed image must never cost the article.
    expect(report.articles.every((a) => a.title === input[0].title)).toBe(true)
  })

  it("reports distinct unlicensed hosts by name, sorted", () => {
    const report = applyImageRights([
      article({ imageUrl: "https://zcdn.example.org/a.jpg" }),
      article({ imageUrl: "https://acdn.example.org/b.jpg" }),
      article({ imageUrl: "https://zcdn.example.org/c.jpg" }),
    ])
    expect(report.unlicensedImageHosts).toEqual([
      "acdn.example.org",
      "zcdn.example.org",
    ])
    expect(report.otherDroppedImageHosts).toEqual([])
  })

  it("keeps allowlist candidates apart from hosts dropped for other reasons", () => {
    const report = applyImageRights([
      // No licence basis — a genuine allowlist candidate.
      article({ imageUrl: "https://cdn.unknown-host.io/photo.jpg" }),
      // Allowed host, but the asset is a tracking pixel — not a candidate.
      article({ imageUrl: "https://media.cnn.com/pixel.gif" }),
      // Allowed host over http — not a candidate either.
      article({ imageUrl: "http://media.cnn.com/photo.jpg" }),
    ])

    expect(report.unlicensedImageHosts).toEqual(["cdn.unknown-host.io"])
    expect(report.otherDroppedImageHosts).toEqual(["media.cnn.com"])
    expect(report.rejected).toEqual({
      unlicensedHost: 1,
      insecure: 1,
      nonPhoto: 1,
      unusableUrl: 0,
    })
  })

  it("does not list a host when nothing was rejected", () => {
    const report = applyImageRights([
      article({ imageUrl: "https://images.pexels.com/photos/1/pexels-photo.jpeg" }),
    ])
    expect(report.unlicensedImageHosts).toEqual([])
    expect(report.otherDroppedImageHosts).toEqual([])
  })
})

describe("LICENSED_IMAGE_REMOTE_PATTERNS", () => {
  it("still carries the UploadThing host and its original pathname", () => {
    expect(LICENSED_IMAGE_REMOTE_PATTERNS).toContainEqual({
      protocol: "https",
      hostname: "rthfa4e7dp.ufs.sh",
      pathname: "/f",
    })
  })

  it("covers each licensed domain at the apex and as a wildcard, over https only", () => {
    expect(LICENSED_IMAGE_REMOTE_PATTERNS).toContainEqual({
      protocol: "https",
      hostname: "unsplash.com",
    })
    expect(LICENSED_IMAGE_REMOTE_PATTERNS).toContainEqual({
      protocol: "https",
      hostname: "**.unsplash.com",
    })
    expect(LICENSED_IMAGE_REMOTE_PATTERNS.every((p) => p.protocol === "https")).toBe(true)
  })
})
