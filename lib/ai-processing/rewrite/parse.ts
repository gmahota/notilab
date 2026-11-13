/**
 * Parses the model's rewrite output, and refuses anything it is not sure about.
 *
 * The governing rule is § 3.5 of docs/editor/ingestion-editorial-workflow.md:
 * **a partially-written rewrite is treated as absent.** There is no partial
 * credit here. A title without a body, a body that got truncated mid-sentence
 * by a token limit, or JSON the model wrapped in prose all return null, and the
 * caller records a failure. The alternative — keeping whatever came back — is
 * how a half-written article ends up stamped as ours.
 */

import { INSUFFICIENT } from "./prompt"
import type { RewriteResult } from "./types"

/**
 * Shorter than this is not an article. The enrichment path uses a similar floor
 * on its *input*; this one is on the *output*, because the failure it catches
 * is a response truncated by the token limit, which arrives as valid JSON with
 * a believable-looking title and three sentences of body.
 */
const MIN_CONTENT_CHARS = 200

/** Outcome of parsing: a rewrite, a refusal by the model, or unusable output. */
export type ParseOutcome =
  | { kind: "ok"; result: RewriteResult }
  | { kind: "insufficient" }
  | { kind: "unusable"; reason: string }

/** Models wrap JSON in ```json fences often enough to be worth handling. */
function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()
}

export function parseRewrite(raw: string): ParseOutcome {
  const text = stripFences(raw)

  // The model's own refusal, checked before JSON parsing because it is not JSON.
  // Compared against the whole response, not with `includes`: a body that
  // discusses insufficiency is an article, not a refusal.
  if (text.toUpperCase() === INSUFFICIENT) return { kind: "insufficient" }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { kind: "unusable", reason: `not JSON (${text.slice(0, 80)})` }
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { kind: "unusable", reason: "JSON was not an object" }
  }

  const { title, content } = parsed as Record<string, unknown>

  if (typeof title !== "string" || title.trim() === "") {
    return { kind: "unusable", reason: "missing title" }
  }
  if (typeof content !== "string" || content.trim() === "") {
    return { kind: "unusable", reason: "missing content" }
  }

  const body = content.trim()
  if (body.length < MIN_CONTENT_CHARS) {
    return {
      kind: "unusable",
      reason: `content too short (${body.length} chars, likely truncated)`,
    }
  }

  return { kind: "ok", result: { title: title.trim(), content: body } }
}
