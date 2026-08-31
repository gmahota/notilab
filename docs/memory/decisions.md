# Decisions

Append-only log of durable decisions. If a decision is later superseded, add a new entry noting the change — don't edit or delete the old one.

## 2026-07-13 — AI-first governance bootstrap

- **Decision**: Adopt a tool-agnostic `AGENTS.md` at repo root as the top authority for Claude Code, GitHub Copilot, and Codex, with tool-specific files (`CLAUDE.md`, `.github/copilot-instructions.md`) beneath it in authority order.
- **Decision**: Standardize on **pnpm** as the package manager everywhere (CI, Copilot instructions, and now `AGENTS.md`/`README.md`) — `README.md` previously drifted to `npm`.
- **Decision**: 11 Claude Code subagents (`00-orchestrator` through `10-docs-memory`), split into plan-only (00–02, architecture/risk/domain-meaning) and execution (03–10, can edit), mirroring the split used by the Cash-Flow reference project but with a NotiLab-specific domain roster (editorial-content, integrations-social, ai-pipeline in place of finance-specific agents).
- **Decision**: Quality gate is scoped to what's actually enforced today — ESLint (`pnpm lint`), TypeScript (`pnpm typecheck`), Next.js build (`pnpm build`), plus the existing `security.yml` scans (CodeQL, `pnpm audit`, secret scanning). No new test framework, duplication checker, or pre-push hook was added — those are documented as Phase 2, not built now, to avoid introducing infrastructure the team hasn't asked for.
- **Decision**: Roadmap (`docs/manager/roadmap/ROADMAP.md`) and daily reports (`docs/manager/daily-reports/`) are hand-maintained from templates, not auto-generated from git history or task-spec frontmatter — deferred until there's enough task volume to justify a generator script.
- **Decision**: No `.github/agents/*.agent.md` Copilot persona files were added, to avoid the copy-paste drift risk observed in the reference project's version of these files. Copilot governance is `.github/copilot-instructions.md` + the existing 3 prompt files (`code-review`, `cto-review`, `security-review`).

## 2026-08-31 — Agent Management API (external AI agents as editors)

Context: NotiLab is to be operable by an external AI agent (initially Abacus.ai) acting as an **editor**, not a developer — no code changes, no direct database access, everything through NotiLab's business rules.

- **Decision**: External agents get their own surface at `/api/agent/*` with its own authentication (static API key, environment only), separate from `lib/admin-auth.ts`. Reusing the human JWT/cookie path would have meant either handing an agent a person's session or teaching the login surface to accept bearer tokens — both enlarge the human auth surface, which is the opposite of the goal.
- **Decision**: Capabilities are a **compile-time registry** of declared tools (`lib/agent/registry.ts`), each with a name, description, input schema, output schema, permission set and audit action. No generic `/execute`, no endpoint taking an instruction, no dynamic registration. Adding a capability is a reviewed commit. `/api/agent/tools/[tool]` is a dynamic route only as transport — the name is in the URL and resolves solely against the registry.
- **Decision**: A new business layer, `lib/editorial/`, owns the article lifecycle, the editable-field whitelist and the publish gate. Route handlers stay thin (AGENTS.md § Next.js Rules) and a future admin UI can reuse it. This is where "an article reaches PUBLISHED only from APPROVED" lives, so it holds for every caller rather than per-route.
- **Decision**: Own ~200-line validator (`lib/agent/schema.ts`) instead of adding zod. AGENTS.md § Dependency Policy prefers what is installed, and the module has to emit JSON Schema for OpenAPI/capabilities anyway — one declaration that both validates and advertises cannot drift.
- **Decision**: **No Prisma schema change.** Local and production share one Neon database and deploys do not run `prisma migrate deploy` (see `prod-db-differs-from-local` / `prod-deploys-bypass-ci` context), so a migration is a manual production operation. Consequences, all documented in `docs/agent-api.md` § Limitations rather than worked around: SEO maps onto `slug`/`title`/`summary` because no `seoTitle`/`seoDescription` columns exist; scheduling is stored as append-only intent rows in `AdminAction` (`resource: ARTICLE_SCHEDULE`) rather than a `scheduledFor` column; idempotency reuses `AdminAction` and therefore has a millisecond-wide race with no `@@unique` to close it.
- **Decision**: Audit reuses `AdminAction` (it already exists for this, and has no FK to `users`, so `userId = "agent:<id>"` works without an agent impersonating a person). Failed and refused writes are audited too. A failed audit write never fails the request — it surfaces as `meta.auditRecorded: false`.
- **Decision**: "Destaque" maps to `News.priority` (authored), **not** `News.trending`. `business-rules.md` requires `trending`/`rankingScore`/`importanceScore` stay derived from real signals; no tool can write them.
- **Decision**: `/api/cron/publish-scheduled` is written and tested but **deliberately not registered in `vercel.json`**. It is the only cron that would publish to the public site unattended; enabling it is an operator decision.
- **Decision**: Default permissions with no configuration are `readonly`. A forgotten env var must under-grant, never over-grant.
- **Known trade-off, accepted**: granting one credential both `article.review` and `article.publish` lets that agent approve and publish its own drafts. Splitting drafting and publishing across two credentials is the operator's call, documented rather than forced.
- **Known gap, not fixed here**: `GET /api/news` has no `status` filter, so it returns drafts and archived articles. Pre-existing; it means `unpublish_article` does not remove an article from that one endpoint. Fixing it changes public behaviour and was kept out of scope.

