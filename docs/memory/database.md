# Database

PostgreSQL via Prisma. Schema at `prisma/schema.prisma`. Migrations: `20260321193926_init`, `20260818112211_growth_messaging_digest_layer`, `20260819120000_story_model`.

## Model groups

- **Identity**: `User`, `UserProfile` (type: JOVEM/EXECUTIVO/ESTUDANTE/SENIOR, interests, language, timezone), `UserPreferences` (digest/push/email toggles, preferred categories).
- **Content**: `Category`, `News`, `ArticleAI` (1:1 AI enrichment), `NewsSource` (ingestion source registry with reliability `priority`).
- **Engagement**: `NewsReaction` (LIKE/LOVE/LAUGH/ANGRY/SAD/SHARE), `ReadHistory` (with `timeSpent`), `SavedArticle`.
- **Digest**: `DigestSubscription`, `DigestIssue` (one per run), `DigestDelivery` (per-subscriber status).
- **Messaging**: `MessagingSubscription` (channel + channelId unique pair), `MessagingDelivery` (per-send log, `telegramMsgId` for future edits).
- **Editorial/admin**: `ContentWorkflow` (Kanban stage per news item), `AdminAction` (audit log), `ChatSession` (NotiBot conversation state).
- **Growth engine**: `UserStreak`, `UserEvent` (append-only analytics log, indexed on `[userId, event]` and `[event, createdAt]`), `ShareHistory`, `ArticleShare` (referral codes for `/s/[code]`), `ShareVisit`, `NotificationLog`, `GrowthExperiment`, `ExperimentAssignment`.
- **Story layer (NOW V2)**: `Story` (an *event*, not an article — headline/summary/whyItMatters/narrative/context/whatsNext, `status`, `importanceScore`, `confidenceScore`, hero media), `StorySource` (one outlet’s account; `newsId` links it to an ingested article, null for official statements/documents), `KeyFact`, `StoryEntity` (`normalized` for cross-story matching), `TimelineItem`. `News.storyId` attaches an article to a Story; `UserEvent.storyId` attributes the `story_*` analytics events.
- **Trends**: `TrendingTopic` (keyword + searchVolume, region-scoped, default "PT").

## Conventions already established

- IDs: `cuid()` everywhere, no auto-increment integers.
- Timestamps: `createdAt`/`updatedAt` pair on nearly every model (`@default(now())` / `@updatedAt`).
- Enums over free-text where the value set is fixed (`UserRole`, `NewsStatus`, `WorkflowStage`, `Priority`, `ReactionType`, `ProfileType`); free-text `String` with a comment listing valid values where the set is still evolving (`NewsSource.type`, `DigestSubscription.frequency`, `MessagingDelivery.messageType`, `NotificationLog.type`/`channel`, `ArticleShare.channel`).
- Analytics-heavy tables (`UserEvent`, `ShareHistory`, `ArticleShare`, `NotificationLog`) carry explicit `@@index` on their query patterns — follow this pattern for any new high-volume table rather than relying on the primary key alone.
- Nullable `userId` is the established pattern for supporting anonymous activity (`UserEvent`, `ShareHistory`, `ArticleShare`, `NotificationLog`) — don't make it required just to simplify a query.
- Cascade behavior: `onDelete: Cascade` for strictly-owned child rows (e.g. `UserProfile`, `SavedArticle`), `onDelete: SetNull` where the parent (e.g. `User` on `MessagingSubscription`) can be removed without invalidating the row's purpose.

## Migration policy

- All schema changes go through `prisma migrate dev` locally, committed as a new migration — never hand-edited on a running database.
- `05-database` agent owns migration-path thinking: what happens to existing rows when a column becomes required or an enum value is removed.
- Destructive commands (`prisma db push --force-reset`, `prisma migrate reset`) are local/dev-only and require explicit confirmation — see `AGENTS.md` § Prisma / Database Rules.

## Story layer — current state (2026-08-19)

The tables exist in the schema and in `20260819120000_story_model`, but **nothing populates them automatically**: clustering (spec § 19/§ 20) is Sprint 3. Until it lands:

- `lib/story-service.ts` is the only place that decides where a Story comes from. It reads the `Story` tables when they hold rows and derives the same read model from `News` + `ArticleAI` otherwise, so `/now` works either way.
- `lib/story-tables.ts` answers "has the migration been applied?" with `to_regclass`, cached for 60s. It deliberately avoids finding out by letting a query fail: Prisma logs those errors even when they are caught, and a recurring one reads as a broken database rather than the expected pre-migration state.
- `scripts/backfill-stories.ts` (`pnpm stories:backfill`) creates one Story per published article, single-source. Dry run unless given `--apply`.
- Every derived or backfilled Story therefore has exactly **one** source. No card can honestly say "Reuters + 4 sources" yet.

Fields with no data source yet, left null/empty rather than filled: `location`, `keyFacts`, `context`, `whatsNext`, `entities`, `timeline`, `confidenceScore`. The UI omits each section when it is empty — see the § 24 rule in `docs/memory/business-rules.md` for why guessing them is the one failure this product cannot afford.

### Two traps worth knowing before touching this

- **`News.updatedAt` is not an editorial signal.** The ranking cron writes `rankingScore`, which bumps it. `Story.updatedAt` *is* meaningful, which is why only Story-derived cards can show "Updated 8 min ago" (spec § 21).
- **Prisma `create` returns every column by default**, so its `RETURNING` clause names columns that may not exist on a database behind on migrations. `lib/growth/events.ts` passes `select: { id: true }` for exactly this reason — without it, adding `UserEvent.storyId` to the schema broke *all* event writes, article events included, until the migration was applied.
