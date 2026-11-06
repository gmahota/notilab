---
name: ingestion-publish-gate
description: 2026-11-06 editorial decision — ingestion must stop auto-publishing; raw source text is gated behind a NotiLab rewrite + human review, using existing enums (no new NewsStatus).
metadata:
  type: project
---

Product owner ruled (2026-11-06) that the scraper must collect but never publish. Target flow: collect → rewrite in NotiLab voice → image rights check → human approval → live. Spec drafted as `docs/editor/ingestion-editorial-workflow.md`.

Decisions that should not be reopened without the owner:
- Portuguese only in what the reader/editor sees (feed, CMS, emails, state labels). Code, schema, identifiers and `docs/` stay English.
- Images: allowlist of licensed/open domains; failing that, the article runs with no image and the editor decides. Never hotlink an unknown domain.
- My call: **no new `NewsStatus` value.** Ingested items enter `DRAFT`, and the "raw vs rewritten" distinction rides on `ContentWorkflow.stage` (`DRAFT` = recolhido/raw, `WRITING` = rewritten). The gate is a *precondition* on the existing `DRAFT → PENDING_REVIEW` edge, not a new state.
- `News.content` stays the literal source text forever; NotiLab's rewritten body belongs on `ArticleAI` with its own attempts/error/timestamp, separate from enrichment state.

**Why:** everything public filters `status: "PUBLISHED"`, so the gate is the only thing standing between a scraped third-party article and the live site — adding an enum value would touch every consumer for a distinction two existing enums already express.
**How to apply:** when anyone proposes writing `status: "PUBLISHED"` at creation time, or proposes auto-submitting/auto-approving ingested items, this is the rule they are breaking. Related: [[ai-failure-must-stay-failed]], [[sensitive-topic-framing]].
