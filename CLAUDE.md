# CLAUDE.md — NotiLab Claude Code Operating Manual

## Purpose

This file governs how Claude Code operates in this repository. It sits below `AGENTS.md` in authority — if the two ever disagree, `AGENTS.md` wins.

## Authority Order

1. `AGENTS.md`
2. `CLAUDE.md` (this file)
3. `docs/memory/*`
4. `.claude/agents/*.agent.md`
5. The current task prompt
6. Existing code

## Project Identity

See `AGENTS.md` § Project Identity. In short: Next.js 15 / React 19 / TypeScript strict / Prisma + PostgreSQL / pnpm, an AI news-aggregation and notification platform with an editorial CMS, AI content generation/curation, social integrations (WhatsApp, Telegram, Twitter, Reddit), and gamification.

## Enterprise Execution Mode

Act like a CTO, architect, security engineer, and QA lead would collectively act on a production system with real users — not like a generator producing a one-off demo. Prefer the boring, correct, reversible option over the clever one. Flag risk instead of hiding it.

## Active Claude Agents

Eleven subagents live in `.claude/agents/`, template-synced from `docs/prompts/claude/agents/` (see § Agent Template Sync Workflow below — never hand-edit the two copies independently).

```
00-orchestrator          routes work, never edits              (plan)
01-cto                   architecture/strategy, never edits     (plan)
02-editorial-content     domain meaning owner, never edits      (plan)
03-frontend              app/**, components/**                 (edit)
04-backend-api           app/api/**, lib/*-service.ts           (edit)
05-database              prisma/**                              (edit)
06-integrations-social   lib/messaging/, lib/ingestion/         (edit)
07-ai-pipeline           lib/ai-service.ts, lib/ai-processing/   (edit)
08-security              lib/admin-auth.ts, RBAC, secrets       (edit)
09-testing               test bootstrap, quality gate checks    (edit)
10-docs-memory           docs/memory/*, roadmap, daily reports  (edit)
```

00, 01, and 02 run in `permissionMode: plan` — they analyze and produce plans/specs but never call `Edit`/`Write`. 03–10 run in `permissionMode: default` and may implement.

## Slash Commands

- `/task-spec` — turn a request into an execution-ready Task Spec (`.claude/commands/task-spec.md`).
- `/strategy` — CTO-style pre-implementation analysis for anything architecturally significant (`.claude/commands/strategy.md`).
- `/execute-controlled` — scoped implementation with a mandatory pre-edit plan and post-edit report (`.claude/commands/execute-controlled.md`).
- `/update-agents` — sync `.claude/agents/*` from `docs/prompts/claude/agents/*` (`.claude/commands/update-agents.md`).
- `/daily-close` — end-of-day summary from git history + memory (`.claude/commands/daily-close.md`).

## AI Organisation Structure

```
                     00-orchestrator
                    /       |        \
             01-cto   02-editorial   (routes to 03-10)
                            content
        03-frontend  04-backend-api  05-database
        06-integrations-social  07-ai-pipeline
        08-security  09-testing  10-docs-memory
```

## Mandatory Task Decomposition (before implementing anything non-trivial)

1. Restate the goal in one sentence.
2. Identify which agent(s) own the affected area(s).
3. Check `docs/memory/*` for existing decisions/constraints on this area.
4. Check `docs/manager/roadmap/ROADMAP.md` for related in-flight work.
5. Classify complexity (see below) and pick the model tier accordingly.
6. Identify target files — do not expand scope beyond them without calling it out.
7. Identify what must NOT change (out of scope).
8. Write acceptance criteria before writing code.
9. Plan the validation step (`pnpm lint` / `pnpm typecheck` / `pnpm build` / manual exercise).
10. Implement.
11. Report: what changed, how it was validated, what's still open.

## Task Classification Rules

- **Low**: copy/text tweaks, styling-only changes, adding a log line, README fixes.
- **Medium**: new UI component, new API route following an existing pattern, new `lib/` function, non-schema-changing refactor.
- **High**: schema changes, auth/RBAC changes, new external integration, cron job changes, anything touching `lib/admin-auth.ts` or `lib/ai-service.ts`.
- **Critical**: anything that could publish incorrect/fabricated content automatically, anything that weakens auth, anything touching production data migrations.

## Model Routing Policy

- **Haiku**: mechanical, repetitive, low-risk work (formatting, doc generation, simple renames).
- **Sonnet**: default for implementation agents (frontend, backend-api, testing, docs-memory) — most day-to-day work.
- **Opus**: planning/architecture agents (cto, editorial-content) and agents touching high-blast-radius surfaces (database, integrations-social, ai-pipeline, security).

Do not escalate to Opus for repetitive or low-risk work — match the tier to the task classification above, not habit.

## Agent Routing Rules

- **Use 00-orchestrator** when the request is ambiguous or spans multiple domains — it produces a routing plan, not code.
- **Use 01-cto** for architecture decisions, risk assessment, or anything that changes a cross-cutting pattern.
- **Use 02-editorial-content** before changing article lifecycle, CMS workflow, category taxonomy, digest logic, or gamification scoring — it owns whether the *meaning* of the change is correct, not the code.
- **Use 03-frontend / 04-backend-api / 05-database / 06-integrations-social / 07-ai-pipeline / 08-security** for their respective implementation surfaces (see table above). **Must not** invent business rules, schema, or security policy outside their lane — escalate to 01-cto or 02-editorial-content instead.
- **Use 09-testing** to bootstrap coverage for anything just implemented, and to actually run the quality gate before a task is called done.
- **Use 10-docs-memory** whenever a decision, lesson, or architectural fact should outlive the current session — update `docs/memory/*`, not just the PR description.

## Context Loading Rules

Before a High/Critical task, read (in order): `AGENTS.md` → `CLAUDE.md` → relevant `docs/memory/*` files → `docs/manager/roadmap/ROADMAP.md` (for related in-flight work) → the actual code being touched.

## Validation Rules

- Never claim a test passed, a build succeeded, or lint is clean without actually running the command in this session.
- Check `package.json` scripts before inventing a command — `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm db:*`, `pnpm agents:sync` already exist.
- If there's no automated test for the area you changed, say so explicitly rather than implying coverage exists.

## Agent Template Sync Workflow

- Source of truth: `docs/prompts/claude/agents/*.agent.md`.
- Active copies: `.claude/agents/*.agent.md`.
- Sync spec: `docs/prompts/claude/update-agents.md`.
- Sync script: `pnpm agents:sync` (runs `scripts/agents/sync-claude-agents.mjs`).
- Never hand-edit `.claude/agents/*` and `docs/prompts/claude/agents/*` independently — edit the template, then run the sync.

## Documentation and Memory Rules

- `docs/memory/*` is durable knowledge — architecture facts, business rules, decisions, lessons learned. It outranks any agent file (see Authority Order). Update it when you learn something that should survive past this session.
- `docs/manager/roadmap/ROADMAP.md` and `docs/manager/daily-reports/` are maintained manually (see those files for format) — no generator script exists yet by design (lean starter). Keep entries honest and current rather than automating prematurely.

## Final Rule

If a change makes the system less secure, less maintainable, or less predictable, do not do it — explain why and propose the safer path.
