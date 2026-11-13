---
name: ingestion-publish-gate
description: Editorial ruling (2026-11-06, extended 2026-11-12) — ingestion creates at DRAFT, never PUBLISHED; no source-trust auto-approve exemption; legacy corpus cuts over by date, no retroactive demotion.
metadata:
  type: project
---

Product owner ruled (2026-11-06) that the scraper must collect but never publish. Target flow: collect → rewrite in NotiLab voice → image rights check → human approval → live. Spec: `docs/editor/ingestion-editorial-workflow.md`; sequencing: `docs/manager/strategy/ingestion-editorial-gate.md`.

Decisions that should not be reopened without the owner:
- Portuguese only in what the reader/editor sees (feed, CMS, emails, state labels). Code, schema, identifiers and `docs/` stay English.
- Images: allowlist of licensed/open domains; failing that, the article runs with no image and the editor decides. Never hotlink an unknown domain.
- **No new `NewsStatus` value.** Ingested items enter `DRAFT`, and the "raw vs rewritten" distinction rides on `ContentWorkflow.stage` (`DRAFT` = recolhido/raw, `WRITING` = rewritten). The gate is a *precondition* on the existing `DRAFT → PENDING_REVIEW` edge, not a new state.
- **Entry status is `DRAFT`, never `PENDING_REVIEW` and never conditional.** `PENDING_REVIEW` asserts that a human authored something and submitted it for judgment; an ingested row has no author and is still the source's literal text. Letting the machine both author and submit erases the one place human accountability (`authorId`) attaches.
- **No source-trust exemption (ruled 2026-11-12).** A `NewsSource.priority` threshold that auto-approves is auto-publish with a condition attached — and `priority` answers "how prominently should this rank?" (consumed in `lib/ranking.ts` at weight 0.15 + a below-threshold discount), not "may we publish this unreviewed under our name?". Reliability is not a licence: the most reliable outlet is the one whose verbatim text we have least right to republish. Faithful use of `priority` is to **order the review queue**, not to skip it.
- **No retroactive demotion of the already-published corpus (ruled 2026-11-12).** Cut over by date. `PUBLISHED → DRAFT` is not a legal edge, and routing through `APPROVED` would stamp unreviewed content as approved — manufacturing an editorial signal that never happened is worse than a missing one. Legacy cleanup is `ARCHIVED` only, as a separate reviewed sweep (roadmap #18), never an automated flip.
- `News.content` stays the literal source text forever; NotiLab's rewritten body belongs on `ArticleAI` with its own attempts/error/timestamp, separate from enrichment state.

**Why:** everything public filters `status: "PUBLISHED"`, so the gate is the only thing standing between a scraped third-party article and the live site — adding an enum value would touch every consumer for a distinction two existing enums already express.
**How to apply:** when anyone proposes writing `status: "PUBLISHED"` at creation time, auto-submitting/auto-approving ingested items, or exempting "trusted" sources, this is the rule they are breaking. Before endorsing a flip date, verify an approval surface actually exists — as of 2026-11-12 `app/api/admin/**` still held only auth/logout/overview/experiments and the workflow/news admin components were mock-data shells, so the gate would have been a queue with no door. Related: [[ai-failure-must-stay-failed]], [[sensitive-topic-framing]], [[gate-downstream-publication-window]].
