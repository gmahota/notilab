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

## Immersive Feed Redesign — 2026-07-15 (see `docs/cto/task/1. V01 - New Layout/designs/Agora - Bandeja.dc.html`)

`/now` immersive feed redesigned end-to-end to match the hifi design prototype. Verified via `pnpm typecheck`/`pnpm lint` + live browser exercise of every flow (onboarding, category persistence, bandeja overlay, category refetch, why-popover, context panel). No automated test suite covers this area yet.

| # | Status | Task | Area | Depends on | Blocks |
|---|---|---|---|---|---|
| 21 | done | `/now` redesign: `GET /api/categories`, `bandeja-store.ts` personalization store, onboarding picker, redesigned story card/feed/nav/context panel, bandeja overlay, dormant `spatialAsset` scaffolding | frontend, backend-api | 14 | 22 |
| 22 | planned | Backend support for design's fabricated fields: `spatialAsset` schema (`DailyEdition`/`Story` model changes + cron population), multi-source/`facts`/`reasons` real data model | database, backend-api, ai-pipeline | 21 | — |
| 23 | planned | "Explorar" mural redesign (`Explorar - Mural.dc.html`) — not started this pass | frontend | — | — |

Add new entries at the bottom of the relevant section, or start a new section for a new initiative. Use `/task-spec` to produce the Task Spec that backs each entry (see `TASK_TEMPLATE.md`).
