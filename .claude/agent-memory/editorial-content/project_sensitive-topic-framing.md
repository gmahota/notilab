---
name: sensitive-topic-framing
description: Editorial-sensitivity rule for the Mozambique-politics and South Africa-xenophobia streams — factual/sourced reporting only, no inflammatory AI framing, mandatory human review.
metadata:
  type: project
---

The two politically charged streams in the 2026-07-14 scope pivot ([[content-scope-pivot]]) require extra editorial care:

- Report events with attributed sources; never let AI-generated summary/tldr/whyItMatters add framing, blame, or emotional language the source doesn't contain. No dehumanizing language toward migrants.
- No fabricated specifics — casualty figures, dates, quotes, named actors must trace to sourceUrl; contested claims need corroboration or explicit attribution.
- Human REVIEW/APPROVAL is mandatory before PUBLISHED regardless of origin; on AI enrichment failure or low-confidence classification, hold for a human — never fall through to auto-publish.
- Prefer higher NewsSource.priority outlets; a single low-trust source should not alone drive a published item in these categories.

The 2026-11-12 pivot ([[content-scope-pivot]]) removed every query feeding these two categories, but the rule survives unchanged: it governs *handling*, not coverage. The `CATEGORY_RULES` keyword blocks are still live (a stray can still land there), the already-published Mozambique/SA corpus is still selectable by digest, messaging, trending and "destaque", and `ingestion-editorial-workflow.md` § 2.4 cites it as a named rewrite failure mode. What changes is the default disposition: a stray is now off-scope as well as sensitive, so the default is to let it age out to ARCHIVED, never to publish it on a classifier's say-so.

**Why:** South Africa has had real xenophobic violence against African migrants; Mozambique politics is contested. Mishandling risks harm and violates the platform's AI-content-correctness invariants. None of that stopped being true when we stopped looking.
**How to apply:** Apply whenever reviewing/approving or building ingestion/AI enrichment for the `mocambique` or `africa-do-sul` categories, and whenever an existing published article in them is re-surfaced. Keep business-rules invariant #12 (never PUBLISHED without a `reviewerId` in these categories) even though intake is zero.
