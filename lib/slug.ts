/**
 * lib/slug.ts — URL slugs for articles.
 *
 * Extracted from lib/ingestion/persist.ts, unchanged, so ingestion and the
 * editorial layer cannot drift into producing different URL shapes for the same
 * title. The `News.slug` column is `@unique`, and the timestamp suffix is what
 * keeps two same-day articles about the same event from colliding.
 */

/** Produces a URL-safe slug unique enough for one article. */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .substring(0, 90) +
    "-" +
    Date.now().toString(36)
  )
}

/**
 * Normalises a slug supplied by a caller (an agent editing a URL for SEO).
 * Unlike `slugify` this adds no suffix — the caller chose the value, and
 * silently appending to it would defeat the point of setting it.
 */
export function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 120)
}
