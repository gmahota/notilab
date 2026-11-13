# NotiLab — User Story Backlog (draft, pending maintainer validation)

**Status: proposal.** Nothing in this file has been implemented. It restates the
open work already recorded in `ROADMAP.md`, `docs/editor/*` and
`docs/manager/strategy/ingestion-editorial-gate.md` as user stories with a goal,
verifiable acceptance criteria, dependencies, risks and a test plan — and splits
the oversized rows into shippable slices.

It does not replace `ROADMAP.md`. The roadmap stays the status register; each
story below names the roadmap row it derives from, so the two can be reconciled
rather than diverging.

**Priorities**

- **P0** — a live defect, a legal/editorial exposure, or a blocker for everything behind it.
- **P1** — committed scope of an in-flight mission.
- **P2** — real value, no one blocked on it.
- **P3** — hygiene; do it when the area is open anyway.

**Size** — S = under a day, M = one to three days, L = must be split further
(no story below is L; that is the point of this pass).

---

## Part 1 — What already exists

Verified against the working tree on 2026-11-13, not inferred from docs.

### Reader surface (shipped, real data)

| Area | Where | Notes |
|---|---|---|
| Feed, article, category, trending pages | `app/page.tsx`, `app/feed`, `app/article/[slug]`, `app/category/[slug]`, `app/trending` | Real queries via `lib/news-service.ts` |
| Immersive `/now` surface | `app/now`, `app/now/explorar`, `app/now/perto`, `app/now/seguir`, `components/immersive/*` | Fetches live |
| NotiBot chat | `app/chat`, `app/api/chat`, `lib/chat-service.ts` | `gpt-4o-mini` / `llama-3.1-8b-instant`, `MAX_TOKENS = 700` |
| Explain-it | `app/explain/[id]`, `app/api/ai/explain` | |
| Digest subscription | `app/digest`, `app/api/digest/subscribe` | |
| Reddit news | `app/reddit-news`, `app/api/reddit-news` | |
| Share / referral links | `app/s/[code]`, `app/api/growth/share/*` | `ShareVisit.ipHash`, raw IP never stored |

### Pipelines (shipped)

| Pipeline | Entry | Schedule |
|---|---|---|
| Ingestion (GNews / NewsAPI / RSS / Reddit) | `app/api/cron/sync-news`, `lib/ingestion/*` | `0 20 * * *` |
| AI enrichment (`summary`/`tldr`/`whyItMatters`/`explainLikeIm10`) | `app/api/cron/process-ai-news`, `lib/ai-processing/*` | `0 22 * * *` |
| Ranking / trending recalculation | `app/api/cron/recalculate-ranking`, `lib/ranking.ts`, `lib/trends.ts` | `0 0 * * *` |
| Digest generation and send | `app/api/cron/generate-digest`, `send-digest`, `lib/digest.ts` | `0 2`, `0 5` |
| Messaging delivery (Telegram, WhatsApp) | `app/api/cron/send-messaging`, `lib/messaging/*` | `0 7 * * *` |
| Scheduled publish | `app/api/cron/publish-scheduled` | **not wired in `vercel.json`** — operator decision |

Ingestion already does: provider fetch → normalize → quality gate (`quality.ts`:
domain allowlist, `mustMatch` relevance, length) → image-rights allowlist
(`image-rights.ts`, Phase 1, shipped 2026-11-06) → dedupe → story clustering
(`cluster.ts`) → persist → AI queue.

### Machine surface (shipped, tested)

`/api/agent/*` (capabilities, health, openapi, tools) and `/api/mcp` with
`lib/agent/*` and `lib/mcp/*`: auth, permissions, rate limit, idempotency,
audit, confirmation gate on four critical lifecycle tools. This is the
best-covered area of the codebase.

### Admin surface (partly real, partly a shell)

