# Decisions

Append-only log of durable decisions. If a decision is later superseded, add a new entry noting the change — don't edit or delete the old one.

## 2026-07-13 — AI-first governance bootstrap

- **Decision**: Adopt a tool-agnostic `AGENTS.md` at repo root as the top authority for Claude Code, GitHub Copilot, and Codex, with tool-specific files (`CLAUDE.md`, `.github/copilot-instructions.md`) beneath it in authority order.
- **Decision**: Standardize on **pnpm** as the package manager everywhere (CI, Copilot instructions, and now `AGENTS.md`/`README.md`) — `README.md` previously drifted to `npm`.
- **Decision**: 11 Claude Code subagents (`00-orchestrator` through `10-docs-memory`), split into plan-only (00–02, architecture/risk/domain-meaning) and execution (03–10, can edit), mirroring the split used by the Cash-Flow reference project but with a NotiLab-specific domain roster (editorial-content, integrations-social, ai-pipeline in place of finance-specific agents).
- **Decision**: Quality gate is scoped to what's actually enforced today — ESLint (`pnpm lint`), TypeScript (`pnpm typecheck`), Next.js build (`pnpm build`), plus the existing `security.yml` scans (CodeQL, `pnpm audit`, secret scanning). No new test framework, duplication checker, or pre-push hook was added — those are documented as Phase 2, not built now, to avoid introducing infrastructure the team hasn't asked for.
- **Decision**: Roadmap (`docs/manager/roadmap/ROADMAP.md`) and daily reports (`docs/manager/daily-reports/`) are hand-maintained from templates, not auto-generated from git history or task-spec frontmatter — deferred until there's enough task volume to justify a generator script.
- **Decision**: No `.github/agents/*.agent.md` Copilot persona files were added, to avoid the copy-paste drift risk observed in the reference project's version of these files. Copilot governance is `.github/copilot-instructions.md` + the existing 3 prompt files (`code-review`, `cto-review`, `security-review`).

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
