# Database

PostgreSQL via Prisma. Schema at `prisma/schema.prisma`, single migration history so far (`20260321193926_init`).

## Model groups

- **Identity**: `User`, `UserProfile` (type: JOVEM/EXECUTIVO/ESTUDANTE/SENIOR, interests, language, timezone), `UserPreferences` (digest/push/email toggles, preferred categories).
- **Content**: `Category`, `News`, `ArticleAI` (1:1 AI enrichment), `NewsSource` (ingestion source registry with reliability `priority`).
- **Engagement**: `NewsReaction` (LIKE/LOVE/LAUGH/ANGRY/SAD/SHARE), `ReadHistory` (with `timeSpent`), `SavedArticle`.
- **Digest**: `DigestSubscription`, `DigestIssue` (one per run), `DigestDelivery` (per-subscriber status).
- **Messaging**: `MessagingSubscription` (channel + channelId unique pair), `MessagingDelivery` (per-send log, `telegramMsgId` for future edits).
- **Editorial/admin**: `ContentWorkflow` (Kanban stage per news item), `AdminAction` (audit log), `ChatSession` (NotiBot conversation state).
- **Growth engine**: `UserStreak`, `UserEvent` (append-only analytics log, indexed on `[userId, event]` and `[event, createdAt]`), `ShareHistory`, `ArticleShare` (referral codes for `/s/[code]`), `ShareVisit`, `NotificationLog`, `GrowthExperiment`, `ExperimentAssignment`.
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
