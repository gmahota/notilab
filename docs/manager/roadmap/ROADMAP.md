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
| 5 | in_progress | Close known quality-gate gaps — both ESLint rules now `"warn"` (were `"off"`); `.lighthouserc.json` removed. Remaining: clear 76 violations across 36 files, then promote to `"error"` | testing | 3 | — |

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
| 13 | in_progress | Test coverage for ranking/AI-processing critical paths — `lib/ranking.ts` covered (42 cases). Remaining: `lib/ai-processing/*`, `lib/trends.ts`, `lib/ranking-recalculate.ts`. **Entry was mis-scoped as a framework bootstrap; Jest already existed** | testing | 5 | 21 |

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
| 20 | done | Fix `sync-news` cron rate-limit overrun — already resolved by the daily cadence in `vercel.json` (10 queries × 1 run/day = 10 GNews req/day); entry was never closed. Stale `lib/ingestion/providers.ts` docblock corrected 2026-09-03 | backend-api, cto | 19 | — |
| 21 | planned | Wire `pnpm test` into `.github/workflows/ci-cd.yml` as a blocking job — the suite is green (12 suites / 206 tests) but **no CI job runs it**, so a broken spec merges. Needs a CODEOWNERS-reviewed workflow edit | testing, cto | 13 | — |
| 22 | planned | Delete dead `lib/user-service.ts` and `lib/social-service.ts` — zero callers; `user-service` fetches 5 endpoints that do not exist | backend-api | — | — |

## Language Convention — 2026-09-04

Passed independent review by `09-testing` on 2026-09-04 (cycle 2; cycle 1 failed on missed `.sh` scripts + an over-translation, both fixed). Code, schema, identifiers, and documentation in **English**; Portuguese reserved for user-facing *content* (article bodies, AI-generated summaries, UI copy, category display names). Audit: `prisma/schema.prisma` is fully English (all 33 models/enums, all field names) and no identifier anywhere uses Portuguese. The gaps are documentation prose and 14 Portuguese code comments.

| # | Status | Task | Area | Depends on | Blocks |
|---|---|---|---|---|---|
| 23 | done | Document the English-code / Portuguese-content convention in `AGENTS.md` + `docs/memory/*` so it is enforceable going forward | docs-memory | — | 24, 25 |
| 24 | done | Translate Portuguese docs to English (`README.md`, `DEPLOYMENT.md`, `ADMIN_GUIDE.md`, `docs/agent-api.md`, remnants in `docs/editor/content-focus.md` + `docs/memory/decisions.md`) and rename the `qualidade/` folder to `quality/` with all 13 references updated | docs-memory | 23 | — |
| 25 | done | Translate the Portuguese comment in `lib/admin-auth.ts:22` to English | security | 23 | — |
| 26 | done | Translate 9 Portuguese comments in `components/` (admin-category-manager, admin-dashboard, admin-news-manager, news-editor, news-researcher, workflow-comments, workflow-item-dialog, workflow-kanban) | frontend | 23 | — |
| 27 | done | Translate 4 Portuguese comments in `scripts/health-check.ts` | backend-api | 23 | — |
| 28 | done | Translate 2 Portuguese comments in `app/api/admin/auth/route.ts` (lines 6, 57 — security-owned path) | security | 23 | — |
| 29 | done | Translate operator-facing Portuguese console output in `scripts/health-check.ts` (11 strings) and `scripts/ingestion-dry-run.ts` (9) — dev-tooling output, not end-user content, so English per the convention | backend-api | 23 | — |
| 30 | planned | **Critical, found during this sweep** — `app/api/admin/auth/route.ts` authenticates against 3 hardcoded admins sharing a published bcrypt test-vector hash for `password`, ungated by `NODE_ENV`; plus `lib/admin-auth.ts:4` `JWT_SECRET` falls back to a committed literal on unset/blank. Needs `01-cto` sign-off | security, cto | — | — |
| 31 | done | Translate 8 Portuguese comments in `prisma/schema.prisma` (lines 23, 45, 60, 73, 92, 99, 103, 116) — comments only, no schema change, no migration | database | 23 | — |
| 32 | done | Translate 1 missed Portuguese comment in `components/ai-templates.tsx:73` | frontend | 23 | — |
| 33 | planned | **Inverse gap surfaced by this sweep** — user-facing UI copy is mixed-language: English `placeholder`/`aria-label` strings (`ab-testing.tsx` 170/196, `chat-widget.tsx` 159, `share-panel.tsx` 197, `trending-topics.tsx` 141/148, `hero-section.tsx` 94, `paste-link.tsx` 128) sit alongside Portuguese ones (`admin-category-manager.tsx` 142, `campaign-manager.tsx` 249, `news-editor.tsx` 316). Per § Language Rules these should all be Portuguese. Pre-existing, not caused by #24–#32. Needs `02-editorial-content` sign-off on tone/wording, not a mechanical translation | editorial-content, frontend | 23 | — |
| 34 | done | **Review FAIL #1 (HIGH)** — `scripts/setup.sh` and `scripts/dev-setup.sh` are 100% Portuguese operator scripts, missed entirely by #24–#32 because every scan globbed `*.ts/tsx/mjs/prisma/yml` and never included `*.sh` | backend-api | 23 | — |
| 35 | done | **Review FAIL #2 (MEDIUM)** — revert the 8 example user prompts in `docs/agent-api.md` to Portuguese; they illustrate end-user input to a Portuguese product (content), and now contradict the still-Portuguese example in `lib/agent/tools/articles-read.ts:5` | docs-memory | 23 | — |
| 36 | done | **Review FAIL #3 (LOW)** — translate 2 Portuguese `console.log` debug strings: `components/ai-templates.tsx:74`, `components/workflow-kanban.tsx:236` (developer-facing, missed because those files were scoped to comments only) | frontend | 23 | — |
| 37 | planned | **Hazard found in #34, RAISED** — `pnpm setup` (`package.json:20`) invokes `scripts/setup.sh`, which runs `npx prisma db push` **and** `npx prisma db seed` unguarded; per `prod-db-differs-from-local` local and prod share ONE Neon database, so running this script writes to production. Both `.sh` scripts also call `npm` while the project standardized on `pnpm`. Also: `setup.sh` has NO shebang and both files are CRLF, so they likely already fail on Linux/macOS. Needs a guard/refusal, not just a translation | backend-api, cto | 34 | — |

Add new entries at the bottom of the relevant section, or start a new section for a new initiative. Use `/task-spec` to produce the Task Spec that backs each entry (see `TASK_TEMPLATE.md`).
