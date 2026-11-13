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
| 5 | in_progress | Close known quality-gate gaps. Done 2026-09-04 (see #21): `pnpm test` wired in as blocking, hardcoded-secret check rewritten, route authorization manifest added. Still open: ESLint `any`/unused-vars enforcement, `.lighthouserc.json` orphan, no coverage floor | testing | 3 | — |

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

## Security Hardening — 2026-09-04

Opened after a gate audit found two live security defects that CI had reported green throughout. The audit (#21) covers the **gate**; #22 and #23 are the defects themselves and are owned separately.

Numbering note: an earlier hand-off referred to these as roadmap rows "#5 (in_progress)" and "#30 (hardcoded-admin defect)". No row #30 has ever existed in this file — on `main` it ends at #20 — and #5 was `planned`, not `in_progress`. The rows below are the real ones; `scripts/quality/*.json` reference these numbers.

| # | Status | Task | Area | Depends on | Blocks |
|---|---|---|---|---|---|
| 21 | done | Quality-gate audit and hardening: blocking `pnpm test` job, rewritten hardcoded-secret check (the previous grep could not match `password:` and never ran on PRs), route authorization manifest, CODEOWNERS coverage for `app/api/**/route.ts`, `QUALITY_GATE.md` corrections | testing, security | 3 | 22, 23 |
| 22 | planned | Fix the broken-access-control family: `app/api/user/{route,react/route,save/route}.ts` and `app/api/growth/streak/route.ts` all trust a client-supplied `userId` with only a presence check. Derive identity from a verified session instead. Remove each route from `knownViolations` in `scripts/quality/authorization-manifest.json` and lower `maxKnownViolations` as they land | security, backend-api | 21 | — |
| 23 | planned | Remove hardcoded staff credentials: `app/api/admin/auth/route.ts` authenticates against a 3-entry array sharing the published bcrypt test-vector hash for `password`, with no `NODE_ENV` gate; `lib/admin-auth.ts:4` falls back to the literal `"your-secret-key"` for `JWT_SECRET`. Move accounts to the database and throw on a missing secret rather than substituting one. Two tests in `__tests__/lib/admin-auth.test.ts` are marked `FIXME(ROADMAP #23)` and must be inverted by this work; then empty `scripts/quality/secret-allowlist.json` and set `maxEntries` to 0 | security | 21 | — |
| 24 | planned | Review the remaining unauthenticated endpoints recorded in `authorization-manifest.json` → `knownViolations`: `growth/events`, `growth/experiments`, `growth/share/[id]`, `growth/share/visit` (unverified `userId`, unauthenticated writes) and `ai/explain` (no auth, no rate limit, calls a paid LLM). Each needs a posture decision from `01-cto`, then either a check or a move to `publicRoutes` with a reason | security, cto | 21 | — |
| 25 | planned | Add rate limiting to the unauthenticated LLM-backed endpoints (`ai/explain`, `news/summarize-link`, `chat`). No check enforces this today; it is recorded in `QUALITY_GATE.md` § Still not in the gate | backend-api, cto | 24 | — |
| 26 | planned | No privilege separation among admin roles. `checkAdminAuth()` treats all seven roles (`REDATOR` … `SUPER_ADMIN`) as equivalent and no route narrows further, so a `REDATOR` token authorises `app/api/admin/experiments` and `app/api/ai/generate-news`. Found during the #21 audit. Needs a `requireRole(...)` helper and a per-route role decision from `01-cto` | security, cto | 21 | — |

Add new entries at the bottom of the relevant section, or start a new section for a new initiative. Use `/task-spec` to produce the Task Spec that backs each entry (see `TASK_TEMPLATE.md`).
