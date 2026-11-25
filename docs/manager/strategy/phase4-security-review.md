# Security review — the Phase 4 approval surface

Reviewed 2026-11-24, written up 2026-11-25. Subject: the approval surface as merged in PR #186 (`45e0341`, `2a701ad`, `efbd831`) — roadmap row #70.

Scope of the review: every path that writes `News.status`, the actor model on `transitionArticle()`, the per-edge role matrix now that something calls it, `reviewerId` attribution, and the audit trail. Checked against `docs/editor/ingestion-editorial-workflow.md` § 3.1, § 3.2 and § 6.

One defect was found and is fixed on this branch. Everything else is recorded here rather than patched, because each one is a decision rather than a typo.

## Fixed — the reviewer stamp was applied where no review happened

`lib/editorial/article-service.ts` gated the stamp on the target status alone:

```ts
const stampsReviewer = target === "APPROVED" || target === "REJECTED"
```

Nothing constrained where the article came from, and two legal edges reach those targets from a status in which nobody reviewed anything:

| Edge | What it is | What it did |
|---|---|---|
| `PUBLISHED → APPROVED` | unpublishing | A SUPERVISOR taking down a legacy article nobody ever reviewed was recorded as its reviewer. |
| `DRAFT → REJECTED` | killing a draft before submission | The review being credited never began. |

Both are reachable: `TRANSITION_ROLES` grants `SUPERVISOR` each one, and the stamp fires whenever `reviewerId` is still null — which is exactly the state of the entire legacy corpus.

**Why this is not cosmetic.** `reviewerId` is the column invariant 12 leans on: a `mocambique` or `africa-do-sul` story never reaches `PUBLISHED` without a human reviewer. A stamp applied where no review happened does not merely misattribute credit — it silently satisfies the one rule the field exists to make checkable. The gate would report itself as held.

Now requires `current.status === "PENDING_REVIEW"`. A rejection out of review still stamps, because reading an article and ruling against it *is* a review act. Rejecting from `APPROVED` with a null `reviewerId` now leaves it null, which is the honest answer.

**Covered by five specs**, two of which fail against the previous implementation — that is what makes them a regression test rather than a description.

## The reason it got through: the actor path shipped untested

`__tests__/lib/editorial/article-service.test.ts` contained no `actor` case at all before this branch. The role matrix had 26 specs of its own, but nothing exercised `transitionArticle` *with* an actor, so the stamp, the audit transaction and the stage move were all uncovered. The specs added here cover the stamping edges only; the audit row, the `ContentWorkflow` upsert and the § 3.3 preconditions are still untested.

## Open — ordered by what should be settled first

### 1. The status write is not atomic

`loadForMutation` reads the status, and the update writes with `where: { id }` only. Two callers that both read `APPROVED` both pass their checks.

Failure scenario: a SUPERVISOR archives an article at the same moment the publish cron fires. Both read `APPROVED`; the row ends `PUBLISHED` after an archive, traversing `ARCHIVED → PUBLISHED`, an edge no actor may make and the state machine forbids outright.

Pre-existing, and it stays theoretical while there is one human writer and `publish-scheduled` is unregistered. It stops being theoretical the moment several reviewers work the same queue. Fix is `updateMany` with `status: current.status` in the `where`, treating `count === 0` as a conflict.

### 2. The role claim is up to 8 hours stale, and it is now an authorization input

`checkAdminAuth` reads `role` straight from the JWT with no database round trip, on an 8-hour token, so a demotion does not take effect until it expires. That was harmless while the role only gated which pages rendered. Since PR #186 it decides whether somebody may publish. Belongs with the session work already open as row #42.

Related, and cheap: the route must build the actor only from `checkAdminAuth()`, never from the request body. `role` is ordinary data on `TransitionActor`; the only thing making it an authorization input rather than a client-supplied claim is where the caller got it.

### 3. A deleted user turns an approval into a 500

`News.reviewerId` has a foreign key to `users`. A valid, unexpired token naming a user who has since been deleted makes the stamp fail with a Prisma P2003, surfacing as an unhandled 500 rather than a sane refusal.

### 4. Refusals are an unauthenticated-ish write amplifier

Every refused transition writes an `AdminAction` row. That is correct — a denial nobody can see is not a control — but it means a session that may not transition anything can still drive database writes in a loop. The transition route needs the same rate limiting the login route already has.

### 5. Two pre-existing agent asymmetries, now visible for the first time

- An agent holding only `article.review` may make `DRAFT → REJECTED` — terminal and unrecoverable — an edge the human matrix reserves for `SUPERVISOR`.
- A credential holding `article.review` + `article.schedule` but **not** `article.publish` can approve its own draft and have the cron publish it.

Both follow from the permission model `docs/memory/decisions.md` (2026-08-31) chose deliberately, and that document accepted the first-order version of this trade-off in writing. What keeps the second theoretical is that `publish-scheduled` is still absent from `vercel.json`. Changing either is a `decisions.md`-level call, not a refactor. Registering that cron means settling it first.

### 6. The unattended callers are constrained by nothing but the state machine

`transitionArticle`'s actor is optional, and its absence means the Agent API or the cron. That is documented and deliberate. The consequence worth naming: a new in-repo caller that simply omits the actor gets no role check and writes no service audit row, silently. Phase 5's retention sweep (§ 1.5 consequence 3, invariant 13) will be exactly such a caller.

An option, if that becomes uncomfortable: make the actor a discriminated union over human / agent / system and require it, so omitting it is a `pnpm typecheck` failure, with a small fail-closed table naming what each system label may do. That is a redesign of a just-merged module, not a fix, which is why it is a note here rather than a patch.

## Checked and found correct

- **The role matrix itself.** Every edge of `TRANSITION_ROLES` is equal to or stricter than § 3.1. No `role >= X` anywhere. `MARKETING` appears in no list, `CRIADOR_CONTEUDO` stops at submission, `REVISOR` cannot reach `APPROVED` alone.
- **No other path writes `News.status`.** `createArticle` is hard-wired to `DRAFT`; `updateArticle`, `updateArticleSeo` and `setArticleImage` build their `data` from string literals with no input-derived keys; the ranking and enrichment writers touch only their own columns; there is no raw SQL. The one exception is the known one: `lib/ingestion/persist.ts:58`, which row #71 owns.
- **`stageForStatus(target, { hasRewrite: true })`.** I suspected the hardcoded `true` was wrong and it is not: `submissionBlockers` refuses submission without a successful rewrite, and `DRAFT` is only reachable from `PENDING_REVIEW` or `APPROVED`, both of which require having been submitted. Anything this line sees has a rewrite.
- **The audit `details` blob.** Bounded by `redact` — strings capped, arrays capped, depth capped, credential-shaped keys blanked. No email, token or article body reaches the column on any current path.

## Not closed by Phase 4, so that nobody reads it as more than it is

The gate still does not exist. #70 built the place where a human approves; it added no gate to the content itself. Still enforced nowhere: invariant 12, and the public render of the rewrite — see row **#70a**, raised 2026-11-24, which blocks #71. `app/api/news/route.ts:89` and `app/api/news/[id]/route.ts:47` still return `News.content`, so an approved article would publish the source's verbatim text with an editor's name and a `reviewerId` attached. That launders the republication through a human rather than ending it, which is worse than the status quo it replaces.
