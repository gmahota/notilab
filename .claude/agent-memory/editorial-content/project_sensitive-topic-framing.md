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

**Why:** South Africa has had real xenophobic violence against African migrants; Mozambique politics is contested. Mishandling risks harm and violates the platform's AI-content-correctness invariants.
**How to apply:** Apply whenever reviewing/approving or building ingestion/AI enrichment for the `mocambique` or `africa-do-sul` categories.
