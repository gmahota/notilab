# Strategy — Ingestion editorial gate

Owner: `01-cto`. Drafted 2026-11-06. Companion to `docs/editor/ingestion-editorial-workflow.md`, which owns the *meaning* of the workflow; this document owns the *shape and sequence* of the change.

## Three corrections to the original framing, verified in code

**1. `lib/ai-generate-service.ts:89` and `:136` do not write `PUBLISHED` — they are `where` filters.** Both select already-published articles as grounding material for draft generation (`prisma.news.findMany` at lines 100 and 147). Editing them would break draft grounding and fix nothing.

Repo-wide, the **only** write of `status: "PUBLISHED"` outside `transitionArticle()` is `lib/ingestion/persist.ts:58`. The other grep hit, `components/admin-news-manager.tsx:55`, is an element of a hardcoded `useState([...])` mock array. The auto-publish surface is one line, not three. That is good news for reversibility.

**2. The human approval surface does not exist.** The two admin pages exist but are shells over mock data:

- `app/admin/news/page.tsx` → `components/admin-news-manager.tsx`, which holds three hardcoded articles in `useState` and makes no fetch.
- `app/admin/workflow/page.tsx` → `components/workflow-manager.tsx` → `workflow-kanban.tsx`; no `fetch(`, no API call anywhere in either.
- `app/api/admin/**` contains only `auth`, `logout`, `overview`, `experiments`. **There is no admin lifecycle API at all.**

The only working caller of `transitionArticle()` today is the machine surface (`/api/agent/*`, `/api/mcp`) and the unregistered `publish-scheduled` cron. "Human approval" is net-new build, and it is the majority of the work in this change. This is scope, not something to absorb silently.

**3. Enrichment throughput is 15 articles/day, hard.** `vercel.json` runs `process-ai-news` once daily at `0 22 * * *`; the route sets `BATCH_SIZE = 15` and `maxDuration = 60`. Any design that adds a second model call inside `runAiBatch` halves that within an unchanged 60-second budget. The approval queue cannot be fed faster than this number, and ingestion is not currently throttled to it.

## Goal

Stop `lib/ingestion/persist.ts` from putting unreviewed, un-rewritten, rights-unchecked third-party text on the public site, and replace it with: ingest → rewrite in NotiLab's voice → validate image rights → human approval → publish.

## Current state

- `runIngestionPipeline()` (`lib/ingestion/pipeline.ts`) ends at `saveToDatabase` → `queueForAiProcessing`. `persist.ts:58` stamps `status: "PUBLISHED"` on creation. Nothing between fetch and public visibility involves a human.
- `lib/editorial/article-service.ts` is the correct layer and is already complete: `ALLOWED_TRANSITIONS` (lines 54–63), `transitionArticle()` (671), and a publish gate that refuses anything not `APPROVED`. Ingestion simply never calls it.
- `docs/memory/business-rules.md` § Article lifecycle already states the invariant. **This change does not create a rule; it makes an existing, documented, higher-authority rule true.** `persist.ts:58` is a standing violation of `docs/memory/*`, which outranks any agent file.
- `docs/memory/decisions.md` (2026-08-31) already decided that the agent surface must never publish unreviewed content and deliberately left `publish-scheduled` out of `vercel.json` for exactly this reason. This change is consistent with that line of decisions, not a reversal of any of them.
- Cron chain is a nightly sequence: `sync-news` 20:00 → `process-ai-news` 22:00 → `recalculate-ranking` 00:00 → `generate-digest` 02:00 → `send-digest` 05:00 → `send-messaging` 07:00.
- Public readers all pin `status: "PUBLISHED"` (feed, news, `news/[id]`, category, trending, digest, messaging deliver, chat-service, trends, stats). No reader needs to change for the gate itself.

### The non-obvious coupling

`News.publishedAt` is the **source's** publication date, and `transitionArticle` deliberately does not rewrite it (`article-service.ts:709–715`, with a comment explaining that silently setting it to "now" would reorder the feed on every republish).

But:

- `lib/digest.ts:98–104` selects `publishedAt >= now − 24h AND status = PUBLISHED`.
- `lib/messaging/deliver.ts:80–85` does the same with a 24h window.
- `app/api/news/feed/route.ts:58` orders by `publishedAt desc` and takes the newest `limit + 10` as its candidate set.

So **review latency is subtracted directly from the publication window.** An article ingested Monday 20:00 and approved Wednesday morning has a Monday `publishedAt`: it can never appear in a daily digest, and it enters the feed already buried. This is the mechanism that will empty the digest — not "nothing was approved", but "approved too late". It must be decided explicitly, not discovered in production.

