# Project Context

NotiLab is an AI-powered news aggregation and notification platform (Next.js 15 / React 19 / TypeScript / PostgreSQL+Prisma), currently pre-production / single-maintainer stage (`@gmahota`, per `.github/CODEOWNERS`).

Product surface: public news feed/article/category/trending pages, an AI chat assistant ("NotiBot"), digest email subscriptions, WhatsApp/Telegram messaging delivery, Reddit-sourced news, gamification (streaks, reactions, referral shares, A/B growth experiments), and an admin CMS (editorial workflow, AI news generation, marketing tools) gated by RBAC roles.

This `docs/`, `.claude/`, and root `AGENTS.md`/`CLAUDE.md` governance system was bootstrapped on 2026-07-13, using `C:\GMM\source\Sal\Cash-Flow` as a structural reference (see `docs/memory/lessons-learned.md`). It intentionally started lean: no new test framework, no automated roadmap/daily-report generators — those are documented as Phase 2 options once the team/traffic justifies the added infrastructure.
