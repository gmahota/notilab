/**
 * image-rights.ts — Decides whether an ingested article's image may be shown.
 *
 * Phase 1 of the image rule in docs/editor/ingestion-editorial-workflow.md § 4.
 * Until now lib/ingestion/normalize.ts copied `imageUrl` straight from the
 * provider into the database, so NotiLab hotlinked and re-published pictures
 * from any host a news API happened to return, with no licence basis at all.
 *
 * What this module does, and only this:
 *   - mechanical, URL-only checks. No network requests — this runs inside the
 *     ingestion cron, which has a tight time budget, and a HEAD request per
 *     article would multiply the run's latency by the batch size.
 *   - fail-closed. An unknown host is rejected, never given the benefit of the
 *     doubt (§ 4.1).
 *   - never drops an article. A rejected image becomes `imageUrl = null` and
 *     the article continues without it (§ 4.2). `hasImage` in
 *     lib/editorial/article-service.ts already models "no image" downstream.
 *
 * What this module deliberately does NOT do: judge whether the picture depicts
 * the story (§ 4.1.6). That is editorial judgment and belongs to the REVISOR;
 * no URL check can stand in for it.
 *
 * Three acceptance rules, most defensible first — see `checkImageRights`.
 */

import { hostOf, matchesDomain } from "./url-host"
import type { NormalizedArticle } from "./types"

/**
 * Rule 1 — hosts whose images carry an open or explicit licence, with the
 * basis recorded per domain. Matched as domain-or-subdomain, so
 * `images.unsplash.com` and `upload.wikimedia.org` are covered by their apex.
 *
 * Adding an entry here is an editorial decision requiring SUPERVISOR or above
 * and must record the licence basis (§ 4.3) — it is not a config tweak.
 *
 * Not listed on purpose: Flickr, Getty, AFP and the other stock/agency hosts.
 * Their licence varies per file and cannot be established from the URL, which
 * is the only thing this module can check.
 */
export const LICENSED_IMAGE_DOMAINS: readonly string[] = [
  // Wikimedia Commons — every file must be under a free licence (CC BY / BY-SA
  // / public domain). Attribution is still owed per file, and is the writer's
  // job when they place the image.
  "wikimedia.org",
  // Unsplash Licence — free to use, including commercially, without permission.
  "unsplash.com",
  // Pexels Licence — free to use, including commercially, without permission.
  "pexels.com",
  // NotiLab's own UploadThing storage. We own or have cleared whatever we
  // upload. Same host as the one already in next.config.ts.
  "rthfa4e7dp.ufs.sh",
]

/**
 * Rule 3 — image CDNs operated by an outlet whose articles we already accept,
 * for the cases rule 2 (same origin) misses because the pictures live on a
 * separate asset domain.
 *
 * Keys are outlet domains; values are that outlet's *own* registrable asset
 * domains, matched as domain-or-subdomain. Only first-party asset domains that
 * are verifiably the outlet's are listed — a guessed hostname belonging to
 * somebody else would make us hotlink a stranger's server from an allowlist
 * that claims we checked. Grow this from the rejected-host report the pipeline
 * prints, not from memory.
 */
export const OUTLET_IMAGE_CDNS: Readonly<Record<string, readonly string[]>> = {
  // BBC serves article images from its bbci.co.uk asset domain (ichef.bbci.co.uk).
  "bbc.com":          ["bbci.co.uk"],
  "bbc.co.uk":        ["bbci.co.uk"],
  // Guardian Media's image domain (i.guim.co.uk / media.guim.co.uk).
  "theguardian.com":  ["guim.co.uk"],
  // New York Times static assets (static01.nyt.com).
  "nytimes.com":      ["nyt.com"],
  // Globo's image domain (s2-g1.glbimg.com and siblings).
  "globo.com":        ["glbimg.com"],
  "g1.globo.com":     ["glbimg.com"],
  "oglobo.globo.com": ["glbimg.com"],
  // ESPN's asset domain (a.espncdn.com).
  "espn.com":         ["espncdn.com"],
  "espn.com.br":      ["espncdn.com"],
}

