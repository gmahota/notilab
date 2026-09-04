# NotiLab Roadmap

Hand-maintained. Update an entry's Status when work starts/completes — see `10-docs-memory` agent and `/task-spec`. No generator script exists (deliberate — see `docs/memory/decisions.md`, 2026-07-13); keep this file honest rather than automating prematurely.

**Status enum**: `planned` → `in_progress` → `done`, or `blocked`, or `cancelled`.

`blocked` means waiting on something. `cancelled` means decided against — the row stays in the file with its reasoning rather than being deleted, so the decision is auditable and nobody re-proposes it from scratch.

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
| 30 | planned | **Critical, found during this sweep** — `app/api/admin/auth/route.ts` authenticates against 3 hardcoded admins sharing a published bcrypt test-vector hash for `password`, ungated by `NODE_ENV`; plus `lib/admin-auth.ts:4` `JWT_SECRET` falls back to a committed literal on unset/blank. CTO sign-off delivered 2026-09-04 (`docs/memory/decisions.md`); **closed by mission M1 #38–#39**, both done. Still pending independent security review under #60 | security, cto | — | — |
| 31 | done | Translate 8 Portuguese comments in `prisma/schema.prisma` (lines 23, 45, 60, 73, 92, 99, 103, 116) — comments only, no schema change, no migration | database | 23 | — |
| 32 | done | Translate 1 missed Portuguese comment in `components/ai-templates.tsx:73` | frontend | 23 | — |
| 33 | planned | **Inverse gap surfaced by this sweep** — user-facing UI copy is mixed-language: English `placeholder`/`aria-label` strings (`ab-testing.tsx` 170/196, `chat-widget.tsx` 159, `share-panel.tsx` 197, `trending-topics.tsx` 141/148, `hero-section.tsx` 94, `paste-link.tsx` 128) sit alongside Portuguese ones (`admin-category-manager.tsx` 142, `campaign-manager.tsx` 249, `news-editor.tsx` 316). Per § Language Rules these should all be Portuguese. Pre-existing, not caused by #24–#32. Needs `02-editorial-content` sign-off on tone/wording, not a mechanical translation | editorial-content, frontend | 23 | — |
| 34 | done | **Review FAIL #1 (HIGH)** — `scripts/setup.sh` and `scripts/dev-setup.sh` are 100% Portuguese operator scripts, missed entirely by #24–#32 because every scan globbed `*.ts/tsx/mjs/prisma/yml` and never included `*.sh` | backend-api | 23 | — |
| 35 | done | **Review FAIL #2 (MEDIUM)** — revert the 8 example user prompts in `docs/agent-api.md` to Portuguese; they illustrate end-user input to a Portuguese product (content), and now contradict the still-Portuguese example in `lib/agent/tools/articles-read.ts:5` | docs-memory | 23 | — |
| 36 | done | **Review FAIL #3 (LOW)** — translate 2 Portuguese `console.log` debug strings: `components/ai-templates.tsx:74`, `components/workflow-kanban.tsx:236` (developer-facing, missed because those files were scoped to comments only) | frontend | 23 | — |
| 37 | planned | **Hazard found in #34, RAISED** — `pnpm setup` (`package.json:20`) invokes `scripts/setup.sh`, which runs `npx prisma db push` **and** `npx prisma db seed` unguarded; per `prod-db-differs-from-local` local and prod share ONE Neon database, so running this script writes to production. Both `.sh` scripts also call `npm` while the project standardized on `pnpm`. Also: `setup.sh` has NO shebang and both files are CRLF, so they likely already fail on Linux/macOS. Needs a guard/refusal, not just a translation | backend-api, cto | 34 | — |

## Identity & Access — Mission M1, 2026-09-04

Strategy and full rationale: `docs/memory/decisions.md`, 2026-09-04 "Identity model: three human tiers, one session, metered AI". That entry is also the `01-cto` sign-off #30 was waiting for.

**Mission**: replace mocked authentication with a real identity model over three human tiers — visitor, reader (`USER`), staff (`REDATOR`…`SUPER_ADMIN`) — coexisting with the existing machine tier (`/api/agent/*`), make `/profile` truthful, close the access-control defects, and cap AI spend per actor.

