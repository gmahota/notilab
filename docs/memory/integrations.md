# External Integrations

## AI providers

- **OpenAI / Groq** — via `lib/ai-service.ts` (general-purpose calls: `app/api/ai/explain`, `app/api/ai/generate-news`, `app/api/chat`) and `lib/ai-processing/call-ai.ts` (the ingestion-triggered enrichment pipeline, with `parse-output.ts`/`save-result.ts`/`fallback.ts`). Keys via `process.env.*`, never hardcoded.

## News ingestion sources

- Registered in the `NewsSource` model (`type`: "gnews" | "newsapi" | "rss" | "manual"), fetched by `lib/ingestion/providers.ts`, normalized/deduplicated/categorized/persisted through `lib/ingestion/pipeline.ts`. Reddit has a dedicated surface (`app/api/reddit-news`, presumably its own ingestion path — confirm against `lib/ingestion/providers.ts` before assuming parity with the generic pipeline).

## Messaging channels

- **Telegram** — `lib/messaging/telegram.ts` (outbound), inbound webhook at `app/api/messaging/telegram/webhook`. `MessagingDelivery.telegramMsgId` is stored for future message edits/replies.
- **WhatsApp** — `lib/messaging/whatsapp.ts`.
- Both share `lib/messaging/format.ts` (message templates) and `lib/messaging/deliver.ts` (fan-out + delivery logging via `MessagingDelivery`).
- Subscriptions keyed by `(channel, channelId)` unique pair in `MessagingSubscription` — Telegram uses `chat_id`, WhatsApp uses an E.164 phone number.

## Social / sharing

- `lib/social-service.ts` and `lib/growth/share.ts` / `referral.ts` handle share-link generation (`ArticleShare.code`, used in `/s/[code]`) and channel tagging (whatsapp/telegram/twitter/copy). Twitter/X appears as a share *channel* here rather than a full posting integration — verify before assuming NotiLab posts to Twitter automatically.

## Background jobs / cron (`vercel.json`)

Six scheduled jobs, each a thin API route delegating to a `lib/` pipeline: `sync-news`, `process-ai-news`, `recalculate-ranking`, `generate-digest`, `send-digest`, `send-messaging`. All must be idempotent — see `AGENTS.md` § Background Jobs and Cron Rules and `.claude/agents/06-integrations-social.agent.md`.

## Deploy target

Vercel (primary). See `DEPLOYMENT.md` for environment variables and manual VPS/Nginx deployment as a fallback path.
