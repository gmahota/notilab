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
