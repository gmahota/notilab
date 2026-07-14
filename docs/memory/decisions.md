# Decisions

Append-only log of durable decisions. If a decision is later superseded, add a new entry noting the change — don't edit or delete the old one.

## 2026-07-13 — AI-first governance bootstrap

- **Decision**: Adopt a tool-agnostic `AGENTS.md` at repo root as the top authority for Claude Code, GitHub Copilot, and Codex, with tool-specific files (`CLAUDE.md`, `.github/copilot-instructions.md`) beneath it in authority order.
- **Decision**: Standardize on **pnpm** as the package manager everywhere (CI, Copilot instructions, and now `AGENTS.md`/`README.md`) — `README.md` previously drifted to `npm`.
- **Decision**: 11 Claude Code subagents (`00-orchestrator` through `10-docs-memory`), split into plan-only (00–02, architecture/risk/domain-meaning) and execution (03–10, can edit), mirroring the split used by the Cash-Flow reference project but with a NotiLab-specific domain roster (editorial-content, integrations-social, ai-pipeline in place of finance-specific agents).
- **Decision**: Quality gate is scoped to what's actually enforced today — ESLint (`pnpm lint`), TypeScript (`pnpm typecheck`), Next.js build (`pnpm build`), plus the existing `security.yml` scans (CodeQL, `pnpm audit`, secret scanning). No new test framework, duplication checker, or pre-push hook was added — those are documented as Phase 2, not built now, to avoid introducing infrastructure the team hasn't asked for.
- **Decision**: Roadmap (`docs/manager/roadmap/ROADMAP.md`) and daily reports (`docs/manager/daily-reports/`) are hand-maintained from templates, not auto-generated from git history or task-spec frontmatter — deferred until there's enough task volume to justify a generator script.
- **Decision**: No `.github/agents/*.agent.md` Copilot persona files were added, to avoid the copy-paste drift risk observed in the reference project's version of these files. Copilot governance is `.github/copilot-instructions.md` + the existing 3 prompt files (`code-review`, `cto-review`, `security-review`).
