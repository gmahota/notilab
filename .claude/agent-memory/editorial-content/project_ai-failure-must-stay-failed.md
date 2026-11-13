---
name: ai-failure-must-stay-failed
description: Live violation found 2026-11-06 — the AI enrichment batch marks heuristic-fallback output as a success, contradicting business-rules.md; the rewrite step must not copy that pattern.
metadata:
  type: project
---

`business-rules.md` § AI-content correctness says a failed AI enrichment "should stay failed and retry, not fake success". The enrichment batch does the opposite today: when the AI call throws or returns unparseable output, `lib/ai-processing/processor.ts` substitutes `generateFallback(...)` and hands it to `saveEnrichmentResult`, which stamps `processedAt: new Date()` and clears `lastError`. The article is then indistinguishable from a genuinely enriched one, and `whyItMatters` carries a canned sentence ("Esta notícia pode ser relevante para a actualidade.") presented as analysis.

**Why:** it was written to guarantee every article has *some* summary while ingestion auto-published — the gap was cosmetic when nothing was gated on it. Once the rewrite step gates publication, the same pattern would let an unwritten article pass as ready, which is the exact failure the publish gate exists to prevent.
**How to apply:** never extend the fallback-as-success pattern to the rewrite step — a failed rewrite records the error, leaves the article raw, retries to a cap, then queues for a human writer. Raise the enrichment case as its own fix; verify against current `processor.ts` before citing, it may have been corrected. Related: [[ingestion-publish-gate]].