## 2026-08-31 — Clearing the dependency audit CI gate

Context: `Dependency Vulnerability Audit` (`pnpm audit --audit-level=high` in `.github/workflows/security.yml`) had been failing on every PR — 20 advisories, 12 of them high. It was failing on PR #96 too, so it was being merged past rather than acted on. A permanently red required check trains people to ignore red checks, which is the actual cost.

- **Decision**: Bump `next` 15.5.19 → 15.5.25 (and `eslint-config-next` to match). Three of the twelve highs were in Next.js itself and directly relevant to a public site: DoS in the App Router via Server Components, SSRF in Server Actions, SSRF in rewrites. Patch-level bump inside 15.5.x.
- **Decision**: The remaining nine are transitive and pinned with `pnpm.overrides` rather than by waiting for upstream:
  - `postcss@8` → `^8.5.26` (arbitrary file read; path traversal via `sourceMappingURL`)
  - `nanoid@3` → `^3.3.18` (infinite loop with custom generators)
  - `js-yaml@4` → `^4.3.1` (quadratic CPU on `!!omap`)
  - `brace-expansion@1` → `^1.1.18` and `brace-expansion@>=4 <6` → `^5.0.9` (unbounded expansion DoS; the two major lines are affected separately, hence two range-scoped keys rather than one blanket override that would force v5 onto v1 consumers)
  - `sharp` → `^0.35.0` (inherited libvips advisories)
- **When to remove an override**: when the direct dependency that pulls the package in has itself moved past the patched version. An override that is no longer doing anything is worse than none — it silently pins a transitive dependency and nobody remembers why. `pnpm why <pkg>` shows whether it is still needed.
- **Result**: `pnpm audit` reports no known vulnerabilities. Verified with lint, typecheck, tests and a production build after the bump, since `sharp` is a native module and a `next` bump can break a build.
- **Not fixable in a commit**: `Dependency Review` fails with *"Dependency review is not supported on this repository. Please ensure that Dependency graph is enabled."* The dependency graph is off (the SBOM endpoint 404s) — a repository setting under Settings → Code security, not anything a PR can change. Deliberately did **not** soften the workflow with `continue-on-error` to make CI green: weakening a security check to hide a configuration gap is the wrong trade. `dependabot_security_updates` and `secret_scanning` are also disabled, which is why these advisories accumulated unnoticed in the first place.
