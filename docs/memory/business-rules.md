# Business Rules

Durable product invariants. This is `02-editorial-content`'s primary reference — outranks any agent file per Authority Order.

## RBAC roles (`UserRole` enum)

`USER` (regular reader) < `REDATOR` (writer, creates drafts) < `REVISOR` (reviewer, moves DRAFT/WRITING → REVIEW → APPROVAL) < `SUPERVISOR` (approves, moves to PUBLISHED) < `MARKETING` (digest/messaging campaigns, growth experiments) < `CRIADOR_CONTEUDO` (content creation, likely AI-assisted generation) < `ADMIN` < `SUPER_ADMIN`.

- A role must only perform actions matching its stage in the workflow. A REDATOR should not be able to publish; a REVISOR should not bypass SUPERVISOR approval.
- Every admin-side mutation should produce an `AdminAction` audit row (`action`, `resource`, `resourceId`).

## Article lifecycle

- `News.status` (`NewsStatus`): DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED. REJECTED/ARCHIVED are terminal.
- `ContentWorkflow.stage` (`WorkflowStage`): DRAFT → WRITING → REVIEW → APPROVAL → PUBLISHED tracks the human process; `assignedTo` names who owns the current stage.
- A news item should not become publicly visible (`PUBLISHED`) without having passed through REVIEW/APPROVAL, whether the content originated from ingestion, AI generation, or a human writer.

## AI-content correctness (see also `AGENTS.md` § AI-Content Correctness Rules)

- `ArticleAI` fields (`summary`, `tldr`, `whyItMatters`, `explainLikeIm10`, `shareText`) are AI-generated enrichments of a `News` row — they must never contradict or fabricate beyond what `News.content`/`sourceUrl` supports.
- `ArticleAI.attempts` / `lastError` / `processedAt` exist specifically so failed AI enrichment is visible and retryable — never silently substitute placeholder content on failure (see `lib/ai-processing/fallback.ts`); a failed enrichment should stay failed and retry, not fake success.
- `News.sourceUrl` / `sourceName` / `sourceId` (→ `NewsSource`) must always be preserved — this is the provenance trail. Never let a transformation step (ingestion, AI processing, digest composition) drop it.
- `NewsSource.priority` (0–100 reliability score) exists to weight trust in a source; ranking/ingestion logic should respect it, not treat all sources as equally reliable.

## Ranking & gamification invariants

- `News.rankingScore` and `importanceScore` are computed, not authored — they must derive from real signals (reactions, read history, source priority, recency, AI importance score), recalculated by the `recalculate-ranking` cron. Never hardcode a score to make a demo look better.
- `News.trending` should reflect actual signal (e.g. `TrendingTopic.searchVolume`, reaction/read velocity) — same rule: derived, not asserted.
- `UserStreak` (`currentStreak`/`longestStreak`) must only increment on genuine daily activity; `streakFrozenUntil` is the only sanctioned grace mechanism — don't add silent extra leniency elsewhere.
- `GrowthExperiment` / `ExperimentAssignment`: assignment is sticky per user per experiment (`@@unique([userId, experimentId])`) — never reassign a user to a different variant mid-experiment, that invalidates the A/B result.

## Digest & messaging rules

- One `DigestIssue` per frequency per run; `DigestDelivery` tracks per-subscriber send status for retry/audit — don't send without creating a delivery record first (needed for idempotency on retry).
- `MessagingSubscription` respects `categories` (empty = all) and `frequency` — a message must not go out to a channel that unsubscribed (`isActive: false`).
- Telegram/WhatsApp message content must come from `lib/messaging/format.ts` templates, not ad hoc string building in route handlers — keeps tone/format consistent across channels.

## Privacy

- `ShareVisit.ipHash` is a SHA-256 hash — the raw IP must never be stored. Follow the same pattern (hash, don't store raw) for any future need to dedupe by IP.
- `UserEvent.userId` is nullable to support anonymous analytics — don't force a user association where one doesn't exist.

## NOW V2 Story rules (spec "NotiLab NOW V2")

Structural facts live in `docs/memory/database.md` § Story layer. These are the rules that decide what a Story is allowed to *say*.

- **A Story is an event, not an article.** Several outlets covering one happening are one `Story` with many `StorySource` rows. If a change would produce two cards for one event, it is wrong regardless of how the data arrived.
- **A missing field is omitted, never filled.** `whyItMatters`, `keyFacts`, `context`, `whatsNext`, `location` and `timeline` each disappear from the card and the Brief when we hold nothing real. Filling them with plausible text — a restated headline as "why it matters", a guessed location, an invented number — is the one failure mode this product cannot recover from, because the whole proposition is that the explanation is trustworthy.
- **"Why it matters" states a consequence.** It must not restate the headline (spec § 4). A generator that paraphrases the headline into this field has failed even though the field is populated.
- **No status claim without a basis** (§ 17/§ 18). A single-source story that has never been revised carries no status badge — see `statusOrNull` in `lib/story-service.ts`. `confidenceScore` is internal: it decides whether to publish, hold, or seek another source, and is never shown to a user as a percentage.
- **Breaking is rare by design** (§ 32). Flagged urgent *and* fresh (≤6h). NotiLab should read as confident, not anxious — plain "Breaking", never sirens.
- **NotiBot keeps four registers apart** (§ 24): FACT (in the sources), CONTEXT (related background, not from these sources), ANALYSIS (its reading of the facts), UNKNOWN (the sources do not settle it). They carry different warranties, and blending them is how an interpretation gets read as reporting. UNKNOWN is the correct answer to most "what happens next?" questions. Enforced by `STORY_SCOPE_ADDENDUM` in `lib/chat-service.ts`, and only when a `storyId` scopes the question.
- **Sources are a feature, not a footnote** (§ 12). Every source is openable, and the Brief states plainly that NotiLab explains the event *based on* these sources and does not replace them. A single source is named on its own — never dressed up as "1 source", which would imply corroboration that does not exist.
- **The feed must not stack one subject** (§ 34), even when it is genuinely trending. Diversity is a weighted dimension of the ranking, not a post-hoc filter — see `lib/story-ranking.ts`.
- **An empty feed is good news** (§ 31). "You're caught up.", never "No news found."
- **Optimise for understanding per minute, not session time** (§ 35/§ 36). The north-star is Stories Understood — view duration combined with Brief, source and AI interaction. A change that raises time-on-feed while lowering source and Brief opens is a regression.