/**
 * Smallest edge, in pixels, that a picture can declare in its URL and still be
 * a photograph rather than a thumbnail, icon or tracking pixel.
 */
const MIN_DECLARED_EDGE_PX = 160

/**
 * Smallest value in a `WxH` path segment that can still be a pixel count
 * rather than one side of an aspect ratio. Two digits, because every crop
 * ratio a news CDN uses has a single-digit side (16x9, 4x3, 3x2, 21x9, 9x16,
 * 0x0). The known exception is 16x10, which this rule would read as a tiny
 * image — no news CDN observed uses it, and the cost would be one missing
 * photograph, never a wrong one.
 */
const MIN_RATIO_FREE_VALUE = 10

/**
 * Names that are never a news photograph: tracking pixels, chrome and avatars.
 *
 * Matched against a whole path segment, with any file extension removed —
 * `/pixel.gif`, `/assets/logo.png` and `/avatars/x.jpg` are rejected, while a
 * story slug that merely contains one of the words ("google-pixel-10-review")
 * is not. Substring matching was tried first and failed exactly there.
 */
const NON_PHOTO_SEGMENTS: ReadonlySet<string> = new Set([
  "1x1", "pixel", "pixels", "beacon", "beacons", "spacer",
  "transparent", "blank", "empty", "track", "tracking",
  "favicon", "favicons", "avatar", "avatars",
  "sprite", "sprites", "logo", "logos", "icon", "icons",
])

/** Query parameters an outlet's resizer uses to declare the rendered size. */
const SIZE_QUERY_PARAMS = ["w", "width", "h", "height", "size", "sz"]

export type ImageRejection =
  | "unusable-url"
  | "insecure"
  | "non-photo"
  | "unlicensed-host"

export interface ImageDecision {
  /** The image to keep, or null when it must not be hotlinked. */
  url: string | null
  /** Why it was dropped, or null when it was kept or there was no image. */
  rejectedAs: ImageRejection | null
  /** Hostname of the image, when the URL parsed. Reported for tuning. */
  host: string | null
}

/**
 * True unless the URL states, by itself, that the asset is too small or is a
 * non-editorial decoration. Dimensions only count when the URL declares them —
 * we never fetch to find out.
 */
function looksLikePhoto(parsed: URL): boolean {
  const path = parsed.pathname
  const segments = path.split("/").filter(Boolean)
  for (const segment of segments) {
    const stem = segment.replace(/\.[a-z0-9]{2,5}$/i, "").toLowerCase()
    if (NON_PHOTO_SEGMENTS.has(stem)) return false
  }

  // `/100x75/` style resizer segments.
  //
  // News CDNs overload `WxH` for two different things: real pixel dimensions
  // (`/652x1160/`) and crop *aspect ratios* (`/16x9/`, `/4x3/`, and Globo's
  // `/0x0/` meaning "original size"). Reading a ratio as pixels made the 160px
  // floor drop genuine photographs from Globo and CNN, silently — confirmed on
  // a real dry-run batch. So the pair only counts as dimensions when both
  // numbers are at least MIN_DIMENSION_DIGITS wide: an aspect ratio has at
  // least one single-digit side, while a real thumbnail (`/100x75/`, `/80x60/`)
  // has neither and is still rejected. `1x1` never reaches here — its stem is
  // in NON_PHOTO_SEGMENTS above.
  const inPath = path.match(/(?:^|[/_.-])(\d{1,4})x(\d{1,4})(?:[/_.-]|$)/)
  if (inPath) {
    const width  = Number(inPath[1])
    const height = Number(inPath[2])
    const looksLikePixels = width >= MIN_RATIO_FREE_VALUE && height >= MIN_RATIO_FREE_VALUE
    if (looksLikePixels && (width < MIN_DECLARED_EDGE_PX || height < MIN_DECLARED_EDGE_PX)) {
      return false
    }
  }

  // `?w=80` style resizer parameters.
  for (const key of SIZE_QUERY_PARAMS) {
    const raw = parsed.searchParams.get(key)
    if (raw === null) continue
    const value = Number(raw)
    if (Number.isFinite(value) && value > 0 && value < MIN_DECLARED_EDGE_PX) return false
  }

  return true
}

