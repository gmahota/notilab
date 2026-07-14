# Architecture

Durable architectural facts. Outranks `.claude/agents/*.agent.md` per Authority Order — if an agent file says something that contradicts this, this file wins.

## Layers

```
app/            Next.js App Router — pages (public + admin) and API route handlers
components/     UI (feature components + components/ui/ shadcn primitives)
lib/            Service layer — all data access and business logic lives here
prisma/         Schema, migrations, seed
```

Route handlers in `app/api/**/route.ts` stay thin: validate input, call a `lib/` function, return `{ success, data }` / `{ success, error }`. No Prisma calls and no business logic directly in route files or components.

## Core domains (by `lib/` module)

- **Content**: `lib/news-service.ts`, `lib/sources.ts` — news CRUD, category/source lookups.
- **Ingestion pipeline**: `lib/ingestion/` — `providers.ts` (GNews/NewsAPI/RSS fetch) → `normalize.ts` → `deduplicate.ts` → `categorize.ts` → `persist.ts` → `ai-queue.ts` → `pipeline.ts` orchestrates the sequence. Triggered by `app/api/cron/sync-news`.
- **AI processing**: `lib/ai-processing/` — `call-ai.ts` (OpenAI/Groq call) → `parse-output.ts` → `save-result.ts`, with `fallback.ts` for failure handling and `prompt.ts` for prompt templates. Writes to the `ArticleAI` model (summary/tldr/whyItMatters/explainLikeIm10/shareText/importanceScore). Triggered by `app/api/cron/process-ai-news`. `lib/ai-service.ts` is the general-purpose AI client wrapper (also used by `app/api/ai/explain`, `app/api/ai/generate-news`, `app/api/chat`).
- **Ranking**: `lib/ranking.ts` / `lib/ranking-recalculate.ts` — computes `News.rankingScore` (composite, 0–100) and `News.importanceScore`. Triggered by `app/api/cron/recalculate-ranking`.
- **Digest**: `lib/digest.ts` (composition) / `lib/digest-send.ts` (delivery) — builds a `DigestIssue` from a content window and fans out `DigestDelivery` rows per subscriber. Triggered by `app/api/cron/generate-digest` and `app/api/cron/send-digest`.
- **Messaging**: `lib/messaging/` — `telegram.ts`, `whatsapp.ts` (channel clients), `format.ts` (message templates), `deliver.ts` (fan-out + `MessagingDelivery` logging). Triggered by `app/api/cron/send-messaging`; inbound via `app/api/messaging/telegram/webhook`.
- **Social / sharing**: `lib/social-service.ts`, `lib/growth/share.ts`, `lib/growth/referral.ts` — `ArticleShare` (referral codes, `/s/[code]`) and `ShareVisit`/`ShareHistory` for virality analytics.
- **Growth engine**: `lib/growth/` — `events.ts` (`UserEvent` append-only log), `streak.ts` (`UserStreak`), `experiments.ts` (`GrowthExperiment`/`ExperimentAssignment` A/B testing).
- **Auth**: `lib/admin-auth.ts` — JWT issuance/validation for admin routes (`app/api/admin/**`), RBAC via `UserRole`.
- **Admin**: `lib/admin/overview.ts`, `lib/admin/experiment-results.ts` — admin dashboard aggregates.

## Background jobs (Vercel Cron, see `vercel.json`)

`sync-news` (ingestion) → `process-ai-news` (AI enrichment) → `recalculate-ranking` → `generate-digest` → `send-digest` / `send-messaging`. Each is a cron-triggered API route calling into the corresponding `lib/` pipeline. All must be idempotent (see `.claude/agents/06-integrations-social.agent.md`).

## Editorial workflow vs. publication status

Two related-but-distinct state machines exist in the schema — don't conflate them:
- `News.status` (`NewsStatus`: DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED, or REJECTED/ARCHIVED) — the article's publication state.
- `ContentWorkflow.stage` (`WorkflowStage`: DRAFT → WRITING → REVIEW → APPROVAL → PUBLISHED, or REJECTED) — the human CMS/Kanban tracking of who's working on it and where, one row per news item (`newsId` unique).

See `docs/memory/business-rules.md` for the rules governing these.