## Risk classification

- **Level: Critical**
- **Why:** three independent critical factors compound. (a) It is the publish path for a live public site — getting it wrong empties the product. (b) It replaces "we republish attributed third-party text" with "we publish model-written prose in our own voice", which moves the failure mode from attribution to **fabrication**, the risk `AGENTS.md` treats as the project's core. (c) It requires a Prisma schema change, and local and production are one Neon instance with no CI migration path, so every column add is a manual production write.

## Strategy

Separate the four concerns, because three of the four are independently valuable and only one is genuinely dangerous:

1. **Image rights** — ships alone, needs no gate, no schema, and no approval UI. Do it first.
2. **Rewrite** — ships in "shadow mode" (running, filling columns nobody reads) before it gates anything. This is where fabrication risk lives, so it gets its own soak period and its own editorial sign-off.
3. **Approval surface** — the long pole, net-new, and the actual precondition for flipping the gate.
4. **The gate itself** — one line, flipped last, when there is somewhere for the articles to go.

Never flip 4 before 3 is in daily use. A gate with no approval UI is an outage with extra steps.

## Decisions

### 1. Rewrite: new module with its own cron

Not a phase inside `runAiBatch`, and not a phase of the ingestion pipeline.

Concretely: `lib/ai-processing/rewrite/` (own selector, prompt, parser, save-result), driven by a new `app/api/cron/rewrite-articles/route.ts` registered in `vercel.json` at `0 21 * * *` — between ingestion (20:00) and enrichment (22:00).

**Blast radius.** `runAiBatch` is the single thing keeping every article's Portuguese headline alive; its selector also backfills older articles that predate translation. Adding a second model call inside that loop means a rewrite timeout consumes the shared 60-second budget and starves the remaining stubs of the step the entire feed depends on. A separate module and cron gives a separate failure domain, separate `maxDuration`, separate batch size, and a kill switch that is one line in `vercel.json` rather than a code revert.

**Reprocessing a failed article.** The existing pattern is the right one and should be *copied, not shared*. `attempts` / `lastError` / `processedAt` plus a `WHERE <output> IS NULL AND attempts < 3` selector is naturally convergent: re-running picks up exactly what is unfinished, which is also what the Neon mid-batch disconnect requires. But if rewrite shares `ArticleAI.attempts`, a rewrite failure burns enrichment retries and vice versa — after three mixed failures the article is invisible to both steps and nothing records which one broke. Rewrite therefore needs **its own nullable output field and its own attempts counter**.

**Why not a phase of `runIngestionPipeline`.** The pipeline is one synchronous run with no per-article persistence between steps. Putting a per-article model call in it makes ingestion duration proportional to model latency, makes a provider outage an ingestion failure, and gives a mid-run crash no resume point.

**Cost of the extra cron:** negligible. The 100-cron Vercel limit is nowhere near, and one run/day satisfies the Hobby frequency cap. The real constraint is that this cron is what makes articles *eligible* for review — it must be live and proven before the gate flips, or ingestion fills DRAFT with content nothing ever advances.

### 2. Schema changes

Three needs; one requires columns, two do not.

**(a) Rewritten text — new nullable columns, separate from the original.** `business-rules.md` § AI-content correctness requires provenance survive every transformation, and the retry logic needs the original as grounding. Overwriting `News.content` is destructive and makes the rewrite non-idempotent, which breaks the convergent re-run property. Recommended shape, additive on the existing `ArticleAI` table (one row already exists per ingested article, created by `ai-queue.ts`):

```
titleRewritten    String?
contentRewritten  String?
rewriteAttempts   Int      @default(0)
rewriteError      String?
rewrittenAt       DateTime?
```

Rejected for now: a separate `ArticleRevision` model. More correct long-term (revision history, multi-pass editing, per-edit authorship), materially more cost today, and it needs a second manual production migration. Recorded as the deferred option with the trigger: when an editor needs to edit-and-re-review rather than approve-or-reject.

**(b) Image rights state — no schema change needed.** The decided design (domain allowlist, fallback to no image) is fully expressible by nulling `imageUrl` at ingestion time when the host is not allowed. `hasImage` already models the result (`article-service.ts:162`, which also treats `/placeholder.svg` as no-image), and `searchArticles` already exposes a `hasImage` filter, so "find articles we dropped an image from" is already a supported query. Log rejected hostnames exactly as `quality.ts` already does for sources (`pipeline.ts:51–55`) — that gives allowlist tuning without a migration, and `scripts/ingestion-dry-run.ts` already exists to print that report without writing.