| Screen | State |
|---|---|
| `/admin/login`, `app/api/admin/auth` | **Real** — staff from the `User` table, bcrypt, rate limited (PR #109) |
| `/admin` overview | **Real** — `lib/admin/overview.ts` |
| `/admin/ai-generator` | **Real** — `lib/ai-generate-service.ts` |
| `/admin/marketing` (experiments) | **Real** — `app/api/admin/experiments`, `lib/admin/experiment-results.ts` |
| `/admin/news` (`components/admin-news-manager.tsx`) | **Shell** — 334 lines, 0 `fetch` calls |
| `/admin/workflow` (`components/workflow-kanban.tsx`) | **Shell** — 241 lines, 0 `fetch` calls |
| `/admin/categories` | Component-level only |

There is no `app/api/admin/articles/**`. Article lifecycle logic exists in
`lib/editorial/article-service.ts` (tested) but has no admin HTTP surface.

### Reader account surface (mock)

`/profile`'s four tabs — Dashboard, Preferências, Histórico, Feed Personalizado —
render from hardcoded state: `user-preferences.tsx` (322 lines, 0 `fetch`),
`gamification-dashboard.tsx` (278 lines, 0 `fetch`, 0 `useState`),
`navigation.tsx` (104 lines, 0 `fetch`) shows an avatar and "Sign Out" to
visitors included. There is no reader login.

### Tests

20 spec files under `__tests__/`. Covered: `lib/agent/*` (7 files), `lib/mcp/*`,
`lib/ranking.ts`, `lib/editorial/*`, `lib/ingestion/cluster.ts`,
`lib/ingestion/image-rights.ts`, `lib/admin-auth.ts`, `lib/base-url.ts`,
`lib/log-safe.ts`. **Not covered**: `lib/ai-processing/*`, `lib/trends.ts`,
`lib/ranking-recalculate.ts`, `lib/digest.ts`, `lib/messaging/*`,
`lib/ingestion/quality.ts`, `lib/ingestion/normalize.ts`, `lib/growth/*`.
`pnpm test` is **not** a CI job.

---

## Part 2 — Where the new needs come from

1. **Uncommitted working tree (2026-11-12 scope pivot).** `lib/ingestion/providers.ts`,
   `normalize.ts`, `quality.ts`, `prisma/seed.ts` and the untracked
   `scripts/db/ensure-categories.ts` repoint ingestion at **US celebrities, club
   football (EN/PT/ES/IT + PSG), financial markets**. No decision entry, no
   `content-focus.md` update, no roadmap row records this. → Epic A.
2. **`docs/manager/strategy/ingestion-editorial-gate.md`** + `docs/editor/ingestion-editorial-workflow.md`
   + `docs/editor/writing-style.md` — agreed spec for collect → rewrite → rights
   → approve → publish. → Epic B.
3. **Mission M1 (Identity & Access)**, roadmap #38–#63. → Epics C, D.
4. **Quality-gate rows** #5, #13, #21, #63. → Epic E.
5. **AI metering** #53, #54. → Epic F.
6. **Operational hazards** #37, #40a, #59. → Epic G.

---

## Epic A — Record the editorial scope pivot (P0, governance debt)

The code is already written and uncommitted. These stories make it legible and
land it; they do not re-decide the scope.

> **Status 2026-11-13: A1 and A2 done, A3 partial.** Tracked as roadmap #75–#77,
> with the gaps they surfaced as #78–#83. The dry-run ran: the noise channel is
> closed (0 rejections by shape, 0 by relevance) but **A3's volume criterion
> fails** — 23 articles/run against a 16/day reviewable rate — and three
> off-scope items cleared every gate from allowlisted outlets. Measurement:
> `docs/manager/strategy/scope-v2-intake-measurement.md`. Everything below is
> kept as written; the acceptance criteria are what the rows were validated
> against.

### A1 — Ratify the 2026-11-12 scope in the editorial policy
**P0 · S · owner: `02-editorial-content`**

As the maintainer, I want the active content scope written down, so that the
categoriser, the seed and the policy cannot drift apart again.

**AC**
- `docs/editor/content-focus.md` carries a v2 section stating the active scope (US celebrities, club football EN/PT/ES/IT + PSG, financial markets) and marking the v1 pivot and the v1.1 film addendum **superseded**, not deleted.
- The doc states explicitly that `mocambique`, `africa-do-sul` and `filmes` keep their `CATEGORY_RULES` entries while no `SYNC_QUERY` feeds them, and why (a genuinely on-topic stray still lands truthfully instead of in `general`).
- `docs/memory/decisions.md` has a 2026-11-12 entry with the decision, who made it, and what it replaces.
- The editorial-sensitivity note for Mozambique / South Africa survives into v2 or is explicitly retired.

**Depends on** — nothing. **Blocks** — A2, A3.
**Risks** — the previous pivot (#17–#19) left 142 out-of-scope articles behind; this one will do the same at a smaller scale. Record the expectation now, do not act on it here.
**Tests** — none (documentation). Review by the maintainer.

### A2 — Land the scope change with the categoriser and the database in step
**P0 · S · owner: `06-integrations-social` + `05-database`**

As an operator, I want every slug the categoriser can emit to exist as a
`Category` row, so that no article is silently demoted to `general`.

**AC**
- `celebridades` and `economia` exist in the live `Category` table before the next 20:00 sync.
- `scripts/db/ensure-categories.ts` is committed, has the `--confirm-production-write` guard, and converges on a re-run (upsert by slug) — per `neon-drops-mid-batch`.
- `REQUIRED_CATEGORIES` in the script and `CATEGORY_RULES` in `normalize.ts` list the same slugs; a diff between them is visible, not silent.
- `pnpm ingest:dry-run` writes nothing and reports the new queries' accept/reject counts.

**Depends on** — A1. **Blocks** — A3.
**Risks (P0)** — local and production share one Neon instance (`prod-db-differs-from-local`); the script writes to production by definition. Never run `pnpm db:seed` for this: it also inserts demonstration articles into a live feed.
**Tests** — unit test on the slug-parity check; `pnpm ingest:dry-run` output attached to the PR; a manual read of `Category` after the run.

### A3 — Prove the new queries do not reopen the noise channel
**P0 · S · owner: `06-integrations-social`**

As the maintainer, I want evidence that the new query set is no noisier than the
one it replaces, so that the feed does not refill with junk.

**AC**
- A dry-run report for all 10 queries: accepted, rejected-by-domain, rejected-by-`mustMatch`, rejected-by-length.
- Every short `mustMatch` term is spelled out so substring matching cannot misfire (`inter milan`, not `inter`) — stated and checked, since `quality.ts` matches accent-blind substrings while `normalize.ts` does not strip accents.
- The 23 newly allowlisted domains each have a named reason (outlet desk, not aggregator).
- Intake stays at or under the reviewable rate measured in Phase 0 (**15.3/active day**, reviewer capacity **16/day**) — if the new set exceeds it, queries are cut before merge, per risk R3.

**Depends on** — A2.
**Risks** — `ingestion-noise-sources`: providers do full-text OR matching and GNews has burst limits; a wider query set silently costs quota before it costs quality. Keep the list at ≤ 10.
**Tests** — new specs for `quality.ts` (`mustMatch` accent-blind substring behaviour) and `normalize.ts` (category routing for the new slugs). Both files are currently untested.

---

## Epic B — Ingestion editorial gate (P0/P1, the main project)

Spec: `docs/editor/ingestion-editorial-workflow.md` (meaning),
`docs/manager/strategy/ingestion-editorial-gate.md` (architecture).
Roadmap #64–#74. Phase 1 (image rights) shipped; Phase 0 measured.

### B1 — Strip provider truncation and know how much text we actually hold
**P0 · S · owner: `06-integrations-social`** *(roadmap #66, slice 1 of 2)*

As an editor, I want to know which stored articles are snippets rather than
articles, so that nothing is rewritten from a truncated stub.

**AC**
- A read-only report: count and share of `News.content` under 500 chars, and count carrying a provider truncation marker (`[+N chars]` and the NewsAPI variants).
- Known markers are stripped at normalize time; the trailing ellipsis a marker leaves behind is removed with it.
- `quality.ts`'s 200-char floor is re-stated against the report — either justified or raised, with the number written down.
- No article is dropped by this story; it measures and cleans, it does not gate.

**Depends on** — A3 (so the measurement reflects the new scope).
**Blocks** — B2, B5.
**Risks** — raising the floor silently cuts intake; decide the number with the report in hand, not from intuition.
**Tests** — unit specs for marker stripping (one case per known marker shape, plus a body that legitimately ends in an ellipsis).

### B2 — Fetch the real article text
**P0 · M · owner: `06-integrations-social`** *(roadmap #66, slice 2 of 2)*

As an editor, I want the full source text stored, so that the rewrite is grounded
in the reporting rather than in a two-sentence lead.

**AC**
- Pipeline step fetches the article body from `sourceUrl` for articles whose stored content is below the B1 floor.
- Fetch failure leaves the article with its snippet and a recorded reason — it never drops the article and never fabricates length.
- `robots.txt` and a per-host rate limit are respected; the fetcher identifies itself with a generic client name and no personal data.
- Provenance is untouched: `sourceUrl`, `sourceName`, `sourceId` survive the step (`business-rules.md` § provenance).
- A host that blocks us is logged the way `quality.ts` logs rejected domains — visible, not swallowed.

**Depends on** — B1. **Blocks** — B5 (rewriting a snippet is the failure mode this prevents).
**Risks** — legal: fetching full text widens the republication exposure that the rewrite step exists to close; it is only safe *because* B5–B9 follow. Also: fetch latency inside the 60s cron budget — this must not starve ingestion.
**Tests** — unit specs with fixture HTML (success, 403, timeout, redirect, paywall interstitial); `pnpm ingest:dry-run` end to end.

### B3 — Schema columns for the rewrite
**P1 · S · owner: `05-database` + human operator** *(roadmap #67)*

As an engineer, I want the rewrite's own columns and counters, so that a rewrite
failure does not burn enrichment's retries.

**AC**
- Five nullable, no-default, no-index columns on `ArticleAI`: `titleRewritten`, `contentRewritten`, `rewriteAttempts`, `rewriteError`, `rewrittenAt`.
- No existing column is altered; no code reads the new ones yet (inert).
- `pnpm db:generate` + `pnpm typecheck` clean; the columns are confirmed present by reading the live table.
- The rewrite counters are **not** shared with enrichment's `attempts`/`lastError`.

**Depends on** — B4 (migration delivery must be settled first). **Blocks** — B5.
**Risks (P0 operational)** — `prisma migrate deploy` has never run against production (`prod-deploys-bypass-ci`); this is a manual write to the shared Neon instance. Not revertible, but inert. No agent runs it.
**Tests** — `pnpm db:generate`, `pnpm typecheck`, a live column read.

### B4 — Decide how migrations reach production
**P0 · S · owner: `01-cto` + maintainer** *(roadmap #40a)*

As the maintainer, I want one rehearsed procedure for applying a migration, so
that schema work stops being improvised against a live database.

**AC**
- A written procedure covering: where the migration is rehearsed (Neon branch), who runs it, how it is verified, and how it is rolled back.
- The procedure states plainly that the CI deploy job does not run and does not apply migrations.
- One migration is rehearsed end to end on a branch before B3 ships.

**Depends on** — nothing. **Blocks** — B3, C1, F1.
**Risks** — `lab-phase-accepts-db-loss` says database loss is acceptable while designing; that acceptance must be re-confirmed, not assumed, now that there is a 72-row corpus and live readers.
**Tests** — the rehearsal itself is the test.

### B5 — Rewrite worker in shadow mode
**P1 · M · owner: `07-ai-pipeline`** *(roadmap #68, slice 1 of 2)*

As a reader, I want articles written in NotiLab's voice rather than republished
verbatim, so that the site publishes its own work.

**AC**
- New `lib/ai-processing/rewrite/` and `app/api/cron/rewrite-articles` at `0 21 * * *` — a separate module and cron, **not** a phase inside `runAiBatch` (a rewrite timeout inside that shared 60s budget starves enrichment, which is the only thing keeping Portuguese headlines alive).
- The worker fills the B3 columns; nothing reads them; articles still publish exactly as today.
- Prompt is grounded-only: no fact, number, quote, date or rating may appear that `News.content`/`sourceUrl` does not support (`ingestion-editorial-workflow.md` § 2.4).
- The prompt encodes `docs/editor/writing-style.md` — register, headline rules, the settled Portuguese variant and spelling.
- A rewrite failure sets `rewriteError` and leaves the article un-rewritten; it **never** falls back to the raw source text.
- `actor` is passed on every `callAI` call (`system:cron:rewrite-articles`).

**Depends on** — B2, B3. **Blocks** — B6.
**Risks (Critical)** — this is the point where the failure mode shifts from attribution to **fabrication** (strategy R4). Shadow mode is the mitigation: nothing reaches readers until B6 and B7 pass.
**Tests** — unit specs for prompt assembly and output parsing; a fixture-driven test that a refusal or empty completion produces `rewriteError`, not content.

### B6 — Rewrite batch survives an interrupted run
**P1 · S · owner: `07-ai-pipeline`** *(roadmap #68, slice 2 of 2)*

As an operator, I want a re-run after a dropped connection to resume rather than
re-bill, so that a Neon drop does not cost a second pass of AI spend.

**AC**
- Re-running the cron after a mid-batch failure processes exactly the unfinished rows and re-bills none of the completed ones.
- Batch size and `maxDuration` are set from the Phase 0 numbers (15.3 articles/active day), not from intuition.
- The worker is idempotent per article: a row with `rewrittenAt` set is skipped.

**Depends on** — B5. **Blocks** — B7.
**Risks** — `neon-drops-mid-batch`: long batches lose the connection partway, so convergence on re-run is a requirement, not a nicety.
**Tests** — a spec that interrupts after N rows and asserts the second pass touches only the remainder; manual `curl` with `CRON_SECRET`.

### B7 — Editorial sign-off on rewrite quality
**P1 · S · owner: `02-editorial-content`** *(roadmap #69)*

As the editorial owner, I want to read real rewrites before any of them can reach
a reader, so that the gate is judged on output, not on code merging.

**AC**
- N rewritten articles inspected against `ingestion-editorial-workflow.md` § 2.4: new facts, sharpened hedges, manufactured quotes, invented ratings, added framing on sensitive categories.
- A written verdict per failure mode — pass, or specific prompt changes required.
- Sign-off is recorded in `docs/memory/decisions.md`.

**Depends on** — B6, B17. **Blocks** — B8.
**Risks** — this is editorial judgement; no command substitutes for it, and nothing downstream may proceed on a "looks fine".
**Tests** — none automatable, by design.

### B8 — Reviewer identity on every transition
**P0 · S · owner: `04-backend-api` + `08-security` review** *(roadmap #70, slice 1 of 5)*

As a supervisor, I want every lifecycle transition attributed to a person, so
that approval is accountable rather than theatre.

**AC**
- `transitionArticle()` takes a reviewer identity and persists it to `News.reviewerId`.
- Every transition writes an `AdminAction` row (`action`, `resource`, `resourceId`) — per `business-rules.md`.
- A transition without an identified actor is rejected, not defaulted.

**Depends on** — C3 (`requireRole`). **Blocks** — B9, B13.
**Risks** — without this, the whole gate is decoration; it is the first slice for that reason.
**Tests** — extend `__tests__/lib/editorial/article-service.test.ts`: identity required, `AdminAction` written, illegal transitions still rejected.

### B9 — Admin article lifecycle API
**P1 · M · owner: `04-backend-api`** *(roadmap #70, slice 2 of 5)*

As an editor, I want HTTP endpoints for the article queue and its transitions, so
that the admin UI has something real to call.

**AC**
- `app/api/admin/articles/**`: list (filter by status/stage), read one, transition.
- Handlers stay thin — validate, call `lib/editorial/`, map the result; no business logic in the route (`AGENTS.md` § Next.js rules).
- Responses use `{ success: true, data }` / `{ success: false, error }`.
- Auth via `lib/admin-auth.ts` / `requireRole`; never an ad hoc check.
- The queue can be ordered by `importanceScore` (risk R3b: an uncleared queue should lose the least important articles, not the newest).

**Depends on** — B8. **Blocks** — B10.
**Risks** — this is where scope creep lives; multi-revision history, image re-evaluation state and per-source policies are explicitly out of scope.
**Tests** — route specs per verb, including a non-permitted role receiving 403.

### B10 — Review queue on real data
**P1 · M · owner: `03-frontend`** *(roadmap #70, slice 3 of 5)*

As a reviewer, I want the admin news and workflow screens to show real articles,
so that the queue reflects the database.

**AC**
- `components/admin-news-manager.tsx` and `components/workflow-kanban.tsx` fetch from B9 — no `useState` fixture arrays remain in either file.
- Loading, empty and error states exist; an empty queue shows an empty state, not sample rows.
- Portuguese labels for `NewsStatus` and `WorkflowStage` come from `ingestion-editorial-workflow.md` § 5.

**Depends on** — B9. **Blocks** — B11.
**Risks** — both components are shells (334 and 241 lines, 0 `fetch`); the strategy names "the assumption that the admin pages already work" as the single largest estimation risk here.
**Tests** — component-level render tests for loading/empty/populated; one manual pass per screen.

### B11 — Original and rewrite side by side
**P0 · S · owner: `03-frontend`** *(roadmap #70, slice 4 of 5)*

As a reviewer, I want the source text and the rewrite on screen together, so that
I can detect a hallucination.

**AC**
- The review screen shows `News.content` (original) and `ArticleAI.contentRewritten` side by side, plus both titles and the image state.
- An article whose rewrite failed is shown as un-reviewable with its `rewriteError` — the raw source text is never offered as the thing to approve.
- No "bulk approve" control exists anywhere in the surface.

**Depends on** — B10. **Blocks** — B14.
**Risks (Critical)** — strategy R4 makes this a hard requirement, not a UI preference: a reviewer who cannot see the source cannot detect fabrication. A bulk-approve button recreates auto-publish with an audit row attached, which is worse than today because it looks like review.
**Tests** — render test asserting both panes present; a failed-rewrite fixture asserting the article is not approvable.

### B12 — Only SUPERVISOR+ may publish
**P0 · S · owner: `08-security` + `02-editorial-content` sign-off** *(roadmap #70, slice 5 of 5)*

As the maintainer, I want the publish transition restricted by role, so that a
writer cannot put content on the public site.

**AC**
- A REDATOR-level account is refused the transition to `PUBLISHED`, at the API, not only in the UI.
- The role→transition matrix is written in `business-rules.md` before it is coded (editorial call, not a security one).
- Specs cover the matrix for all 8 `UserRole` values.

**Depends on** — B9, C3. **Blocks** — B14.
**Risks** — roadmap #62: today every admin role has the same reach across all of `/api/admin/**`; this story fixes it only for the lifecycle surface. Say so plainly rather than implying the broader hole is closed.
**Tests** — role matrix specs; a manual attempt with a REDATOR token.

### B13 — Publication window before the gate flips
**P0 · M · owner: `04-backend-api` + `02-editorial-content`** *(roadmap #72)*

As a subscriber, I want an article approved two days after it was collected to
still reach me, so that review latency does not silently delete the digest.

**AC**
- `lib/digest.ts`, `lib/messaging/deliver.ts` and `app/api/news/feed/route.ts` select on publication time, not on the source's `publishedAt`.
- An article ingested three days earlier and approved today reaches the next digest.
- `News.publishedAt` still holds the source's date and is still never rewritten by `transitionArticle`.

**Depends on** — B8. **Blocks** — B14 (**prerequisite, not a follow-up** — settled by the Phase 0 numbers).
**Risks (P0)** — measured: an article is a median **14.5h** old on arrival; ingestion runs 20:00 and `generate-digest` 02:00, so review has a **six-hour overnight window**, and 7% of articles are already outside it on arrival. Review in working hours misses every digest, every day. Interim lever if B13 slips: widen `WINDOW_HOURS` in `lib/digest.ts` from 24 to 48 — one constant, reversible, safe because `selectArticles` already takes `excludeIds`.
**Tests** — specs over the window selection with a fixture approved outside the 24h source window; one live digest run observed.

### B14 — Flip the gate
**P0 · S · owner: `04-backend-api`** *(roadmap #71)*

As the maintainer, I want ingestion to create drafts instead of published
articles, so that nothing reaches readers unreviewed.

**AC**
- `lib/ingestion/persist.ts:58` writes `DRAFT`; ingestion creates the `ContentWorkflow` row at `WorkflowStage.DRAFT` with `authorId` null.
- No code path outside `lib/editorial/article-service.ts` writes `News.status = "PUBLISHED"`.
- A manual `sync-news` run produces DRAFT rows that appear in the queue; the public feed is unchanged for pre-existing articles.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all run in-session with output shown.

**Depends on** — B11, B12, B13, and B10 **in daily use** (a gate with no working approval UI is an outage with extra steps).
**Risks (P0)** — the revert is **partial**: reverting the line stops new DRAFTs but does not republish the ones created while it was flipped. Size the soak accordingly. The legacy corpus stays published, by decision — do not mass-unpublish, do not backfill, cut over by date.
**Tests** — the full gate exercised end to end on one real article.

### B15 — A silent zero-publication day must reach a human
**P1 · S · owner: `04-backend-api`** *(strategy R1b/R2d, no roadmap row)*

As the maintainer, I want to be told when the feed stops moving, so that the
first signal is not a reader.

**AC**
- A check reports when articles published in the last 24h fall below N.
- A skipped digest (`skipReason: "No eligible articles found"`) produces a signal rather than only a log line.
- N is set from the Phase 0 numbers.

**Depends on** — B13. Should land **before** B14.
**Risks** — the digest already fails safe (`lib/digest.ts:324–328` skips rather than sending empty) but fails safe *silently*; it can be dead for a week unnoticed.
**Tests** — spec on the threshold check; one forced-skip run observed.

### B16 — Link articles to their outlet
**P1 · M · owner: `05-database` + `02-editorial-content`** *(strategy, no roadmap row)*

As an editor, I want the review queue orderable by source trust, so that
`NewsSource.priority` means something.

**AC**
- A decision on whether `NewsSource` rows model **providers** (GNews, NewsAPI) or **outlets** (A Bola, Record, Reuters) — today they are providers while articles carry 18 distinct `sourceName` values.
- Ingestion sets `News.sourceId` (all 72 rows currently have `sourceId = null`, a standing violation of `business-rules.md` § provenance).
- `NewsSource.priority` can order the B9 queue.

**Depends on** — the modelling decision. **Blocks** — priority-ordered queue in B9.
**Risks** — backfilling 72 rows against a shared production database; keep it additive and re-runnable.
**Tests** — spec asserting ingestion populates `sourceId`; a count of null `sourceId` rows before and after.

### B17 — A failed enrichment must stop looking like a success
**P0 · S · owner: `07-ai-pipeline`** *(roadmap #74)*

As an editor, I want a failed AI enrichment to stay failed, so that placeholder
text is never mistaken for a summary.

**AC**
- `lib/ai-processing/processor.ts:106–109` no longer substitutes `generateFallback(...)` on failure; `saveEnrichmentResult` does not stamp `processedAt` or clear `lastError` for a failed run.
- A failed enrichment is visible and retryable via `attempts`/`lastError`.
- `lib/ai-generate-service.ts`'s silent breakage (workflow § 7.1) is fixed in the same change.

**Depends on** — nothing. **Blocks** — B7 (a reviewer judging rewrite quality must not be reading fallback text).
**Risks** — `business-rules.md` § AI-content correctness names `fallback.ts` specifically and forbids exactly this. Tolerable only while nothing gates on enrichment; B14 makes something gate on it.
**Tests** — `lib/ai-processing/*` is **currently untested**; this story adds the first specs there (failure leaves `lastError` set, `processedAt` null, content unchanged).

### B18 — Record the cut-over
**P2 · S · owner: `10-docs-memory`** *(roadmap #73)*

As the next session, I want the gate's history in memory, so that nobody
re-proposes a decision already made.

**AC** — `docs/memory/decisions.md` records the cut-over date, the decision to leave the legacy corpus published, and the lifecycle invariant now being enforced; `architecture.md` describes `persist.ts` writing DRAFT; `business-rules.md` carries the § 6 additions drafted in the workflow spec.
**Depends on** — B14. **Tests** — none.

---

## Epic C — Reader identity (P1, Mission M1)

### C1 — Auth.js adapter tables
**P1 · S · owner: `05-database`** *(roadmap #41, currently `blocked`)*

As an engineer, I want `Account`, `Session` and `VerificationToken` in the
schema, so that a session library has something to persist to.

**AC** — additive migration, no existing table altered; applies forward on a Neon branch and rolls back cleanly.
**Depends on** — B4, G3. **Blocks** — C2.
**Risks** — `lib/generated/prisma/models/` **already contains** `Account.ts`, `Session.ts` and `VerificationToken.ts` while `prisma/schema.prisma` declares none of them: the generated client is out of step with the schema. Reconcile that (G3) before migrating, or the migration will be written against a phantom.
**Tests** — forward and rollback on a branch; `pnpm db:generate` + `pnpm typecheck`.

### C2 — Session helpers
**P1 · S · owner: `08-security`** *(roadmap #42, slice 1 of 2)*

As an engineer, I want `getSession()` in one place, so that no route
re-implements identity.

**AC** — `lib/auth/session.ts`; `checkAdminAuth()` becomes a wrapper so all 10 existing call sites keep working unchanged; a null `User.password` never authenticates.
**Depends on** — C1. **Blocks** — C3, C7.
**Tests** — specs for the wrapper's existing contract plus the null-password case.

### C3 — `requireUser` / `requireRole` and the tier matrix
**P1 · S · owner: `08-security`** *(roadmap #42, slice 2 of 2)*

As the maintainer, I want one role check, so that authorization is not scattered.

**AC** — `lib/auth/require.ts`; the inline role array at `lib/admin-auth.ts:20` is replaced by the tier matrix; specs cover `requireRole` for all 8 `UserRole` values.
**Depends on** — C2. **Blocks** — B8, B12, C4, C5, C6.
**Tests** — the 8-value matrix.

### C4 — Edge middleware, presence only
**P1 · S · owner: `08-security`** *(roadmap #43)*

As a visitor, I want to be redirected away from `/admin`, so that the admin area
is not reachable by URL.

**AC** — `middleware.ts` does a presence-only cookie redirect with `jose`; no Node built-in reaches the edge; a `USER` hitting `/admin` is redirected; **removing the middleware does not make any endpoint authorized** (authoritative checks stay server-side).
**Depends on** — C3.
**Risks** — `jsonwebtoken` is Node-only and throws on the edge runtime; presence-only is deliberate, not a shortcut.
**Tests** — a spec asserting no Node built-in is imported; manual visitor and USER passes.

### C5 — `/api/me`
**P1 · S · owner: `04-backend-api`** *(roadmap #44)*

As a reader, I want my own data derived from my session, so that nobody can read
it by guessing an id.

**AC** — `GET`/`PATCH /api/me` derive the user from the session; no route handler reads `userId` from a query string or body.
**Depends on** — C3. **Blocks** — D2, C8, C10.
**Notes** — the security half is already met: `app/api/user/route.ts` was **deleted** on 2026-11-13, so the IDOR is closed and the endpoint 404s. This story restores the capability; it does not re-close a hole.
**Tests** — route specs: no session → 401; a session reads only its own row.

### C6 — Close the remaining client-supplied `userId`
**P0 · S · owner: `08-security`** *(roadmap #50, `partial`)*

As the maintainer, I want `/api/growth/streak` to stop trusting a client
`userId`, so that the last IDOR is closed.

**AC** — the endpoint derives the user from the session; a request naming another user's id cannot write their streak.
**Depends on** — C3.
**Risks (P0)** — this one is **still live**; `/api/user/react` and `/api/user/save` were deleted because they had zero callers, but this endpoint has one. `public-repo-public-vulnerability`: the repository is public, so the hole is already disclosed.
**Tests** — a spec asserting a foreign `userId` in the body is ignored.

### C7 — Real auth state in the navigation
**P1 · S · owner: `03-frontend`** *(roadmap #52)*

As a visitor, I want to see "sign in" rather than someone else's avatar.

**AC** — a visitor sees sign-in; a signed-in user sees their own name and avatar; Sign Out ends the session.
**Depends on** — C2. **Tests** — render tests for both states; one manual pass.

### C8 — Claim anonymous reading history on sign-up
**P2 · S · owner: `04-backend-api`** *(roadmap #57)*

**AC** — backfills `UserEvent.userId` where `sessionId` matches, **once only**, inside a capped window, and **never** claims reactions or saves (they imply intent); a shared device cannot attribute a previous person's reading to a new account.
**Depends on** — C5.
**Risks** — privacy: `UserEvent.userId` is nullable by design to support anonymous analytics; do not force an association.
**Tests** — specs for the window, the once-only guard, and the reactions/saves exclusion.

### C9 — Extract staff credential logic
**P2 · S · owner: `08-security`** *(roadmap #61a)*

**AC** — `app/api/admin/auth/route.ts` (204 lines) drops to a thin handler; `lib/admin/staff-auth.ts` exposes `authenticateStaff(email, password)` returning a discriminated result; the single frozen 401 body is preserved.
**Depends on** — nothing. **Tests** — unit specs on `authenticateStaff` (inactive account, null password, non-admin role, wrong password — each on its own branch).

### C10 — Retire the dead service layer
**P3 · S · owner: `04-backend-api`** *(roadmap #51, `partial`)*

**AC** — `lib/social-service.ts` removed (still dead; `lib/user-service.ts` already gone); `pnpm build` clean.
**Depends on** — C5. **Tests** — `pnpm build`, `pnpm typecheck`.

---

## Epic D — A truthful profile (P2)

### D1 — Rule on the gamification badges
**P2 · S · owner: `02-editorial-content`** *(roadmap #47)*

As the maintainer, I want a written ruling per badge, so that the profile stops
inventing achievements.

**AC** — a per-badge decision (define as a product rule, or delete) covering "Especialista IA", "Explorador", the 15 600-user leaderboard and the level-12 profile, none of which any schema field backs; the ruling lands in `business-rules.md`.
**Depends on** — nothing. **Blocks** — D4.
**Tests** — none.

### D2 — Preferences tab on real data (reference module)
**P2 · M · owner: `03-frontend`** *(roadmap #45)*

As a reader, I want my preferences saved, so that the site remembers them.

**AC** — `components/user-preferences.tsx` reads from `/api/me` and writes persist; visitor, loading and empty states exist; a saved preference survives sign-out and sign-in.
**Depends on** — C5. **Blocks** — D3, D4, D5 (they copy this shape).
**Tests** — render tests for the three states; one round trip exercised manually.

### D3 — History tab on real `ReadHistory`
**P2 · S · owner: `03-frontend`** *(roadmap #46)*

**AC** — no Jan-2024 fixtures remain; an account with no history shows an empty state, not sample rows.
**Depends on** — D2. **Tests** — render tests, populated and empty.

### D4 — Dashboard tab on real points / level / streak
**P2 · S · owner: `03-frontend`** *(roadmap #48)*

**AC** — every number rendered traces to a schema field or a documented derivation; no hardcoded rank or user total; any badge D1 did not define is **removed**, not simulated.
**Depends on** — D1, D2. **Tests** — render test asserting no literal totals remain.

### D5 — Personalized feed on real ranking
**P2 · S · owner: `03-frontend` + `04-backend-api`** *(roadmap #49)*

**AC** — changing a category preference in D2 visibly changes this tab; every `personalizedReason` string is derived, not authored.
**Depends on** — D2. **Tests** — a spec over the derivation; one manual pass.

---

## Epic E — The quality gate (P1)

### E1 — Make `pnpm test` a blocking CI job
**P1 · S · owner: `09-testing` + `01-cto`** *(roadmap #21)*

As the maintainer, I want a broken spec to fail a PR, so that green means
something.

**AC** — `.github/workflows/ci-cd.yml` runs `pnpm test` as a blocking job; a deliberately failing spec blocks a test PR.
**Depends on** — E2 (a job that does not execute is not a gate).
**Risks** — the suite is green locally (20 spec files) but nothing runs it; the CODEOWNERS review is required for a workflow edit.
**Tests** — the failing-spec PR is the test.

### E2 — Find out why the gate does not run
**P0 · S · owner: `01-cto`** *(roadmap #63)*

As the maintainer, I want to know why none of `ci-cd.yml`, `security.yml` or
`cto-review.yml` executed on PR #110, so that the gate is not decorative.

**AC** — the cause is identified and written down; a test PR shows all three workflows executing; the finding is recorded in `docs/memory/lessons-learned.md`.
**Depends on** — nothing. **Blocks** — E1, and the credibility of every other story's AC.
**Risks (P0)** — `gh run list` returned zero runs for that branch while all three workflows declare `pull_request` triggers against `main`. Lint, typecheck, build, CodeQL, `pnpm audit` and Gitleaks have not been running. Two live defects shipped under a green gate.
**Tests** — a throwaway PR with workflow runs attached.

### E3 — Clear the lint backlog and promote the rules
**P2 · M · owner: `09-testing`** *(roadmap #5)*

**AC** — the 76 violations across 36 files are cleared and both ESLint rules move from `"warn"` to `"error"`; `pnpm lint` clean.
**Depends on** — E1.
**Risks** — `worktrees-break-lint-and-test`: `pnpm lint` and `pnpm test` both fail inside `.claude/worktrees/*` for environmental reasons; use the documented substitutes.
**Tests** — `pnpm lint`.

### E4 — Cover the untested critical paths
**P1 · M · owner: `09-testing`** *(roadmap #13)*

**AC** — specs exist for `lib/ai-processing/*`, `lib/trends.ts` and `lib/ranking-recalculate.ts`; the report names the paths left uncovered rather than implying coverage.
**Depends on** — E1. **Related** — B17 and A3 each add the first specs to their own area.
**Tests** — `pnpm test` with the new specs listed.

---

## Epic F — AI spend metering (P2)

### F1 — `AiUsage` model
**P2 · S · owner: `05-database`** *(roadmap #53, `blocked`)*

**AC** — `actor`, `provider`, `model`, `promptTokens`, `completionTokens`, `costUsd`, `createdAt`, indexed on `(provider, createdAt)` for a month-to-date sum; **no** per-user quota fields (that design stays cancelled).
**Depends on** — B4. **Blocks** — F2.
**Risks** — blocked on migration delivery, same as B3; land them together if the ordering allows.
**Tests** — `pnpm db:generate`, `pnpm typecheck`, a live column read.

### F2 — Stop discarding the token counts
**P2 · S · owner: `07-ai-pipeline`** *(roadmap #54)*

**AC** — `lib/ai-processing/call-ai.ts` persists the `usage` object it already receives instead of returning only `data.choices[0].message.content`; `actor` becomes required on `callAI` (`user:<id>` / `agent:<id>` / `system:<cron>`), so all three call sites must name themselves; a global monthly ceiling lives in the environment, with no per-user quota.
**Depends on** — F1. **Tests** — specs asserting usage is recorded per call and that a missing `actor` is a type error.

---

## Epic G — Operational safety (P1)

### G1 — Stop `pnpm setup` from writing to production
**P0 · S · owner: `04-backend-api`** *(roadmap #37)*

As a new contributor, I want the setup script to refuse to touch a shared
database, so that onboarding cannot overwrite the live site.

**AC** — `scripts/setup.sh` no longer runs `prisma db push` or `prisma db seed` unguarded; both require the same `--confirm-production-write`-style gate as `scripts/admin/provision-admin.ts`; both `.sh` scripts call `pnpm`, not `npm`.
**Depends on** — nothing.
**Risks (P0)** — `prod-db-differs-from-local`: local and production share one Neon instance, so `pnpm setup` seeds production today. The repository is public, so the hazard is published too.
**Tests** — run the script with and without the flag and show both outcomes.

### G2 — Reconcile `/missao`
**P3 · S · owner: `10-docs-memory`** *(roadmap #59)*

**AC** — `.claude/commands/missao.md` is either rewritten against this repository's roadmap and 11-agent roster, or deleted; it currently names `tasks/_index.md`, `pnpm task:id` and nine agents that do not exist here.
**Depends on** — nothing. **Tests** — none.

### G3 — Reconcile the generated Prisma client
**P2 · S · owner: `05-database`** *(no roadmap row)*

**AC** — `lib/generated/prisma/models/` matches `prisma/schema.prisma`; the three Auth.js models present in the generated client but absent from the schema are explained (stale artefact, or the schema is behind) and the state is recorded.
**Depends on** — nothing. **Blocks** — C1.
**Tests** — `pnpm db:generate` followed by a clean `git status` on `lib/generated/`.

---

## Part 3 — Suggested order

**Now, independent of everything else:** A1 → A2 → A3 (the uncommitted pivot sits
in the working tree and the next 20:00 sync runs against it), plus E2, G1, C6 and
B17 — each a live defect with no dependency.

**Then the unblockers:** B4 (migration delivery) and G3 unlock B3, C1 and F1.
C2 → C3 unlocks B8, B12 and all of Epic D.

**Then the gate, in spec order:** B1 → B2 → B3 → B5 → B6 → B7 → B8 → B9 → B10 →
B11 → B12 → B13 → B15 → B14. B14 is last and ships only once B10 is in daily use.

**In parallel, when someone is free:** E1/E3/E4; Epic D behind C5; Epic F behind B4.

---

## Part 4 — Decisions needed from the maintainer before this is executable

1. **Is the 2026-11-12 scope final?** A1–A3 ratify it as written. If it is still moving, they should wait.
2. **Does `NewsSource` model providers or outlets?** (B16) — blocks a priority-ordered review queue.
3. **Who reviews, and when?** The measured capacity is 16 articles/day against 15.3 intake, inside a six-hour overnight window. If nobody is reviewing overnight, B13 is not optional and intake must be cut further.
4. **Do the gamification badges exist as product rules?** (D1) — until this is answered, D4 cannot be written.
5. **Does `lab-phase-accepts-db-loss` still hold?** It was recorded while designing; there is now a live corpus and live readers.
6. **Is the ~142 out-of-scope article archive (roadmap #18) in or out of this round?** The gate strategy lists it out of scope, and it needs an ADMIN user to attribute its audit rows.
