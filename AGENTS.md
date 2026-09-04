# AGENTS.md — NotiLab Repository Operating Rules

## Purpose

This file is the single tool-agnostic charter for anyone or anything writing code in this repository — human, Claude Code, GitHub Copilot, Codex, Cursor, or any future assistant. It states the rules that apply regardless of which tool is doing the work. Tool-specific files (`CLAUDE.md`, `.github/copilot-instructions.md`) add operational detail on top of this file; they must never contradict it.

## Authority Order

When guidance conflicts, higher wins:

1. **This file (`AGENTS.md`)**
2. Tool-specific operating file (`CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for Copilot)
3. `docs/memory/*` (durable project knowledge — architecture, business rules, decisions)
4. `.claude/agents/*.agent.md` (subagent role definitions)
5. The current task prompt
6. Existing code patterns

If an agent definition or a prompt asks for something this file forbids, this file wins.

## Project Identity

NotiLab is an AI-powered news aggregation and notification platform (Next.js 15, App Router).

- **Framework**: Next.js 15 + React 19, TypeScript strict mode
- **Database**: PostgreSQL via Prisma ORM — all DB access goes through `lib/prisma.ts` and `lib/*-service.ts`
- **Styling**: Tailwind CSS v4 + Radix UI + shadcn/ui (`components/ui/`)
- **Auth**: JWT-based admin auth via `lib/admin-auth.ts`, role-based access (REDATOR, REVISOR, SUPERVISOR, MARKETING, CRIADOR_CONTEUDO)
- **AI**: OpenAI / Groq via `lib/ai-service.ts` and `lib/ai-processing/`
- **Integrations**: WhatsApp, Telegram, Twitter/X, Reddit (`lib/messaging/`, `lib/ingestion/`, `lib/social-service.ts`)
- **Background jobs**: Vercel Cron (`vercel.json`) — news sync, AI processing, ranking, digest, messaging
- **Package manager**: **pnpm** (do not use `npm`/`yarn` — see "Fix existing inconsistency" note below)
- **Deploy target**: Vercel

## Security First

- Never hardcode secrets, API keys, or tokens — always `process.env.*`.
- Admin routes must validate the JWT via `lib/admin-auth.ts`; never re-implement auth checks ad hoc.
- Sanitize and validate all user input before it reaches Prisma or an external API call.
- Never log passwords, tokens, or personal data.
- Respect the RBAC roles already defined in the schema — do not add new implicit permission checks scattered across routes.

## Dependency Policy

- Prefer already-installed dependencies over adding new ones.
- Before adding a new package, check it is actively maintained (no multi-year-stale packages) and has no known high/critical vulnerabilities (`pnpm audit`).
- Do not add a testing framework, linter, or build tool without discussing it first — the quality gate baseline (`docs/manager/quality/QUALITY_GATE.md`) is deliberately scoped to what's installed today.

## TypeScript Rules

- Strict mode is on (`tsconfig.json`) — do not weaken it.
- Avoid `any`; prefer explicit types or `unknown` + narrowing. (Note: `.eslintrc.json` currently disables `@typescript-eslint/no-explicit-any` — treat that as a gap to close over time, not a license to use `any` freely.)
- Prefer discriminated unions for API results (`{ success: true, data }` / `{ success: false, error }`) over throwing across module boundaries.

## Language Rules

- **English**: all code, identifiers, type/interface names, code comments, `prisma/schema.prisma` (models, fields, enums, comments), file and directory names, environment variable names, commit messages, all documentation, and developer/operator tooling output (a CLI script's `console.log` status text is developer-facing, so it's English).
- **Portuguese**: user-facing content only — article bodies, AI-generated `summary`/`tldr`/`whyItMatters`/`explainLikeIm10`/`titleTranslated`, UI copy and labels rendered to readers, `aria-label`s, and API error messages returned to end users.
- **The test**: who reads the string. A reader of the site sees Portuguese; a developer or operator reading a terminal, a schema, or a doc sees English.
- **Exception — persisted data values stay Portuguese**: `ProfileType` enum values (`JOVEM`, `EXECUTIVO`, `ESTUDANTE`, `SENIOR`) and category slugs (`mocambique`, `africa-do-sul`, `filmes`, `ciencia`). These are stored data, not identifiers; renaming them is a real migration (enum rename + backfill of every `user_profiles` row) plus a product-rule change that needs `02-editorial-content` sign-off. Do not pick these up as cosmetic cleanup.

## Next.js Rules

- Server components by default; add `'use client'` only when interactivity requires it.
- API route handlers (`app/api/**/route.ts`) stay thin — validate input, call a `lib/` service, map the result to a response. No business logic inline in the route file.
- Only `NEXT_PUBLIC_*` env vars may reach client code.

## Prisma / Database Rules

- All queries go through `lib/prisma.ts` / `lib/*-service.ts` — never instantiate a second `PrismaClient` or query from a component/route directly.
- Schema changes go through `prisma/migrations/`, never hand-edited on a running database.
- Do not run destructive commands (`prisma db push --force-reset`, `prisma migrate reset`) against anything but a local/dev database, and never without the user's explicit confirmation.

## API Rules

- Response shape: `{ success: true, data: T }` on success, `{ success: false, error: string }` on failure.
- Validate request body shape before processing (zod or manual checks — be consistent with whatever the target route already uses).

## AI-Content Correctness Rules

NotiLab's core product risk is publishing AI-generated news content that is wrong, fabricated, or unattributed. Treat these as invariants, not style preferences:

- AI-generated articles must retain a traceable link to their source material (`sources.ts` / ingestion metadata) — never strip provenance.
- Never let AI-generated content bypass the editorial workflow (draft → review → published) automatically; publishing gates are a human decision unless a task explicitly asks to change that.
- Do not fabricate statistics, quotes, or dates when generating or summarizing content — if the source doesn't state it, the output must not either.
- Ranking, trending, and gamification scores (`ranking.ts`, `trends.ts`) must be computed from real signals — never hardcode or fake a score to "make the demo look good."

## Testing Rules

- There **is** a test suite: Jest (via `next/jest`, config in `jest.config.mjs`), specs under `__tests__/`, run with `pnpm test`. Adding a case to it needs no new tooling and no prior discussion. (This section previously said no suite existed — true when written on 2026-07-13, stale since the Agent Management API work.)
- **`pnpm test` is not yet a CI job** — `.github/workflows/ci-cd.yml` runs lint, typecheck and build only. Until that changes, a passing suite is only as good as the last person who ran it locally, so run it before calling a task done.
- Coverage is partial by design, not uniform: the agent surface, editorial services and `lib/base-url.ts` are covered, as is `lib/ranking.ts`. `lib/ai-processing/*` and `lib/trends.ts` are **not**. Do not infer coverage — check for the spec file.
- When adding non-trivial logic (ranking, AI processing, auth), add at least a minimal case rather than none. Do not block a task on broadening the framework, but say plainly in the report which paths you left uncovered.
- Before asserting anything "works", actually run it (`pnpm lint`, `pnpm typecheck`, `pnpm build`, manual exercise of the flow) — see `docs/manager/quality/QUALITY_GATE.md`.

## Git and Pull Request Rules

- Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `chore(scope): ...`, `docs(scope): ...`, `refactor(scope): ...`.
- Keep PRs focused — under ~20 changed files where reasonably possible (per `.github/PULL_REQUEST_TEMPLATE.md`).
- Never force-push or rewrite shared history without explicit confirmation.

## Project Structure Rules

```
app/            Next.js App Router — admin/, api/, public pages
components/     UI components (+ components/ui/ shadcn primitives)
lib/            Service layer — prisma.ts, admin-auth.ts, ai-service.ts, *-service.ts
  ai-processing/  admin/  growth/  ingestion/  messaging/
prisma/         schema.prisma, migrations/, seed.ts
scripts/        setup.sh, dev-setup.sh, health-check.ts
docs/           governance + memory (this system)
.claude/        Claude Code agents/commands/config
.github/        CI workflows, Copilot instructions, CODEOWNERS
```

## Environment Variables

- Server-only secrets stay server-side (referenced only inside `lib/`); only `NEXT_PUBLIC_*` vars may be read by client components.
- See `DEPLOYMENT.md` for the full environment variable list.

## Background Jobs and Cron Rules

- `vercel.json` defines the cron schedule (news sync, AI processing, ranking, digest, messaging). Changing a cron endpoint's behavior changes production automation — treat it as a High-risk change (see `CLAUDE.md` Task Classification) and check idempotency before deploying.

## External Integrations

- OpenAI / Groq (`lib/ai-service.ts`), WhatsApp / Telegram / Twitter (`lib/messaging/`), Reddit (`lib/ingestion/`, `app/api/reddit-news/`). Integration-specific conventions live in `docs/memory/integrations.md`.

## Fix Existing Inconsistency

`README.md` previously documented `npm` commands while CI, Copilot instructions, and this file all standardize on `pnpm`. Use `pnpm` for all commands (`pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm db:*`, etc.).

## Final Rule

If a change would make the system less secure, less maintainable, or less predictable — even if requested — say so and propose the safer alternative instead of silently doing it.
