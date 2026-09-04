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
| 38 | done | **Delivered by PR #109**, not by the branch that opened this row. Removed the `"your-secret-key"` fallback at `lib/admin-auth.ts:4`, using `.trim()` plus an explicit emptiness test rather than a truthy-OR fallback (which treats `""` as absent — here the blank case was the dangerous one); minimum 32 characters. **Failure is asymmetric on purpose**: `checkAdminAuth()` returns null and never throws, because it runs inside six server components where a throw breaks the page or the prerender, and all ten call sites already treat null as "not signed in"; `generateAdminToken()` throws, and the login route turns that into a 503. `cookies()` is called first and outside the try block — Next signals dynamic rendering by throwing `DynamicServerError` from it, so swallowing that would let the admin pages prerender as **static**, i.e. an auth check that never runs per request. `algorithms: ["HS256"]` pinned on both sign and verify. `decoded as any` replaced with a real guard over `unknown`: a valid signature proves the token came from us, not that its claims are sane. Admin roles derive from a `Record<UserRole, boolean>` over the Prisma enum, so adding a role fails typecheck until someone decides whether it is administrative | security | — | 42 |
| 39 | done | **Delivered by PR #109.** The three hardcoded accounts are gone; staff come from the `User` table. A null or blank stored password, an inactive account and a non-admin role are each rejected on their own branch and never reach `bcrypt.compare` with a null hash. One frozen 401 body for every credential rejection, closing the `"Usuário não encontrado"` / `"Senha incorreta"` enumeration oracle. Exactly one bcrypt compare on every path — against a dummy hash at the same cost factor on a miss, computed *before* the rejection reason so the order of the checks cannot itself leak; this narrows the timing channel rather than closing it, since the database lookup still varies. **Login is rate limited** (`lib/admin-login-rate-limit.ts`, 10 per 15 min) ahead of the JSON parse and the query, so a throttled client costs neither a round trip nor a bcrypt. `BCRYPT_COST = 12` lives once in `lib/admin-password.ts` so the route and the provisioning script cannot drift — a cost mismatch between the real and dummy hashes hands back the oracle it was added to close. Provisioning is `pnpm admin:provision --email … --confirm-production-write` (`scripts/admin/provision-admin.ts`). Account lockout rejected by design: the admin email is public, so a lockout is a DoS lever. **`admin@notilab.com`, `redator@notilab.com` and `revisor@notilab.com` stay permanently compromised** — the hash is in git history | security | 38 | — |
| 40 | planned | **Rescoped 2026-09-04 — no per-user limit on `/api/chat`, by decision.** The original row proposed a per-user rate limit plus an app-level monthly AI ceiling. Dropped: the models are `gpt-4o-mini` / `llama-3.1-8b-instant` at `MAX_TOKENS = 700`, so a message costs on the order of $0.001. Capping readers is product-hostile for negligible saving, and NotiBot is the feature we want people to use heavily. What remains is abuse-only, and the control is **not application code**: set a hard spend cap on the OpenAI and Groq accounts. An in-memory limiter would not share state across serverless instances anyway, and the route already degrades correctly on quota exhaustion via `degradedResponse()` — the worst case is headlines instead of composed prose, not an outage. **Amended again 2026-09-04**: the cost control is now **two layers**, by decision. (1) A hard spend cap of **$5 per provider per month** set in the OpenAI and Groq account consoles — outside the application, unbypassable, the final backstop. (2) `OPENAI_MONTHLY_BUDGET_USD` and `GROQ_MONTHLY_BUDGET_USD`, defaulting to `5`, read by `callAI` and enforced as a **global** ceiling against the month-to-date `AiUsage` sum — never a per-user limit, which stays rejected. At ~$0.001 per message, $5 is roughly 5,000 messages per month per provider. **Caveat to verify before claiming layer 1 is done**: on Groq's free tier there is no billing to cap — it rate-limits instead — so the console may have nowhere to put a dollar figure. **AC**: both env vars documented in `DEPLOYMENT.md` with the console cap; `/api/chat` unchanged except that an over-budget call reaches `degradedResponse()` | ai-pipeline, cto | — | 54 |
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
| 53 | blocked | **Un-cancelled 2026-09-04, metering-only.** `AiUsage` model: `actor`, `provider`, `model`, `promptTokens`, `completionTokens`, `costUsd`, `createdAt`, indexed on `(provider, createdAt)` for the month-to-date sum. **No per-user quota override fields** — those belonged to the enforcement design that stays cancelled. **Blocked, and this is the real obstacle to the whole budget feature**: adding a model means `prisma db push` against the shared Neon instance, which per `prod-db-differs-from-local` *is* a production write, and `prisma migrate deploy` never runs in CI per `prod-deploys-bypass-ci`. The table is additive and safe in shape, but there is no delivery path that is not a manual write to production. Needs the operator to run it deliberately, or #40a to resolve migration delivery first | database | 40a | 54 |
| 54 | planned | **Un-cancelled 2026-09-04 as metering plus a global ceiling — no per-user quota.** `lib/ai-processing/call-ai.ts` parses the response into `data` and returns only `data.choices[0].message.content`, so the `usage` object it already receives is thrown away on every call. Make `actor` required on `callAI` (`user:<id>` / `agent:<id>` / `system:<cron>`) so the **3** call sites must declare one — `app/api/chat/route.ts:119`, `lib/ai-generate-service.ts:222`, `lib/ai-processing/processor.ts:99`; earlier revisions of this row and of `decisions.md` said "five call sites", which was wrong. Convert tokens to USD with a per-model price table (`gpt-4o-mini`, `llama-3.1-8b-instant`) held next to the provider calls, write one `AiUsage` row per call, and **before** the call refuse when the calendar-month sum for that provider is at or over its budget. **AC**: typecheck fails if a call site omits an actor; every call writes a row; an over-budget `/api/chat` returns the existing `degradedResponse()` with real headlines, never an error or a 429; no per-user limit exists anywhere in the path | ai-pipeline | 53 | — |
| 55 | cancelled | ~~Admin surface for per-user quota override and the global ceiling kill-switch.~~ **Stays cancelled 2026-09-04**, but the reason changed. The per-user override is dead with the per-user quota. The kill-switch is no longer *missing*, only no longer a UI: setting `OPENAI_MONTHLY_BUDGET_USD` or `GROQ_MONTHLY_BUDGET_USD` to `0` under #40 stops that provider's spend at the next call, so the lever exists — it just needs an env change and a redeploy rather than a button. Build the surface only if someone actually needs to trip it without a deploy | frontend, backend-api | 54 | — |
| 56 | cancelled | ~~Set the AI allowance numbers per tier (visitor / reader / staff / agent).~~ **Cancelled 2026-09-04** — allowances only existed to feed #54. With no quota system there is no allowance to set | editorial-content, cto | — | — |