Add `imageStatus`/`imageCheckedAt` **only** if the newsroom needs to re-evaluate dropped images when the allowlist grows. Defer.

**Flag:** `next.config.ts` currently allows exactly one remote image host, so no news-domain image is served through `next/image` today anyway. The new allowlist and `images.remotePatterns` are two allowlists that will drift. Derive one from the other — single source of truth, exported from the new module.

**(c) Approval audit — no schema change, but a service change is required.** `News.reviewerId` and `News.authorId` already exist. `AdminAction` already exists and is already used for exactly this. What is missing: `transitionArticle()` takes no actor, and its editable-surface comment (lines 499–511) explicitly excludes `reviewerId` as "identity of humans, not an agent's to assign". It needs a reviewer-identity parameter on the `APPROVED` and `PUBLISHED` transitions, persisted to `reviewerId`, plus an `AdminAction` row.

**Without this, the gate has no accountability and the whole exercise is theatre.** Hard requirement of Phase 4.

**Safe migration path given local == production:**

- Every new column **nullable, no default, no index initially**. Additive columns are invisible to every existing query, and the rollback is "stop writing to it" rather than a down-migration against production data.
- **Push the columns first, as their own operation, with no deployed code that reads them.** The reverse order means deployed code queries a nonexistent column and the AI cron 500s against production.
- Run it as a recorded operator action by a human — the same posture `decisions.md` takes for `AiUsage`. An agent must not run `db push` mid-task against the shared instance.
- Any index for the approval-queue query is a **separate later operation**, not bundled with the column adds.
- Prefer the zero-migration designs in (b) and (c) precisely because each migration is a manual production write.

### 3. The already-published, unreviewed corpus

**Recommendation: leave it published. Cut over by date — everything ingested before the gate keeps its status, everything after goes through it. Handle the legacy corpus as a separate, time-boxed editorial sweep that is not a dependency of this change.**

**Mass unpublish — high, immediate, and partly illegal under the current transition table.** `PUBLISHED → DRAFT` is not a legal edge (`article-service.ts:60` allows only `APPROVED` and `ARCHIVED`). So "send everything back to drafting" requires either amending the transition table — a `business-rules.md` change needing `02-editorial-content` — or routing through `APPROVED`, which would label unreviewed content as approved and corrupt the very signal the change exists to create. Beyond that: it empties the feed, every category page, trending and the next digest in one operation; it strands existing `/s/[code]` share links and `ReadHistory` rows pointing at now-invisible articles; and it is precisely the kind of long single-pass script that Neon drops mid-batch, leaving a half-unpublished site with no record of where it stopped.

**Backfill (rewrite + retro-review) — the option that sounds responsible and is most likely to stall.** At 15 articles/day of model capacity, shared with the daily flow and with one human reviewer, a corpus of hundreds takes weeks. The realistic end state is half-done: the corpus is inconsistent *and* someone believes it was handled. That is worse than either extreme.

**Leave as is — a known, bounded, already-materialised risk.** The archive becomes machine-published scraped text in a foreign voice while everything new is rewritten and approved. That is a real editorial inconsistency and the image-rights exposure applies at least as much to images already live. But the feed is recency-dominated, so most of the corpus is not actually visible, and the exposure is not *new* — it is what the site has been doing all along.

**Roadmap #18 is the right first increment of the sweep, and must not be bundled into this change.** It is already `in_progress`, already scoped, already owned by `05-database`, and already blocked on its own prerequisite (an ADMIN user must exist to attribute the `AdminAction` rows). Bundling it makes both changes reversible only together and imports #18's blocker into the critical path of the gate. Run it after Phase 5, independently.

**If a mass action is wanted anyway**, the only defensible targeted version is: act on articles whose `imageUrl` host fails the new allowlist — the one genuinely new legal exposure, a small query-definable set, convergent on re-run. And prefer *nulling the image* over unpublishing the article, so it degrades to "article without an image" rather than "article gone".

## Phased plan

