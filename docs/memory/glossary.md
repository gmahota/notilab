# Glossary

- **NotiBot** — the AI chat assistant feature (`app/chat/`, `app/api/chat/`), backed by `lib/ai-service.ts`.
- **Digest** — a periodic (daily/weekly) email/content roundup built from a content window; one `DigestIssue` per run, fanned out as `DigestDelivery` rows.
- **Trending** — a news item flagged via real signal (search volume, reaction/read velocity), tracked via `News.trending` and `TrendingTopic`.
- **Ranking score** — `News.rankingScore`, a composite 0–100 score recalculated by the `recalculate-ranking` cron job from engagement + source reliability + recency signals.
- **Importance score** — `News.importanceScore` (schema-level) and `ArticleAI.importanceScore` (AI-assessed) — how significant the AI judges the story to be, 0–100.
- **Streak** — `UserStreak`, consecutive days of user activity; `streakFrozenUntil` is the sanctioned grace period.
- **Referral share** — `ArticleShare`, a share event with a unique `code` used in the `/s/[code]` short link, tracked for visit/conversion attribution via `ShareVisit`.
- **Growth experiment** — an A/B test (`GrowthExperiment`) with sticky per-user variant assignment (`ExperimentAssignment`).
- **Workflow stage** vs **News status** — `ContentWorkflow.stage` is the human CMS/Kanban tracking state; `News.status` is the article's actual publication state. See `docs/memory/architecture.md` for how they relate.
- **RBAC roles** — `USER`, `REDATOR` (writer), `REVISOR` (reviewer), `SUPERVISOR` (approver), `MARKETING`, `CRIADOR_CONTEUDO`, `ADMIN`, `SUPER_ADMIN` (see `UserRole` enum).
- **Quality Gate** — the set of checks (`pnpm lint`, `pnpm typecheck`, `pnpm build`, security scans) that must pass before a change is considered mergeable. See `docs/manager/qualidade/QUALITY_GATE.md`.