### Phase 5 — Continuity, docs, and mission close

| # | Status | Task | Area | Depends on | Blocks |
|---|---|---|---|---|---|
| 57 | planned | Claim anonymous history on sign-up: backfill `UserEvent.userId` where `sessionId` matches. **AC**: claims once only, inside a capped window, and never claims reactions or saves (they imply intent); a shared device cannot attribute a previous person's reading to a new account | backend-api | 42 | — |
| 58 | planned | Update `docs/memory/architecture.md:26` (still describes auth as admin-only JWT), add the three-tier matrix to `business-rules.md`, close #22 and #30. **AC**: no memory file still describes the mocked model | docs-memory | 44, 51 | — |
| 59 | planned | Reconcile or remove `.claude/commands/missao.md` — untracked, and refers to `tasks/_index.md`, `pnpm task:id`, `.claude/agents/cto.md` and nine agent names that do not exist here. A slash command naming absent infrastructure will mislead the next session. **AC**: either rewritten against this repository's roadmap + 11-agent roster, or deleted | docs-memory | — | — |
| 60 | planned | **Mandatory independent review** of M1 by an agent that did not implement it — `09-testing` for the mission as a whole, `08-security` for #38–#44 and #50 specifically, neither having written that code. Max 2 rejection cycles, then `blocked` with a reason. **AC**: `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test` all run in-session with output shown; every AC above verified against running code, not against the diff | testing, security | 38–59 | — |
| 61 | planned | **Surviving deltas from the superseded PR #110**, worth keeping now that #109 is the base. (a) `app/api/admin/auth/route.ts` is **204 lines** with the credential logic inline — over the 120-line threshold `cto-review.yml` warns on, and not unit-testable in isolation; extract it to `lib/admin/staff-auth.ts` behind an `authenticateStaff(email, password)` returning a discriminated result, leaving the route to parse, set the cookie and map. (b) Email is not normalized: login is case-sensitive, so `You@x.com` fails against a row stored as `you@x.com`. Normalize on both read and write, with an exact unique match rather than `findFirst` + `mode: "insensitive"` — an auth path must never pick an arbitrary row. (c) The three extra specs written for #110 (215 + 263 + 202 lines) cover cases #109's suite does not. Files preserved outside the repository; recover them from PR #110's diff | security, testing | 39 | — |
| 62 | planned | **Every admin route accepts any admin role** — flagged as deliberately out of scope by PR #109 and recorded here so it is not lost: a `REDATOR` token has the same reach as `SUPER_ADMIN` across all of `/api/admin/**` and `/admin`. Deciding which role may do what is an editorial call, not a security one, so it needs `02-editorial-content` sign-off on the matrix before `requireRole` can enforce it. Interim mitigation is operational: provision exactly one `SUPER_ADMIN` and no other staff account until #42 lands | security, editorial-content | 42 | — |
| 63 | planned | **The quality gate did not run on PR #110 at all** — `gh run list` returned zero runs for the branch, and `gh pr checks` showed only GitGuardian and Vercel, both external integrations. None of `ci-cd.yml`, `security.yml` or `cto-review.yml` executed, despite all three declaring `pull_request` triggers against `main`. So lint, typecheck, build, CodeQL, `pnpm audit` and Gitleaks gate nothing today, and `QUALITY_GATE.md` describes enforcement that is not happening. Most likely GitHub Actions is disabled at the repository or organization level. **AC**: determine why, re-enable, and confirm a PR shows the workflow checks; correct `QUALITY_GATE.md` to state what is actually enforced | testing, cto | — | — |

> **Not covered by M1, tracked separately**: why the quality gate passed green with both defects live. Spun off as its own task — the gate's blind spot is a process defect, not part of this mission.

Add new entries at the bottom of the relevant section, or start a new section for a new initiative. Use `/task-spec` to produce the Task Spec that backs each entry (see `TASK_TEMPLATE.md`).
