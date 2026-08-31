/**
 * lib/story-format.ts
 *
 * Display helpers for NOW V2.
 *
 * `timeAgo` in `lib/utils.ts` is not reused here: it renders Portuguese
 * ("agora", "3sem", "2mês") and the NOW surface is English. Rather than
 * bilingualise a helper the rest of the app depends on, this file carries the
 * English forms and the spec's exact spacing — "12 min", not "12min" (§ 4).
 */

/**
 * Relative time in the spec's card format. Deliberately coarse: the card only
 * needs to answer "is this fresh?", and a precise clock invites false precision
 * on a `publishedAt` that came from a syndication feed.
 */
export function recencyLabel(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""

  const seconds = Math.max(0, Math.floor((now - then) / 1000))
  if (seconds < 60) return "now"

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d`

  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} w`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} mo`

  return `${Math.floor(days / 365)} y`
}

/**
 * The card's source line (spec § 4).
 *
 * Two forms, because they say different things: up to three publishers get
 * named ("BBC · Reuters · AP"), while a wider spread leads with the strongest
 * name and counts the rest ("Reuters + 4 sources"). A single source is named on
 * its own — never dressed up as "1 source", which would imply we corroborated
 * something we did not.
 */
export function sourceLine(sourceNames: string[], sourceCount: number): string {
  if (sourceCount <= 0 || sourceNames.length === 0) return ""
  if (sourceCount === 1) return sourceNames[0]
  if (sourceCount <= 3) return sourceNames.slice(0, sourceCount).join(" · ")

  const remaining = sourceCount - 1
  return `${sourceNames[0]} + ${remaining} sources`
}

/** "Based on 5 sources" / "Based on 1 source" for the Brief (spec § 12). */
export function basedOnLine(sourceCount: number): string {
  return sourceCount === 1 ? "Based on 1 source" : `Based on ${sourceCount} sources`
}

/** Absolute date for the Brief and source list. */
export function absoluteDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

/**
 * Splits a stored narrative into paragraphs. Accepts either blank-line or
 * single-newline separation, since ingested bodies use both.
 */
export function toParagraphs(text: string | null): string[] {
  if (!text) return []
  return text
    .split(/\n{2,}|\r\n{2,}|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}
