# Ingestion → Editorial Workflow (v1)

Owner: `02-editorial-content`. Drafted 2026-11-06 on the product owner's ruling that ingestion must collect but never publish. Companion to `docs/editor/content-focus.md` (what we cover) — this document covers *how what we collect becomes publishable*. Invariants here are destined for `docs/memory/business-rules.md` (§ 6).

Target flow, as stated by the product owner:

> scraper collects but does NOT publish → a writing step rewrites the article in NotiLab's voice → images are checked for rights → a human editor approves before it goes live.

## 0. The hole this closes

`lib/ingestion/persist.ts` writes `status: "PUBLISHED"` on every created `News` row. Every public surface (`app/api/news/feed`, `app/api/news`, `app/api/news/[id]`, `lib/digest.ts`, `lib/messaging/deliver.ts`, `lib/trends.ts`, `lib/chat-service.ts`) filters on `status: "PUBLISHED"`, so that one line is the entire distance between a third-party outlet's text and the live NotiLab site. Nothing that enters by ingestion is reviewed, rewritten, or rights-checked today, and `News.content` is the source's literal text — so the site currently republishes other people's articles verbatim under our brand.

This violates `AGENTS.md` § AI-Content Correctness ("Never let AI-generated content bypass the editorial workflow automatically") and `docs/memory/business-rules.md` § Article lifecycle ("A news item should not become publicly visible without having passed through REVIEW/APPROVAL, whether the content originated from ingestion, AI generation, or a human writer"). The rule already exists. Ingestion simply never implemented it.

The editorial layer, by contrast, already does this correctly: `lib/editorial/article-service.ts` creates at `DRAFT` unconditionally, routes every status change through `transitionArticle()`, and enforces `ALLOWED_TRANSITIONS`. Ingestion must be brought onto that same path rather than given a parallel one.

## 1. Entry state — what ingestion writes, and why

### 1.1 Decision

**Ingested articles enter at `NewsStatus.DRAFT`, and ingestion additionally creates the `ContentWorkflow` row at `WorkflowStage.DRAFT` with `assignedTo = null`.**

No new `NewsStatus` value is added.

### 1.2 Do we need a new stage between "raw" and "ready for human review"?

**The distinction is needed. A new `NewsStatus` is not.** Two different things are being tracked and they should not be collapsed:

- `News.status` is the **legal gate** — it answers "may this be seen by the public?" It has exactly one job and `ALLOWED_TRANSITIONS` already guards it.
- `ContentWorkflow.stage` is the **newsroom's view of the work** — it answers "where is this in the process and who owns it?" `WorkflowStage` already models the missing distinction: `DRAFT → WRITING → REVIEW → APPROVAL → PUBLISHED`.

Mapped onto the owner's flow:

| Reality | `News.status` | `ContentWorkflow.stage` |
|---|---|---|
| Collected, still the source's raw text | `DRAFT` | `DRAFT` |
| Rewritten in NotiLab's voice, not yet submitted | `DRAFT` | `WRITING` |
| Submitted, a reviewer is reading it | `PENDING_REVIEW` | `REVIEW` |
| Reviewer cleared it, awaiting the approver | `PENDING_REVIEW` | `APPROVAL` |
| Live | `PUBLISHED` | `PUBLISHED` |

So "raw" and "ready for review" are distinguishable without a migration, and the gate becomes a **precondition on an existing edge** (`DRAFT → PENDING_REVIEW` is refused while the article is still raw — see § 3.3), not a new state.

### 1.3 Why not a new `NewsStatus.INGESTED`

Rejected deliberately, and recorded so it is not re-litigated:

- Every consumer listed in § 0 filters on `PUBLISHED`, so a new value buys no extra safety — `DRAFT` is already invisible to all of them.
- A new enum value means a schema migration plus an audit of every status-aware query, badge map, filter dropdown and Kanban column, for a distinction two existing enums already express.
- `ALLOWED_TRANSITIONS` would need a new row and a new edge, widening the one table whose narrowness *is* the safety property.