function isLicensedHost(host: string): boolean {
  return LICENSED_IMAGE_DOMAINS.some((d) => matchesDomain(host, d))
}

/**
 * Rule 2 — the outlet serving its own photograph for its own story. With
 * attribution that is the defensible case, and it is the load-bearing rule of
 * the three: it keeps working as quality.ts's source allowlist grows, with no
 * CDN list to maintain.
 *
 * Matched both ways so `cnn.com` serving an image for `edition.cnn.com`, and
 * `media.cnn.com` serving one for `cnn.com`, both pass — while the suffix
 * attack `cnn.com.fake.net` matches neither.
 */
function isSameOriginAsArticle(host: string, sourceUrl: string): boolean {
  const articleHost = hostOf(sourceUrl)
  if (!articleHost) return false
  return matchesDomain(host, articleHost) || matchesDomain(articleHost, host)
}

function isKnownOutletCdn(host: string, sourceUrl: string): boolean {
  const articleHost = hostOf(sourceUrl)
  if (!articleHost) return false
  for (const [outlet, cdns] of Object.entries(OUTLET_IMAGE_CDNS)) {
    if (!matchesDomain(articleHost, outlet)) continue
    if (cdns.some((cdn) => matchesDomain(host, cdn))) return true
  }
  return false
}

/**
 * The matcher. Returns the image to keep (possibly null) and, when dropped,
 * why and from which host.
 *
 * An absent image is not a rejection: there was nothing to check.
 */
export function checkImageRights(
  imageUrl: string | null | undefined,
  sourceUrl: string,
): ImageDecision {
  const candidate = imageUrl?.trim()
  if (!candidate) return { url: null, rejectedAs: null, host: null }

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return { url: null, rejectedAs: "unusable-url", host: null }
  }

  const host = hostOf(candidate)
  if (!host) return { url: null, rejectedAs: "unusable-url", host: null }

  // § 4.1.2 — HTTPS only. An http image also breaks the page's mixed-content
  // policy, so there is no version of this we would want to serve.
  if (parsed.protocol !== "https:") {
    return { url: null, rejectedAs: "insecure", host }
  }

  // § 4.1.4 — tracking pixels, icons, logos and sub-minimum assets.
  if (!looksLikePhoto(parsed)) {
    return { url: null, rejectedAs: "non-photo", host }
  }

  // § 4.1.1 — fail-closed allowlist, in order of how defensible each basis is.
  if (
    isLicensedHost(host) ||
    isSameOriginAsArticle(host, sourceUrl) ||
    isKnownOutletCdn(host, sourceUrl)
  ) {
    return { url: candidate, rejectedAs: null, host }
  }

  return { url: null, rejectedAs: "unlicensed-host", host }
}

export interface ImageRightsReport {
  /** Every input article, in order, with unusable images nulled out. */
  articles: NormalizedArticle[]
  rejected: {
    unlicensedHost: number
    insecure: number
    nonPhoto: number
    unusableUrl: number
  }
  /**
   * Distinct hosts rejected for having no licence basis, sorted. This is the
   * allowlist-candidate list and nothing else: a host that appears here is one
   * an editor can consider proposing under § 4.3.
   */
  unlicensedImageHosts: string[]
  /**
   * Distinct hosts whose image was dropped for any other reason — non-HTTPS,
   * non-photo asset, unparseable URL — sorted.
   *
   * Kept apart from `unlicensedImageHosts` on purpose. The two were one list
   * at first and that was actively misleading: a host that only ever served a
   * tracking pixel is not a candidate for the allowlist, and mixing it in made
   * the list promise something it did not deliver to whoever was tuning it.
   */
  otherDroppedImageHosts: string[]
}

