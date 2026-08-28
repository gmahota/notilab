/**
 * base-url.ts — The single answer to "what is our public origin?".
 *
 * Seven modules used to each declare their own `BASE_URL` const with the same
 * hardcoded fallback, which is how they all ended up pointing at a domain that
 * did not resolve. Resolution order:
 *
 *   1. NEXT_PUBLIC_BASE_URL                        — explicit override, wins always
 *   2. NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL   — set by Vercel, visible to the browser
 *   3. VERCEL_PROJECT_PRODUCTION_URL               — same value, server-side only
 *   4. FALLBACK_ORIGIN                             — local dev and anything off-Vercel
 *
 * Why the Vercel variable and not VERCEL_URL: VERCEL_URL is the URL of *that
 * deployment* and changes on every deploy, so a share link built from it rots.
 * VERCEL_PROJECT_PRODUCTION_URL is the project's production domain — the
 * shortest custom domain, or the .vercel.app one when no custom domain exists —
 * and is set even inside preview deployments.
 * https://vercel.com/docs/environment-variables/system-environment-variables
 *
 * Two things to know before relying on it:
 *   - It requires "Enable access to System Environment Variables" in the
 *     project's Environment Variables settings (on by default).
 *   - Vercel supplies the values without the `https://` scheme, hence withScheme.
 *   - NEXT_PUBLIC_* values are inlined at build time, not read at runtime, so a
 *     change in the dashboard only takes effect on the next build.
 */

/**
 * Used when nothing else is set. Split by environment on purpose: a production
 * build that somehow reaches this line must still emit links a reader can open,
 * so it cannot fall back to localhost — that would ship `http://localhost:3000`
 * into digest emails and WhatsApp messages.
 */
const FALLBACK_ORIGIN =
  process.env.NODE_ENV === "production" ? "https://notilab.vercel.app" : "http://localhost:3000"

/** Vercel gives hostnames without a scheme; an override may already carry one. */
function withScheme(value: string): string {
  return /^https?:\/\//.test(value) ? value : `https://${value}`
}

function resolveBaseUrl(): string {
  const candidate =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL

  if (!candidate) return FALLBACK_ORIGIN

  // Trailing slashes would produce `//news/123` in every composed link.
  return withScheme(candidate).replace(/\/+$/, "")
}

export const BASE_URL = resolveBaseUrl()

/** `absoluteUrl("/news/123")` → `https://notilab.vercel.app/news/123`. */
export function absoluteUrl(path: string): string {
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`
}
