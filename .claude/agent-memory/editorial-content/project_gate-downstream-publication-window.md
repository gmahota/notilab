---
name: gate-downstream-publication-window
description: Review latency is subtracted from every downstream window because digest/messaging/ranking key off source publishedAt — the real way the editorial gate empties the digest.
metadata:
  type: project
---

`News.publishedAt` is the **source's** publication date, and `transitionArticle()` deliberately does not rewrite it on publish (silently setting it to "now" would reorder the feed on every republish). Every downstream consumer keys off it: `lib/digest.ts` selects `publishedAt >= now − WINDOW_HOURS` + `PUBLISHED`, `lib/messaging/deliver.ts` does the same at 24h, and `lib/ranking.ts` `dimRecency` decays exponentially with a 24h half-life.

Consequence once a human gate sits in front of publication: **review latency comes straight out of the publication window.** An article ingested at 20:00 and approved the next afternoon is already outside the daily digest window and enters the feed pre-buried. The digest fails safe (`skipReason: "No eligible articles found"`) but *silently* — it can be dead for a week with nobody alerted.

**Why:** this is the mechanism that empties the digest, and it is not "nothing was approved" — it is "approved too late". It gets mistaken for an ingestion-coverage problem and costs a day of debugging.
**How to apply:** editorial position is that `publishedAt` stays the source's date — it is a factual claim about when the news happened, and changing it would be a small lie that also breaks dedup. The fix belongs in the *selection window*, which must key off the moment the article became visible. Any change that gates publication must ship this alongside, or explicitly accept that reviewed articles miss the digest. Related: [[ingestion-publish-gate]].
