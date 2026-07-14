---
name: film-series-vertical
description: 2026-07-14 additive editorial vertical — film & series criticism (Netflix/Prime/Marvel; action/comedy/doramas), new `filmes` category, not a repurpose of `cultura`.
metadata:
  type: project
---

On 2026-07-14 the maintainer ADDED a film & series vertical to NotiLab's editorial scope (additive, does not replace the [[content-scope-pivot]] football/Mozambique/SA remit). Scope: film & TV criticism AND industry news (casting, release/streaming dates, trailers, box-office) anchored on Netflix, Amazon Prime Video, Marvel (MCU); genre emphasis action + comedy; doramas (K-dramas) as trending sub-focus.

Taxonomy decision: MINT a new `filmes` slug (name "Cinema & Séries"), do NOT repurpose the retired `cultura` category. **Why:** `desporto` was safely repurposed because football is a strict subset of "all sport"; film-criticism is NOT a subset of `cultura`'s old meaning (arte/música/cinema/eventos), so reusing it would retroactively mislabel legacy music/arts rows. **How to apply:** when adding future verticals, only repurpose an existing category if the new meaning is a strict subset of the old one; otherwise mint a fresh slug and leave the retired row alone.

Rate-limit reality surfaced during this task: the `≤10 queries / 100-req-day` comment in `lib/ingestion/providers.ts` is already fiction — sync cron runs every 30 min (vercel.json) = 48 runs/day, so even the pre-existing 10 queries = 480 GNews req/day (~4.8x free tier). Adding the vertical (→12 queries) makes it 576/day. **How to apply:** query-count is not the real lever — cadence is; the fix (drop cron to ~every 3h, or paid GNews plan) is an 01-cto/04-backend decision, not a reason to starve editorial queries. Do not trust that code comment's math.

Correctness rule specific to reviews: AI enrichment must never fabricate a star rating / "X/10" / critical-consensus the source doesn't state, must not substitute its own verdict as the source's, and must not add spoilers absent from the source. Reviews are opinion — attribute to critic/outlet, preserve sourceUrl. Standard REVIEW/APPROVAL gate applies (no auto-publish), but film does not carry the mandatory-human-hold weight of Mozambique/SA topics.