**Decisions and interpretations recorded at mission creation:**
- `/missao` as written targets a `tasks/_index.md` registry, a `pnpm task:id` script, and nine agent names (`architect`, `backend`, `frontend-terminal`, `product-finance`, …) that do not exist in this repository — `.claude/commands/missao.md` is untracked and carries another project's conventions. Interpreted per the command's own ambiguity rule, and kept in line with the conventions already in use here: this roadmap is the task registry, and the 11 `.claude/agents/NN-*.agent.md` are the routing targets. Reconciling or removing `missao.md` is #59.
- Phase 0 (#38–#40) is deliberately independent of the identity work. It closes two live defects and must not wait for product decisions.
- Existing rows absorbed rather than duplicated: **#30** (hardcoded admins) → #38–#39; **#22** (dead `user-service.ts`) → #51.
- Phase 1 is **blocked** until #40a resolves migration delivery. A login flow depending on tables production lacks is worse than the current mockup.

### Phase 0 — Stop the bleeding (no dependency on the identity work)

| # | Status | Task | Area | Depends on | Blocks |
|---|---|---|---|---|---|
| 38 | done | Removed the `"your-secret-key"` literal fallback at `lib/admin-auth.ts:4`; blank and whitespace-only now count as absent, and a `MissingSigningSecretError` names the variable and the fix. Added a 32-char floor matching `lib/agent/auth.ts`. **Deviation from the AC as written**: the check throws at *first use* (`requireSigningSecret()`), not at boot. A module-level throw runs during `next build` — this module is imported by 6 admin server components and 4 route handlers — so it would fail the build on a machine that never serves traffic, while proving nothing about the runtime env (CI passes `NEXTAUTH_SECRET`, not `JWT_SECRET`). Every sign and verify routes through the one function, so the check cannot be bypassed; the cost accepted is that misconfiguration surfaces on the first admin request. Also hardened beyond scope: `algorithms: ["HS256"]` pinned on verify (closes `alg:none` and HMAC/RSA confusion) and JWT claims validated on the way in | security | — | 42 |
| 39 | done | Replaced the 3-entry hardcoded admin array with `lib/admin/staff-auth.ts`, authenticating against `User` where `role` is a staff role. `STAFF_ROLES` is now defined once and read by both the login path and `checkAdminAuth`. A null, empty or whitespace-only `User.password` is refused *before* any `bcrypt.compare`, by construction rather than relying on `bcryptjs` returning false. Unknown address, wrong password, deactivated account and reader-without-rights are indistinguishable to the caller — same status, same body — closing a user-enumeration oracle that was not in the original scope, with a per-process decoy hash equalizing latency. Provisioning is `pnpm admin:provision` (`scripts/admin/provision-staff.ts`): dry-run by default, prints the target database host, refuses to overwrite an existing password without `--force-password` or change a role without `--force-role`, rejects the known-compromised passwords, and is wired to no lifecycle hook. **AC met**: no `$2a$` literal in `app/` or `lib/`; a null-password account never authenticates; 58 new specs. **Note**: `admin@notilab.com`, `redator@notilab.com` and `revisor@notilab.com` must be treated as permanently compromised — the hash is in git history | security | 38 | — |
| 40 | planned | **Rescoped 2026-09-04 — no per-user limit on `/api/chat`, by decision.** The original row proposed a per-user rate limit plus an app-level monthly AI ceiling. Dropped: the models are `gpt-4o-mini` / `llama-3.1-8b-instant` at `MAX_TOKENS = 700`, so a message costs on the order of $0.001. Capping readers is product-hostile for negligible saving, and NotiBot is the feature we want people to use heavily. What remains is abuse-only, and the control is **not application code**: set a hard spend cap on the OpenAI and Groq accounts. An in-memory limiter would not share state across serverless instances anyway, and the route already degrades correctly on quota exhaustion via `degradedResponse()` — the worst case is headlines instead of composed prose, not an outage. **AC**: a documented spend cap on both provider accounts, recorded in `DEPLOYMENT.md`; no code change to `app/api/chat/route.ts`. Now the **only** AI cost control in the system, since #53–#56 were cancelled — which makes it load-bearing rather than a backstop | ai-pipeline, cto | — | — |
| 40a | planned | Resolve how migrations reach production before any schema work starts — `prisma migrate deploy` never runs (no `VERCEL_TOKEN`, see `prod-deploys-bypass-ci`) and local shares one Neon database with production (`prod-db-differs-from-local`). **AC**: a written, rehearsed procedure for applying an additive migration to production, plus a Neon branch database for local `migrate dev` | cto, database | — | 41, 53 |

### Phase 1 — Session foundation

| # | Status | Task | Area | Depends on | Blocks |
|---|---|---|---|---|---|
| 41 | blocked | Additive migration for the Auth.js v5 Prisma adapter (`Account`, `Session`, `VerificationToken`). No change to existing models. **AC**: migration applies forward on a Neon branch and rolls back cleanly; no existing table altered | database | 40a | 42 |
| 42 | planned | `lib/auth/session.ts` (`getSession`) + `lib/auth/require.ts` (`requireUser`, `requireRole`); rewrite `checkAdminAuth()` as a wrapper so the 10 existing call sites keep working unchanged. Replace the inline role array at `lib/admin-auth.ts:20` with the tier matrix. **AC**: specs cover `requireRole` for all 8 `UserRole` values; a null `User.password` never authenticates | security | 38, 41 | 43, 44 |
| 43 | planned | `middleware.ts` doing **presence-only** cookie redirect with `jose` — `jsonwebtoken` is Node-only and throws on the edge runtime. Authoritative role checks stay in server components and route handlers. **AC**: middleware runs on the edge with no Node built-in; a `USER` hitting `/admin` is redirected; removing the middleware does not make any endpoint authorized | security | 42 | — |
| 44 | planned | `GET`/`PATCH /api/me` deriving the user from the session; retire `GET`/`PUT /api/user`. **AC**: no route handler reads `userId` from a query string or body; `GET /api/user?userId=<other id>` no longer returns that user's data | backend-api | 42 | 45, 50 |

### Phase 2 — Reference module

| # | Status | Task | Area | Depends on | Blocks |
|---|---|---|---|---|---|
| 45 | planned | **Reference module** — `/profile` Preferências tab end to end on real data: `components/user-preferences.tsx` reads from `/api/me`, writes persist, plus visitor / loading / empty states. Chosen because it is the only tab exercising read *and* authenticated write *and* role-neutral rendering; #46–#49 copy its shape. **AC**: a reader's saved preferences survive sign-out and reappear on another device; a visitor sees sign-in, not defaults presented as theirs; zero module-level `const` data left in the file | frontend | 44 | 46, 48, 49 |

### Phase 3 — Replicate across the remaining tabs, close the access-control defects

| # | Status | Task | Area | Depends on | Blocks |
|---|---|---|---|---|---|
| 46 | planned | Histórico tab on real `ReadHistory`. **AC**: no Jan-2024 fixtures remain; an account with no history shows an empty state, not sample rows | frontend | 45 | — |
| 47 | planned | Decide whether the gamification achievements exist as product rules at all — `components/gamification-dashboard.tsx` invents "Especialista IA", "Explorador", a 15 600-user leaderboard and a level-12 profile, none of which any schema field backs. **AC**: a written ruling per badge — define it as a rule, or delete it | editorial-content | — | 48 |
| 48 | planned | Dashboard tab on real `points`/`level`/`UserStreak`. Any badge #47 did not define is **removed**, not simulated. **AC**: every number rendered traces to a schema field or a documented derivation; no hardcoded rank or user total | frontend | 45, 47 | — |
| 49 | planned | Feed Personalizado on real ranking + `UserPreferences.categories`. **AC**: changing a category preference in #45 visibly changes this tab; every `personalizedReason` string is derived, not authored | frontend, backend-api | 45 | — |
| 50 | planned | Derive `userId` from the session in `app/api/user/react`, `app/api/user/save`, `app/api/growth/streak` — all three currently accept any `userId` from the client. **AC**: each endpoint rejects a body-supplied `userId`; a reaction, save and streak recorded while signed in as A never attach to B | backend-api | 44 | — |
| 51 | planned | Delete `lib/user-service.ts` and `lib/social-service.ts` (this is #22, folded in — `user-service` fetches five endpoints that never existed, so it must not become the model for #44's client). **AC**: both files gone, `pnpm build` clean | backend-api | 44 | — |
| 52 | planned | Real auth state in `components/navigation.tsx:55-69` — today it renders a static avatar plus Profile / My Feed / Sign Out unconditionally, to visitors included. **AC**: a visitor sees sign-in; a signed-in user sees their own name and avatar; Sign Out actually ends the session | frontend | 42 | — |

### Phase 4 — AI spend metering

| # | Status | Task | Area | Depends on | Blocks |
|---|---|---|---|---|---|
| 53 | cancelled | ~~`AiUsage` ledger model + per-user quota override fields.~~ **Cancelled 2026-09-04** with #54–#56: the AI quota subsystem was dropped by decision. Spend visibility now lives in the OpenAI/Groq dashboards rather than in the application. Recoverable from this row if the position changes | database | — | — |
| 54 | cancelled | ~~Required `actor` on `callAI`, persist the provider `usage` object, refuse over-quota calls.~~ **Cancelled 2026-09-04.** **Note what is lost, separately from the quotas**: `lib/ai-processing/call-ai.ts` discards the provider `usage` object on every call, so the application records nothing about its own AI spend. That was the *metering* half of this row and it dies with the enforcement half. Re-open as a metering-only row if per-call attribution is ever wanted | ai-pipeline | — | — |
| 55 | cancelled | ~~Admin surface for per-user quota override and the global ceiling kill-switch.~~ **Cancelled 2026-09-04** — nothing left to administer. Consequence: there is no in-app way to stop AI spend; the only lever is the provider dashboard, which requires someone to be watching it | frontend, backend-api | — | — |
| 56 | cancelled | ~~Set the AI allowance numbers per tier (visitor / reader / staff / agent).~~ **Cancelled 2026-09-04** — allowances only existed to feed #54. With no quota system there is no allowance to set | editorial-content, cto | — | — |

### Phase 5 — Continuity, docs, and mission close

| # | Status | Task | Area | Depends on | Blocks |
|---|---|---|---|---|---|
| 57 | planned | Claim anonymous history on sign-up: backfill `UserEvent.userId` where `sessionId` matches. **AC**: claims once only, inside a capped window, and never claims reactions or saves (they imply intent); a shared device cannot attribute a previous person's reading to a new account | backend-api | 42 | — |
| 58 | planned | Update `docs/memory/architecture.md:26` (still describes auth as admin-only JWT), add the three-tier matrix to `business-rules.md`, close #22 and #30. **AC**: no memory file still describes the mocked model | docs-memory | 44, 51 | — |
| 59 | planned | Reconcile or remove `.claude/commands/missao.md` — untracked, and refers to `tasks/_index.md`, `pnpm task:id`, `.claude/agents/cto.md` and nine agent names that do not exist here. A slash command naming absent infrastructure will mislead the next session. **AC**: either rewritten against this repository's roadmap + 11-agent roster, or deleted | docs-memory | — | — |
| 60 | planned | **Mandatory independent review** of M1 by an agent that did not implement it — `09-testing` for the mission as a whole, `08-security` for #38–#44 and #50 specifically, neither having written that code. Max 2 rejection cycles, then `blocked` with a reason. **AC**: `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test` all run in-session with output shown; every AC above verified against running code, not against the diff | testing, security | 38–59 | — |

> **Not covered by M1, tracked separately**: why the quality gate passed green with both defects live. Spun off as its own task — the gate's blind spot is a process defect, not part of this mission.

Add new entries at the bottom of the relevant section, or start a new section for a new initiative. Use `/task-spec` to produce the Task Spec that backs each entry (see `TASK_TEMPLATE.md`).