Revisit only if the CMS genuinely needs raw items excluded from the "Rascunho" column — and that is a query filter (`stage: DRAFT` vs `stage: WRITING`), not an enum.

### 1.4 What ingestion must stop doing, and start doing

- **Stop:** writing `status: "PUBLISHED"`.
- **Start:** writing `status: "DRAFT"`, creating the `ContentWorkflow` row, and leaving `authorId` **null**. An ingested article has no human author yet; stamping one would be a false byline. Attribution for the collection act belongs in the audit trail as `system:ingestion`, following the `system:cron` precedent in `app/api/cron/publish-scheduled/route.ts`.
- **Unchanged:** `sourceUrl`, `sourceName`, `sourceId`, `publishedAt`, `categoryId`, `tags`, dedup, the quality gate. None of this document weakens `lib/ingestion/quality.ts` — the quality gate decides *whether we keep an item at all*; this workflow decides *whether a kept item may be seen*.

### 1.5 Consequences that must be accepted, not discovered later

1. **The feed stops growing on its own.** Publication volume becomes a function of human review capacity. This is the intended trade; it must be an accepted cost, not a surprise next week.
2. **Already-published legacy rows stay published.** Mass-unpublishing live articles is itself a visible product event and is not part of this change. Legacy raw-source rows are handled by the archive sweep already pending in `docs/editor/content-focus.md` § F, under a REVISOR, not by an automated flip.
3. **A stale draft must not accumulate forever.** An ingested article not submitted for review within **7 days** is auto-transitioned `DRAFT → ARCHIVED` (an edge `ALLOWED_TRANSITIONS` already permits). News has a shelf life; an un-reviewed backlog of thousands is a liability, not an asset.
4. **`lib/ai-generate-service.ts` loses its source material.** See § 7.1 — this is the one cross-module break that must be fixed in the same change or the generator silently returns `NO_SOURCES` forever.

## 2. The rewrite step — legitimate rewriting vs. fabrication

### 2.1 Why the rewrite exists

Two independent reasons, both load-bearing:

