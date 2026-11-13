---
name: celebrity-markets-sensitivity
description: Editorial-sensitivity rules for the two verticals added in the 2026-11-12 pivot — US celebrities (named living individuals: defamation/privacy) and financial markets (actionable numbers: no advice, no invented figures or causality).
metadata:
  type: project
---

The v2 scope ([[content-scope-pivot]]) introduced the product's first two verticals whose failure mode is not only fabrication.

**`celebridades` — the subject is a living private-ish individual.** Never publish, in NotiLab's rewritten voice: unattributed "sources say" claims (the outlet must be named in our text); relationship/pregnancy/breakup speculation stated as fact (hedges stay hedges); health, mental-health, addiction or death claims without an on-the-record statement; sexuality or gender-identity claims not self-stated; criminal allegations without the procedural state and authority named; anything about a celebrity's children. Health / identity / legal-allegation / minor items get a mandatory human hold, the same weight § G gives Mozambique and SA.

**`economia` — the reader can act on it.** NotiLab gives no investment advice: no buy/sell/hold framing, no price targets or forecasts in our own voice (attributable to the issuing institution or absent), no invented causality ("fell AND the Fed met" must not become "fell BECAUSE"), no recomputed or rounded figures, no decided-vs-expected tense slippage, no stale price presented as current. Every figure in the rewrite must appear in `News.content` — this is the one vertical where the side-by-side review requirement is mechanically checkable.

**Why:** celebrity coverage shifts the exposure from attribution to defamation and privacy harm, and market coverage makes a hallucinated number actionable. The pre-v2 verticals (football, Mozambique, film) carried neither risk in this form, so none of the existing failure-mode lists cover them.
**How to apply:** these are review-checklist items for the rewrite step and the REVISOR queue, and new named failure modes for `docs/editor/ingestion-editorial-workflow.md` § 2.4. Two items are outside editorial's lane and still need the maintainer: the wording/jurisdiction of a not-investment-advice disclosure on `economia` articles, and explicit acceptance of the defamation posture on `celebridades`.