| Phase | Scope | Agent(s) | Depends on |
|---|---|---|---|
| 0 | Measure: articles ingested/day, existing `ArticleAI` backlog (`summary IS NULL`), articles published last 30d, median time from `createdAt` to now for unprocessed stubs. Read-only. No deploy. | 05-database | — |
| 1 | Image-rights allowlist at ingestion. New `lib/ingestion/image-rights.ts`, applied in `normalize.ts`; non-allowed host → `imageUrl = null`; rejected hosts logged as `quality.ts` logs rejected sources. Single source of truth shared with `next.config.ts` `remotePatterns`. Articles still publish. | 06-integrations-social | — |
| 2 | Schema: five nullable columns on `ArticleAI`. No code reads them. Operator runs the push against Neon. | 05-database (+ human operator) | 0 |
| 3 | Rewrite worker in shadow mode: `lib/ai-processing/rewrite/` + `app/api/cron/rewrite-articles` at `0 21 * * *`, own batch size and `maxDuration`. Fills the columns; nothing reads them; articles still publish as today. | 07-ai-pipeline | 2 |
| 3b | **Editorial sign-off on rewrite quality** — inspect N rewritten articles for voice and, critically, for fabrication beyond what `News.content`/`sourceUrl` supports. Gate on this, not on the code being merged. | 02-editorial-content | 3 |
| 4 | Approval surface. (i) `transitionArticle()` gains a reviewer identity, persisted to `News.reviewerId`, plus `AdminAction`. (ii) Admin lifecycle API under `app/api/admin/articles/**`, thin, calling `lib/editorial/`. (iii) Replace the mock arrays in `admin-news-manager.tsx`/`workflow-kanban.tsx` with real data; DRAFT queue showing **original and rewrite side by side** plus image state. (iv) RBAC: only SUPERVISOR+ may reach PUBLISHED. | 04-backend-api → 03-frontend; 08-security reviews (iv) | 3b |
| 5 | **Flip the gate.** `persist.ts:58` `"PUBLISHED"` → `"DRAFT"`. One line. | 04-backend-api | 4 |
| 6 | Publication-window fix: digest / messaging / feed select on publication time rather than source `publishedAt`. | 04-backend-api, 02-editorial-content sign-off | 5 (see caveat) |
| 7 | `docs/memory/decisions.md` entry; `architecture.md` ingestion flow; note in `business-rules.md` that the lifecycle invariant is now enforced rather than aspirational. | 10-docs-memory | 5 |

**Caveat on Phase 6 ordering:** if Phase 0 shows that review latency will routinely exceed 24 hours — which it will if review happens in working hours and ingestion runs at 20:00 — **Phase 6 becomes a prerequisite of Phase 5, not a follow-up.** Decide this with the Phase 0 numbers in hand.

**What validates each phase:**

- **0** — the numbers themselves; they size Phase 3's batch and set the Phase 6 ordering.
- **1** — unit test on the host matcher (`pnpm test`), then `pnpm ingest:dry-run`, which already prints the rejected-domain report and writes nothing.
- **2** — `pnpm db:generate` + `pnpm typecheck`; read the live table to confirm the columns exist before any code ships.
- **3** — manual `curl` with `CRON_SECRET`; confirm a re-run after an interrupted batch picks up exactly the unfinished rows and does not re-bill completed ones.
- **3b** — editorial judgement, not a command. No automation substitutes for it.
- **4** — approve a real article end to end; confirm it reaches the feed, `reviewerId` is set, an `AdminAction` row exists, and a REDATOR-level account is refused the publish transition.
- **5** — run `sync-news` manually; confirm new rows are DRAFT, appear in the queue, and the public feed is unchanged for pre-existing articles.
- **6** — approve an article ingested three days earlier; confirm it reaches the next digest.

**Reversibility, honestly stated:** Phases 1, 3, 6 revert cleanly. Phase 2 is not revertible but is inert. Phase 4 is additive (nothing public changes). **Phase 5's revert is partial** — reverting the line stops new DRAFTs but does not republish the ones created while it was flipped. It stops the bleeding; it is not an undo. Size the soak accordingly.

## Risks and mitigations

**R1 — The feed empties.** The mechanism is not only "nothing got approved"; it is also the `publishedAt` window above. Mitigations: (a) phase ordering — the gate ships only after the approval surface is in *daily use*, so there is never a day on which publishing is impossible; (b) a floor alarm — there is no monitoring today, so the first signal would be a reader; add a check reporting when articles published in the last 24h fall below N; (c) keeping the existing corpus published means the feed degrades to *stale* rather than *empty* — the strongest argument against mass unpublish; (d) do **not** reach for `publish-scheduled` as a workaround: it publishes `APPROVED` articles only, so it cannot drain a DRAFT queue.

**R2 — Digests and messaging stop.** Both are `publishedAt >= now − 24h AND PUBLISHED`, running at 02:00 / 05:00 / 07:00, while ingestion is 20:00 and human review will happen in working hours. Mitigations: (a) Phase 6 is the real fix; (b) interim, widen `WINDOW_HOURS` in `lib/digest.ts:88–91` from 24 to 48 — one constant, reversible, and safe because `selectArticles` already takes `excludeIds` so nothing is resent; (c) good news — `lib/digest.ts:324–328` already skips with `skipReason: "No eligible articles found"` rather than sending an empty issue, so it **fails safe**; (d) the problem is that it fails safe *silently* — nothing alerts on a skipped digest, so wire `skipReason` into reporting before Phase 5, or the digest can be dead for a week unnoticed.

