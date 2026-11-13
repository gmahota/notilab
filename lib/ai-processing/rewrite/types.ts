/**
 * Types for the rewrite step — NotiLab's own retelling of a collected story.
 *
 * Kept apart from `lib/ai-processing/types.ts` on purpose. Enrichment and
 * rewriting are different jobs with different failure semantics: enrichment may
 * fall back to a heuristic, the rewrite may never. Sharing a result type would
 * invite sharing a save path, and the save path is where that rule lives.
 */

/** A rewrite the model produced and the parser accepted. Both fields or neither. */
export interface RewriteResult {
  /** NotiLab's headline, in Mozambican Portuguese. */
  title: string
  /** NotiLab's body. What the public reads once anything reads these columns. */
  content: string
}

/** One article's worth of grounding material, as the selector loads it. */
export interface RewriteStub {
  id: string
  articleId: string
  rewriteAttempts: number
  article: {
    id: string
    title: string
    content: string | null
    summary: string | null
    sourceName: string | null
    sourceUrl: string | null
  }
}

export interface RewriteBatchResult {
  total: number
  succeeded: number
  /** Attempted, failed, counter incremented — the article stays unrewritten. */
  failed: number
  /** Not attempted: too little source material to ground a rewrite. */
  skipped: number
  errors: Array<{ articleId: string; reason: string }>
}