const REJECTION_COUNTER: Record<ImageRejection, keyof ImageRightsReport["rejected"]> = {
  "unlicensed-host": "unlicensedHost",
  "insecure":        "insecure",
  "non-photo":       "nonPhoto",
  "unusable-url":    "unusableUrl",
}

/**
 * Applies the rule to a normalized batch.
 *
 * Why this is its own pipeline step rather than a line inside
 * `normalizeArticles`: every rejected host has to be reported by name, the way
 * quality.ts reports rejected sources, so that an outlet we should have
 * allowlisted shows up as a name to add instead of as a silent fall in the
 * number of articles carrying pictures. `normalizeArticles` is a pure
 * array-in/array-out function with nowhere to put that report, and giving it
 * one would force every caller to handle a report about a concern that is not
 * normalisation. Image rights are a separate gate with a separate owner
 * (§ 4.3), so they take the shape the other gate already uses: a function that
 * returns its own report, which the pipeline logs.
 */
export function applyImageRights(articles: NormalizedArticle[]): ImageRightsReport {
  const report: ImageRightsReport = {
    articles: [],
    rejected: { unlicensedHost: 0, insecure: 0, nonPhoto: 0, unusableUrl: 0 },
    unlicensedImageHosts: [],
    otherDroppedImageHosts: [],
  }
  const unlicensedHosts = new Set<string>()
  const otherHosts = new Set<string>()

  for (const article of articles) {
    const decision = checkImageRights(article.imageUrl, article.sourceUrl)

    if (decision.rejectedAs) {
      report.rejected[REJECTION_COUNTER[decision.rejectedAs]]++
      // An unparseable URL has no host to name; report the raw value truncated
      // so the log still identifies it.
      const name = decision.host ?? `<unparseable: ${String(article.imageUrl).slice(0, 60)}>`
      if (decision.rejectedAs === "unlicensed-host") unlicensedHosts.add(name)
      else otherHosts.add(name)
    }

    // Never drop the article (§ 4.2) — only its image.
    report.articles.push(
      decision.url === article.imageUrl ? article : { ...article, imageUrl: decision.url },
    )
  }

  report.unlicensedImageHosts = [...unlicensedHosts].sort()
  report.otherDroppedImageHosts = [...otherHosts].sort()
  return report
}

// ─── Shared declaration for next.config.ts ───────────────────────────────────

/**
 * Structural copy of Next's `RemotePattern`, kept local so this module stays
 * dependency-free and therefore safe to import from both the cron runtime and
 * next.config.ts.
 */
export interface LicensedRemotePattern {
  protocol: "https"
  hostname: string
  pathname?: string
}

/**
 * Path constraints carried over from the hand-written next.config.ts entry, so
 * moving the declaration here changes nothing about what next/image accepts.
 */
const REMOTE_PATTERN_PATHNAMES: Readonly<Record<string, string>> = {
  "rthfa4e7dp.ufs.sh": "/f",
}

/**
 * `images.remotePatterns` for next.config.ts, derived from the one allowlist
 * above so the two declarations cannot drift. Each domain yields the apex plus
 * a `**.` wildcard entry, mirroring the domain-or-subdomain rule the ingestion
 * gate applies.
 *
 * This covers rule 1 only. Rules 2 and 3 are decided per article against its
 * own source, so they cannot be enumerated as static patterns — outlet images
 * keep rendering `unoptimized`, as they do today.
 */
export const LICENSED_IMAGE_REMOTE_PATTERNS: LicensedRemotePattern[] =
  LICENSED_IMAGE_DOMAINS.flatMap((domain) => {
    const pathname = REMOTE_PATTERN_PATHNAMES[domain]
    const make = (hostname: string): LicensedRemotePattern =>
      pathname ? { protocol: "https", hostname, pathname } : { protocol: "https", hostname }
    return [make(domain), make(`**.${domain}`)]
  })