1. **Voice.** NotiLab publishes in **Mozambican Portuguese**, following the ***acordo ortográfico*** (owner's decisions, 2026-11-13), in its own register — defined in `docs/editor/writing-style.md`, whose remaining proposals still await the owner's correction. Both must be stated explicitly in the rewrite prompt: left implicit, the output follows the sources, which are mostly European Portuguese and inconsistent about the spelling. Neither applies to quotes or to `News.content`. `lib/ai-processing/` only *enriches* (`summary`, `tldr`, `whyItMatters`, `explainLikeIm10`, `titleTranslated`) — it has never rewritten the body.
2. **Rights.** Publishing a source's full literal text is republication. Our own retelling, attributed and linked, is journalism. The rewrite is what makes publication defensible.

The rewrite is a *rendering* of the source, in exactly the sense `ArticleAI` already means. It is not a new article and it is not an opinion.

### 2.2 Which field holds what — non-negotiable

| Content | Field | Rule |
|---|---|---|
| The source's literal text | `News.content` | **Immutable once ingestion writes it.** Never overwritten, never truncated, never replaced by the rewrite. It is the evidence against which any fabrication claim is checked. |
| NotiLab's rewritten body | a new field on `ArticleAI` (e.g. `bodyRewritten`) | What the public actually reads. |
| The headline the feed renders | `ArticleAI.titleTranslated` | Owned by the rewrite step once a rewrite exists (see § 2.5). |
| The source's original headline | `News.title` | Unchanged, kept for traceability. |
| Provenance | `News.sourceUrl` / `sourceName` / `sourceId` | **Immutable.** `lib/editorial/article-service.ts` already excludes these from `UpdateArticleInput`; ingestion and the rewrite step must honour the same rule. |

The rewrite lives on `ArticleAI` rather than in a new table because it inherits the retry machinery `business-rules.md` already blesses (`attempts` / `lastError` / `processedAt`). It needs **its own** counters (rewrite attempts, rewrite error, rewritten-at) — see § 3.5.

Implementation naming is `04-backend-api`'s and `05-database`'s call; the editorial requirement is only this: **the source text and our text occupy two different fields, and the source text is never destroyed.**

### 2.3 Legitimate rewriting — permitted

- Rendering into Portuguese, including translating a foreign-language source.
- Restructuring: new lede, inverted-pyramid reordering, splitting or merging paragraphs.
- Condensing — dropping detail the source carries.
- Changing register and voice to NotiLab's.
- Writing our own headline, provided the body supports it.
- Adding explicit attribution phrasing ("segundo a Reuters", "de acordo com o Marca").
- Adding context **only** when it is present in the same source (or another cited in-scope source for the same story) and is attributed.

### 2.4 Fabrication — forbidden, and these are the failure modes to test for

- **New facts.** Any statistic, score, date, age, location, casualty figure or name not in the source.
- **Sharpened certainty.** "pode ter decidido" → "decidiu". Hedges in the source stay hedges in our text. This is the most common and most deniable form of fabrication.
- **Manufactured quotes.** A quote is carried verbatim or dropped. Never paraphrase inside quotation marks; never attribute a quote to a different speaker. Translating a quote is permitted (the original stays recoverable in `News.content`); changing what it means is not.
- **Invented verdicts or ratings.** For the `filmes` vertical, no star score, "X/10", or "critical consensus" the source does not state, and never the AI's own judgment presented as the critic's (`content-focus.md` Addendum v1.1 § E).
- **Added framing or blame.** For `mocambique` and `africa-do-sul`, no causal attribution, emotional colouring or dehumanising language beyond the source (`content-focus.md` § G).
- **Unattributed merging.** If the rewrite draws on more than one source, each claim traces to the source that carries it.
- **Headline not supported by the body.** Clickbait is fabrication at the headline level.
- **Dropped provenance.** A rewrite that loses `sourceUrl`/`sourceName`/`sourceId` is rejected outright, whatever its quality.

### 2.5 Single-writer rule

The rewrite step and the enrichment batch must not both write `titleTranslated`. Once a rewrite exists, the rewrite owns the headline and the enrichment batch must skip re-translating that article. `lib/ai-processing/processor.ts` currently selects on `OR: [{summary: null}, {titleTranslated: null}]` — it would otherwise re-translate the source headline over the written one.

### 2.6 Rendering rule

For any article that has a rewrite, the public surface renders the rewritten body and **never** `News.content`. Every published article displays `sourceName` and links `sourceUrl`. Attribution is not a footnote; it is part of what makes the rewrite legitimate.

## 3. Who moves what

`UserRole` ordering: `USER` < `REDATOR` < `REVISOR` < `SUPERVISOR` < `MARKETING` < `CRIADOR_CONTEUDO` < `ADMIN` < `SUPER_ADMIN`. Note the enum order is **not** an authority ladder — `MARKETING` and `CRIADOR_CONTEUDO` sit above `SUPERVISOR` numerically but hold *different*, not greater, editorial powers. Permission checks must be explicit per transition, never `role >= X`.

### 3.1 Transition ownership

| From → To (`News.status`) | Stage move | Who may | Notes |
|---|---|---|---|
| (create) → `DRAFT` | → `DRAFT` | `system:ingestion`, `REDATOR`, `CRIADOR_CONTEUDO`, agent API | Never any other entry status. |
| `DRAFT` (raw) → `DRAFT` (rewritten) | `DRAFT` → `WRITING` | rewrite step (system / `CRIADOR_CONTEUDO`), `REDATOR` writing manually | No `News.status` change. |
| `DRAFT` → `PENDING_REVIEW` | `WRITING` → `REVIEW` | `REDATOR`, `CRIADOR_CONTEUDO` | **Blocked unless § 3.3 preconditions hold.** |
| `PENDING_REVIEW` (review done) | `REVIEW` → `APPROVAL` | `REVISOR` | Status stays `PENDING_REVIEW`. The REVISOR clears, the SUPERVISOR approves. |
| `PENDING_REVIEW` → `DRAFT` | → `WRITING` | `REVISOR`, `SUPERVISOR` | "Send back for fixes". **This, not `REJECTED`, is the correct action for a fixable problem** (§ 3.4). |
| `PENDING_REVIEW` → `APPROVED` | `APPROVAL` → (held) | `SUPERVISOR` | The approval act. |
| `PENDING_REVIEW` → `REJECTED` | → `REJECTED` | `REVISOR`, `SUPERVISOR` | Terminal. |
| `APPROVED` → `PUBLISHED` | → `PUBLISHED` | `SUPERVISOR`; `system:cron` via a SUPERVISOR-created schedule | The publish act. |
| `PUBLISHED` → `APPROVED` | — | `SUPERVISOR` | Unpublish. Stays republishable without a second review — already the documented intent of `ALLOWED_TRANSITIONS`. |
| any → `ARCHIVED` (where legal) | → — | `SUPERVISOR`, `ADMIN`, `SUPER_ADMIN`, retention job | Non-destructive; the row and its provenance survive. |

Explicitly:

- **`REDATOR` may never approve or publish.** It may create, rewrite, and submit.
- **`REVISOR` may never publish, and may never reach `APPROVED` alone.** The `REVIEW → APPROVAL` handoff is the structural reason the two roles exist.
- **`MARKETING` holds no lifecycle transition at all.** Its remit is digest and messaging over already-`PUBLISHED` items.
- **`CRIADOR_CONTEUDO` is an authoring role, not an approving one.** It may trigger rewrites and submit for review; it stops at the same wall as `REDATOR`. This matters specifically because it is the AI-assisted role — the role closest to the AI must not also be the role that waves it through.
- **`ADMIN` / `SUPER_ADMIN` are not a bypass.** They may act at any stage, but `ALLOWED_TRANSITIONS` still applies: there is no `DRAFT → PUBLISHED` edge for anyone. Every action writes an `AdminAction` row.
- **The scheduler cron publishes only from `APPROVED`**, which `transitionArticle()` already enforces structurally. It is an execution mechanism for a human decision already taken, not an approval path.

### 3.2 Who becomes `authorId` / `reviewerId`

- `authorId` is a **human**. The AI rewrite does not set it. The `REDATOR` / `CRIADOR_CONTEUDO` who accepts or edits the rewrite and submits it becomes the author. An article submitted for review with a null `authorId` is an article nobody is accountable for.
- `reviewerId` is the `REVISOR` who cleared it.

### 3.3 Preconditions on `DRAFT → PENDING_REVIEW`

This is the new gate. The transition is refused unless all hold:

1. A rewrite exists and is non-empty (`ContentWorkflow.stage` is `WRITING`, not `DRAFT`).
2. The rewrite's last attempt succeeded — a failed or timed-out rewrite does not qualify, whatever partial text it left behind.
3. `sourceUrl`, `sourceName` are present and unchanged from ingestion.
4. The image rule in § 4 is satisfied — which, note, includes "no image at all".
5. A human `authorId` is set.

Refusal must be actionable in Portuguese, naming which precondition failed, following the pattern `ARTICLE_NOT_APPROVED` already sets for the publish gate.

### 3.4 `REJECTED` is terminal — use it accordingly

`REJECTED` and `ARCHIVED` have no outgoing edges. A story rejected because of a bad image or a weak rewrite is dead permanently and cannot be recovered. **`REJECTED` means "this story is not for NotiLab". "Fix this" is `PENDING_REVIEW → DRAFT`.** This must be stated in the CMS next to the reject button, because the cost of getting it wrong is invisible at the moment of the click.

### 3.5 When the AI fails the rewrite

`business-rules.md` is unambiguous: a failed AI step stays failed and retries; it never fakes success. For the rewrite that means:

- Record the attempt and the error on the article's own rewrite counters. Leave `News.status = DRAFT`, `stage = DRAFT`.
- **Never** fall back to the source text as if it were ours. That is the exact outcome the gate exists to prevent, arrived at by accident instead of by configuration.
- **Never** write a truncated/heuristic body and stamp it as rewritten.
- Retry to a cap (3, matching `MAX_ATTEMPTS`). On exhaustion the article surfaces in a CMS queue — **"Falhou a redacção"** — for a `REDATOR` to write by hand or for a `SUPERVISOR` to archive. Failure is visible work, not a silent drop.
- A partially-written rewrite is treated as absent.

**Existing violation, flagged not silently inherited:** `lib/ai-processing/processor.ts:106-109` already breaks this rule for *enrichment*. When the AI call throws or returns unparseable output it substitutes `generateFallback(...)` and passes it to `saveEnrichmentResult`, which sets `processedAt: new Date()` and clears `lastError` — so a failure is recorded as a success, and `whyItMatters` carries a canned string presented as analysis. This was tolerable when nothing gated on it. It must not be extended to the rewrite, and it should be fixed on its own ticket.

## 4. The image rule

### 4.1 What makes an image publishable

All must hold:

1. **Allowlisted host.** The image URL's host is on the licensed/open-domain allowlist, which records a licence basis per domain. Fail-closed: unknown host → not publishable. Never hotlink an unknown domain.
2. **HTTPS.**
3. **Came with the story.** The image was delivered by the provider as part of *this* item. An image found by separate search is not this story's image.
4. **Not a non-image.** Tracking pixels, logos, avatars and sub-minimum-dimension assets are rejected.
5. **Credit recorded** where the source supplies one.
6. **Depicts the actual story.** A generically relevant stock photo presented as the event is visual fabrication — the image-level equivalent of an invented quote. This is absolute for `mocambique` and `africa-do-sul`, where mis-illustration is a framing harm even when the image is perfectly licensed (`content-focus.md` § G).

### 4.2 What happens when it fails

`imageUrl` is set to null and **the article proceeds without an image**. A failed image never blocks the pipeline, never blocks submission, and never blocks publication. `lib/editorial/article-service.ts` already treats null, empty and `/placeholder.svg` as "no image" via `hasImage`, and `setArticleImage(id, null)` is already the sanctioned way to flag one for replacement — the plumbing exists.

### 4.3 Who decides

- **Ingestion** applies the allowlist mechanically. It makes no editorial judgment; it only drops what cannot be justified.
- **`REDATOR` / `CRIADOR_CONTEUDO`** may propose a replacement from an allowlisted domain or from NotiLab-owned media, before submitting.
- **`REVISOR`** decides at review: publish with no image, accept the proposed replacement, or send back. Publishing imageless is always an acceptable outcome and must be presented in the CMS as a normal choice, not an error state — otherwise reviewers will reach for whatever picture is nearest.
- **Adding a domain to the allowlist is an editorial decision** requiring `SUPERVISOR` or above, recorded with its licence basis. It is not a config tweak.

## 5. Portuguese labels

Portuguese in everything the reader and the editor see; English in code, schema, identifiers and `docs/`.

### `NewsStatus` → label

| Internal | Portuguese label |
|---|---|
| `DRAFT` | Rascunho |
| `PENDING_REVIEW` | Em revisão |
| `APPROVED` | Aprovado |
| `PUBLISHED` | Publicado |
| `REJECTED` | Rejeitado |
| `ARCHIVED` | Arquivado |

### `WorkflowStage` → label

| Internal | Portuguese label |
|---|---|
| `DRAFT` | Recolhido |
| `WRITING` | Em Redação |
| `REVIEW` | Em revisão |
| `APPROVAL` | Em aprovação |
| `PUBLISHED` | Publicado |
| `REJECTED` | Rejeitado |

`PENDING_REVIEW` ("Em revisão") deliberately spans the `REVIEW` and `APPROVAL` stages — the status is the gate, the stage is the detail. Showing both is correct, not redundant.

### Notes

- These labels live in **one** shared map, imported everywhere. They are currently duplicated ad hoc across `components/admin-news-manager.tsx`, `components/workflow-kanban.tsx`, `components/workflow-manager.tsx`, `components/workflow-history.tsx`, `components/campaign-manager.tsx` and `components/newsletter-manager.tsx`, which is how `PENDING_REVIEW` ended up labelled in one place and absent in others.
- **One label change:** `PENDING_REVIEW` moves from "Pendente" (current, in `admin-news-manager.tsx:92`) to "Em revisão". "Pendente" says nothing about *what* is pending.
- `WRITING` keeps the existing CMS string "Em Redação" (`workflow-kanban.tsx:43`). The repo mixes orthographies ("Redação" AO-1990 in the Kanban, "actualidade" pre-AO in `lib/ai-processing/fallback.ts`). **Standardising orthography is a separate decision for the product owner** and is deliberately not taken here; this spec just avoids adding churn.
- Suggested extra CMS queue labels: **"Falhou a redacção"** (§ 3.5) and **"Sem imagem"** (§ 4.2).

## 6. Invariants

Written as testable statements. Proposed for `docs/memory/business-rules.md` § Article lifecycle.

1. No code path creates a `News` row with `status` other than `DRAFT`. (`lib/ingestion/persist.ts` and `lib/editorial/article-service.ts` are the only two creators.)
2. A `News` row reaches `PUBLISHED` only from `APPROVED`, only via `transitionArticle()`.
3. An ingested article reaches `PENDING_REVIEW` only when a successful rewrite exists, provenance is intact, the image rule is satisfied, and `authorId` is a human.
4. `News.content` is byte-identical to what ingestion wrote, for the life of the row.
5. `News.sourceUrl`, `sourceName` and `sourceId` are never modified after creation by any path.
6. For any article with a rewrite, no public surface renders `News.content`.
7. Every `PUBLISHED` article displays `sourceName` and links `sourceUrl`.
8. A failed rewrite never sets a success timestamp, never clears the error, and never leaves the article eligible for submission.
9. No `REDATOR` or `CRIADOR_CONTEUDO` action results in `APPROVED` or `PUBLISHED`; no `REVISOR` action results in `PUBLISHED`; no `MARKETING` action changes `News.status`.
10. Every status transition writes an `AdminAction` (or agent audit) row naming the actor — including `system:ingestion` and `system:cron`.
11. `News.imageUrl` is either null, a NotiLab-owned asset, or a URL whose host is on the allowlist. No other value is ever persisted.
12. An article in `mocambique` or `africa-do-sul` never reaches `PUBLISHED` without a `reviewerId` — no automated path, including the scheduler, may be its only gate.
13. An ingested article still at `stage: DRAFT` after 7 days is `ARCHIVED`, not left pending indefinitely.
14. `ALLOWED_TRANSITIONS` is unchanged by this work. If a change requires widening it, that is a separate, explicitly-argued decision.

### Proposed addition to `docs/memory/business-rules.md`

Under **§ Article lifecycle**, after the existing third bullet:

> - Ingestion and AI generation create at `DRAFT` — never `PUBLISHED`. `lib/ingestion/persist.ts` previously wrote `status: "PUBLISHED"` directly, which meant nothing collected was ever reviewed; that is the one hole the lifecycle rule above existed to prevent. The raw-vs-written distinction rides on `ContentWorkflow.stage` (`DRAFT` = collected raw, `WRITING` = rewritten in NotiLab's voice), not on a new `NewsStatus`.
> - `DRAFT → PENDING_REVIEW` for an ingested article requires a successful NotiLab rewrite, intact provenance, a satisfied image rule, and a human `authorId`. Full spec: `docs/editor/ingestion-editorial-workflow.md`.
> - `REJECTED` is terminal and means "not for NotiLab". The correct action for a fixable problem is `PENDING_REVIEW → DRAFT`.
> - `REVISOR` clears (`REVIEW → APPROVAL` stage); `SUPERVISOR` approves (`→ APPROVED`) and publishes. `REDATOR` and `CRIADOR_CONTEUDO` stop at submission. `MARKETING` holds no lifecycle transition. The `UserRole` enum order is not an authority ladder — check roles explicitly per transition, never `role >= X`.

Under **§ AI-content correctness**:

> - `News.content` is the source's literal text and is immutable after ingestion. NotiLab's rewritten body lives on `ArticleAI` with its own attempts/error/timestamp counters, separate from enrichment state. A rewrite that loses provenance, sharpens a hedge, invents a quote or manufactures a rating is fabrication regardless of fluency.
> - A published article renders our rewrite, never the source's text, and always shows `sourceName` + `sourceUrl`.
> - Images are publishable only from an allowlisted licensed/open domain, delivered with the story, actually depicting it. Otherwise the article runs with no image and the `REVISOR` decides. Never hotlink an unknown domain; never illustrate with a stock image presented as the event.

## 7. Open items for other owners

### 7.1 `lib/ai-generate-service.ts` breaks silently — must be fixed in the same change

`findSourcesForTopic` (line 89) and `generateDraftFromSources` (line 136) select source material with `status: "PUBLISHED"`. Once ingestion stops publishing, the pool of fresh material is empty and the generator returns `NO_SOURCES` for anything recent — with a message blaming ingestion coverage, which will be wrong and will cost someone a day.

Editorial ruling: **source selection must not be restricted to `PUBLISHED`.** Ingested `DRAFT` material is legitimate *source material* — it is the source outlet's reporting, which is exactly what the generator is meant to ground on. The correct filter is "has provenance, and is not `REJECTED` or `ARCHIVED`". Grounding on unreviewed material is safe here precisely because the output is itself a `DRAFT` that must pass the same gate. Owner: `04-backend-api` / `07-ai-pipeline`.

### 7.2 Recency vs. `publishedAt` — needs `01-cto`

`publishedAt` is the source's publication date, and `transitionArticle()` deliberately leaves it alone on publish so republishing does not reorder the feed. With a human gate in front, an article may go live two days after its `publishedAt`. The feed sorts and decays on `publishedAt`, so reviewed articles will enter the feed pre-buried, and the 48h pinned-story window in `app/api/news/feed/route.ts` will miss them.

Editorial position: **`publishedAt` stays the source's date** — it is a factual claim about when the news happened and changing it would be a small lie that also breaks dedup. The fix belongs in ranking recency, which should key off the moment the article became visible. That is a `lib/ranking.ts` change and therefore `01-cto`'s call, not mine. Flagging rather than deciding.

### 7.3 Review capacity

The gate makes human review the throughput limit. Before this ships, the product owner should state the expected daily review volume and who holds `REVISOR` / `SUPERVISOR` — `docs/editor/content-focus.md` § F already notes there is no seeded `ADMIN`/`SUPER_ADMIN` user to attribute actions to. A gate with nobody behind it is an outage with extra steps.

### 7.4 Enrichment fallback

§ 3.5's flagged violation in `lib/ai-processing/processor.ts` is pre-existing and out of scope here, but it is a live contradiction of `business-rules.md` and should get its own ticket. Owner: `07-ai-pipeline`.