**R3 — The queue outgrows the reviewer.** Enrichment capacity is 15/day and ingestion is not throttled to it. Mitigations, in order of effectiveness: (a) **throttle at the source** — `SYNC_QUERIES` and the quality gate are the project's existing, already-tuned volume levers; cutting ingestion to the reviewable rate is the only mitigation that actually bounds the queue, everything else just reorders the backlog; (b) order the queue by `importanceScore` so an uncleared queue loses the *least important* articles rather than the newest; (c) an age-out — DRAFT for more than N days → ARCHIVED, a legal transition that keeps the row and its provenance; this must be an explicit editorial decision, never a silent cleanup; (d) set N and the batch sizes from Phase 0's numbers, not from intuition; (e) **refuse a "bulk approve all" button.** It recreates auto-publish with an audit row attached, which is strictly worse than today because it *looks* like review.

**R4 — The reason this is Critical.** The change takes us from "we republish attributed third-party text" to "we publish model-written prose in our own voice, under our name, grounded in someone else's reporting". The failure mode shifts from attribution to **fabrication**. Mitigations: the rewrite is grounded-only, with no license to add facts; the original is retained; and **the approval UI shows original and rewrite side by side** — a reviewer who cannot see the source cannot detect a hallucination, so this is a hard requirement of Phase 4, not a UI preference. A rewrite that fails must leave the article un-reviewable rather than fall back to the raw source text, or the fallback silently reintroduces exactly the behaviour being removed.

**R5 — Operational.** Phase 2 is a manual write to production via the shared Neon instance. No agent runs it. `prisma migrate deploy` has never run in production (the CI deploy job has no `VERCEL_TOKEN`), so there is no automated path and no rehearsal environment.

## Out of scope

- Roadmap #18 (archiving ~142 articles + stale `TrendingTopic` rows) — runs after Phase 5, independently, with its own ADMIN-user prerequisite.
- Enabling `publish-scheduled` in `vercel.json` — a standing operator decision, unaffected by this work.
- Any change to the `/api/agent` or `/api/mcp` surfaces; the four confirmation-gated lifecycle tools already behave correctly and this change only removes the path that bypassed them.
- Multi-revision editing history (`ArticleRevision`), image re-evaluation state, and per-source rewrite policies.
- Reader-facing changes of any kind beyond Phase 6's window.

## Acceptance criteria

- [ ] No code path outside `lib/editorial/article-service.ts` writes `News.status = "PUBLISHED"`; `persist.ts` creates `DRAFT`.
- [ ] An ingested article cannot become publicly visible without a `News.reviewerId` and a corresponding `AdminAction` row.
- [ ] A rewrite failure is retryable in isolation and does not consume `ArticleAI.attempts` for enrichment, nor the reverse.
- [ ] Re-running the rewrite cron after a mid-batch connection drop processes exactly the unfinished articles and re-bills none of the completed ones.
- [ ] An image from a non-allowlisted host results in an article with no image, never a blocked render or a dropped article.
- [ ] The image allowlist and `next.config.ts` `images.remotePatterns` derive from one declaration.
- [ ] The approval queue shows the original and the rewritten text side by side.
- [ ] A REDATOR-level account cannot reach `PUBLISHED`; only SUPERVISOR+ can.
- [ ] An article approved more than 24h after ingestion still reaches a digest (Phase 6), or the team has explicitly accepted that it does not.
- [ ] A day with zero publications produces a signal to a human, not just a silent `skipReason`.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` all actually run and pass before Phase 5 is called done.
- [ ] `docs/memory/decisions.md` records the cut-over date and the decision to leave the legacy corpus published.

## Recommendation

**Proceed, in the order above, and treat Phase 4 — not Phase 5 — as the real project.** Flipping `persist.ts:58` is a one-line change that takes a minute; building somewhere for those drafts to go is weeks, and the assumption that the admin pages already work is the single largest estimation risk here.

Ship Phase 1 (image rights) immediately and independently — it is low risk, needs no schema and no approval UI, and it closes the one genuinely *new* legal exposure without touching the publish path.

Do not mass-unpublish. Do not backfill. Cut over by date, leave the archive alone, and let roadmap #18 handle the worst of it on its own schedule.

**Validation disclaimer:** no commands were run in producing this analysis. Nothing above claims a test, lint, typecheck or build result — all validation steps are work for `09-testing` and the implementing agents to actually perform.
