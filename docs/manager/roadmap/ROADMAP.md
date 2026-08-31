# NotiLab Roadmap

Hand-maintained. Update an entry's Status when work starts/completes — see `10-docs-memory` agent and `/task-spec`. No generator script exists (deliberate — see `docs/memory/decisions.md`, 2026-07-13); keep this file honest rather than automating prematurely.

**Status enum**: `planned` → `in_progress` → `done`, or `blocked`.

## Foundation — AI Governance

| # | Status | Task | Area | Depends on | Blocks |
|---|---|---|---|---|---|
| 1 | done | Adopt `AGENTS.md` / `CLAUDE.md` charter | docs-memory | — | 2–5 |
| 2 | done | Define `.claude/agents/*` roster (11 agents) + template sync | docs-memory | 1 | — |
| 3 | done | Document Quality Gate against existing CI | testing | 1 | — |
| 4 | done | Seed `docs/memory/*` from current codebase | docs-memory | 1 | — |
| 5 | planned | Close known quality-gate gaps (ESLint `any`/unused-vars enforcement, `.lighthouserc.json` orphan) | testing | 3 | — |

## Core Product (as described in `README.md` — status reflects what's already shipped vs. still open)

| # | Status | Task | Area | Depends on | Blocks |
|---|---|---|---|---|---|
| 6 | done | News ingestion pipeline (GNews/NewsAPI/RSS + Reddit) | integrations-social | — | 7 |
| 7 | done | AI enrichment pipeline (summary/tldr/importance score) | ai-pipeline | 6 | — |
| 8 | done | Ranking/trending recalculation | backend-api | 7 | — |
| 9 | done | Digest generation + delivery (email) | integrations-social | 7 | — |
| 10 | done | Messaging delivery (Telegram, WhatsApp) | integrations-social | 7 | — |
| 11 | done | Gamification (streaks, reactions, referral shares) | backend-api | — | — |
| 12 | done | Growth experiments (A/B assignment) | backend-api | — | — |
| 13 | planned | Test coverage for ranking/AI-processing critical paths | testing | 5 | — |

## Editorial Pivot — 2026-07-14 (see `docs/editor/content-focus.md`)

Scope narrowed from general Portugal/EU news to: world football, Real Madrid, PT/EN/ES top-team backstage, Mozambique politics, South Africa xenophobia.

| # | Status | Task | Area | Depends on | Blocks |
|---|---|---|---|---|---|
| 14 | done | Fix `/now` layout overlap (fixed nav hiding content) + missing `placeholder.svg` | frontend | — | — |
| 15 | done | Add missing `general`/`ciencia` categories (fixed silent mis-categorization fallback bug) | database | — | — |
| 16 | done | Draft editorial content-focus policy (`docs/editor/content-focus.md`) | editorial-content | — | 17 |
| 17 | done | Repoint `SYNC_QUERIES` + `CATEGORY_RULES` at new scope; add `mocambique`/`africa-do-sul` categories | integrations-social, database | 16 | 18 |
| 18 | in_progress | Archive ~142 now-out-of-scope articles + stale `TrendingTopic` rows (needs an ADMIN user to attribute `AdminAction` audit rows, plus REVISOR pass on borderline items) | database | 17 | — |
| 19 | done | Add Film & Series Criticism vertical (Netflix/Prime Video/Marvel, action/comedy/doramas) — `filmes` category, `SYNC_QUERIES`/`CATEGORY_RULES` updated (Addendum v1.1) | integrations-social, database | 17 | 20 |
| 20 | planned | Fix `sync-news` cron rate-limit overrun (576 GNews req/day vs ~100/day free tier) — drop cadence to every 3h or move to a paid plan | backend-api, cto | 19 | — |


## NOW V2 — 2026-08-19 ("NotiLab NOW V2" product spec)

`/now` becomes a feed of **events** (Story) rather than articles. Three depth levels: NOW (5–15s) → BRIEF (30–60s) → DEEP (3–5min). Sprints below follow the spec's own § 39 sequencing.

| # | Status | Task | Area | Depends on | Blocks |
|---|---|---|---|---|---|
| 21 | done | Sprint 1 — `/now` V2 UX: vertical story feed, `/story/[slug]` Brief, `/now/[slug]` deep links + OpenGraph, `/saved`, lane header, NOW/EXPLORE/ASK/SAVED nav, keyboard shortcuts, `story_*` analytics | frontend, backend-api | — | 22 |
| 22 | done | Sprint 2 (schema) — `Story`/`StorySource`/`StoryEntity`/`KeyFact`/`TimelineItem` models + `story_model` migration (additive) + `News→Story` backfill script | database | 21 | 23 |
| 23 | blocked | Sprint 2 (deploy) — apply `story_model` migration and run `pnpm stories:backfill --apply`. **Blocked on a human decision**: local `.env` and the deployment share one Neon database, so this is a production write | database, cto | 22 | 24, 25 |
| 24 | planned | Sprint 3 — clustering: attach incoming articles to an existing Story (entity/location/time/topic + semantic similarity) instead of creating one per article. Until this lands every Story has exactly one source, so no card can say "Reuters + 4 sources" | ai-pipeline, integrations-social | 23 | — |
| 25 | planned | Sprint 4 — intelligence: extract `keyFacts`, `whyItMatters`, `context`, `whatsNext`; set `confidenceScore` and drive `status` (developing/confirmed/updated/closed) from it. The Brief hides each of these sections until it has real data | ai-pipeline | 23 | 26 |
| 26 | planned | Sprint 4b — story `timeline` + DEEP view (§ 22). Model and migration already exist; nothing writes or reads them yet | ai-pipeline, frontend | 25 | — |
| 27 | planned | Sprint 5 — personalisation: real `Following` lane, and calibrate the § 33 feed weights against behavioural data. `interestScore` currently needs a `userId`, which this surface has no way to obtain (no sign-in) | backend-api, frontend | 23 | — |
| 28 | planned | Move NOW saves off `localStorage` onto `SavedArticle` once accounts exist — saves currently do not follow a visitor between devices | frontend, backend-api | 27 | — |
| 29 | planned | Retire the `News`-derived fallback in `lib/story-service.ts` (and `lib/story-tables.ts`) once clustering populates `Story` for every published article | backend-api | 24 | — |

Add new entries at the bottom of the relevant section, or start a new section for a new initiative. Use `/task-spec` to produce the Task Spec that backs each entry (see `TASK_TEMPLATE.md`).
