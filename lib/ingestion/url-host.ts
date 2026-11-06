/**
 * url-host.ts — Hostname helpers shared by the ingestion gates.
 *
 * Extracted from quality.ts when image-rights.ts needed the same two
 * primitives. Duplicating them would have been worse than sharing: the suffix
 * rule below is the part that makes an allowlist safe, and two copies of it
 * can drift so that one gate accepts what the other rejects.
 */

/** Hostname without `www.`, or null when the URL is unusable. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
}

/**
 * True when the host is the allowed domain or a subdomain of it — so
 * `edition.cnn.com` passes for `cnn.com`, while `cnn.com.fake.net` does not.
 */
export function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}
