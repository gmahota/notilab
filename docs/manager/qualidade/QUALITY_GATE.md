# Quality Gate

This documents what "passing the gate" means for NotiLab today. It's deliberately scoped to what's already enforced — no new tooling was introduced to write this doc (see `docs/memory/decisions.md`, 2026-07-13).

## Status (verified 2026-07-13): the gate is GREEN

`pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass on a clean `pnpm install`. The gate went RED→GREEN this session; see `docs/memory/lessons-learned.md` (2026-07-13 entries) for the full root-cause writeup. Summary of what was fixed:

- **`pnpm lint`**: `next lint` was broken by two independent dependency drifts — `eslint` bumped `9.35.0 → 10.5.0` (PR #43), and `eslint-config-next` bumped `15.1.0 → 16.2.9` (a Next-16-targeted major, mismatched with this project's `next@15.5.19`) which also pulls in `eslint-plugin-react-hooks@7` (its new experimental rules — `set-state-in-effect`, `purity` — would fail on multiple pre-existing, unrelated components). Fix: pinned `eslint` back to `^9.35.0` and `eslint-config-next` to `15.5.19` (matching the installed `next` version, per Next's own version-pairing guidance). Kept `next lint` — the `eslint .` flat-config migration was tried but re-introduced the react-hooks v7 issue since eslint-config-next 16.x is flat-config-only; revisit that migration only alongside an actual Next 16 upgrade.
- **`pnpm typecheck`**: fixed duplicate component definitions in `components/paste-link.tsx`, `components/social-share.tsx`, `components/news-feed.tsx` (each had two full implementations concatenated in one file — a prior feature commit inserted a redesign without removing the old version; kept the newer/currently-wired version in each); replaced removed `lucide-react` brand icons (`Twitter`/`Facebook`/`Instagram`/`Linkedin`) with generic equivalents (`X`, `Globe`, `Camera`, `Briefcase`) across `quick-actions.tsx`, `share-panel.tsx`, `social-integrations.tsx`, `social-media-manager.tsx`, `social-share.tsx`; fixed the `prisma` default-vs-named import in `lib/ai-processing/processor.ts`/`save-result.ts`; added explicit parameter types to resolve implicit-`any` in `lib/admin/*`, `lib/digest.ts`, `lib/messaging/deliver.ts`, `lib/ranking-recalculate.ts`, and the Telegram webhook route; widened `ExperimentConfig` (`lib/growth/experiments.ts`) to include `description`/`startedAt`/`endedAt` (fields the real `GrowthExperiment` Prisma model has but the hand-maintained type didn't), removing the unsafe `as { startedAt: Date }` casts in `lib/admin/experiment-results.ts`; fixed a `rankArticles()` call passing a raw `string[]` where `RankingOptions` was expected (`app/api/news/feed/route.ts`); added the missing `components/ui/popover.tsx` primitive (+ `@radix-ui/react-popover` dependency) that `share-panel.tsx` already depended on.
- **`pnpm build`**: resolved once the duplicate-export typecheck issues above were fixed (same root cause).
- **Lockfile**: removed the stale, git-tracked npm-era `package-lock.json` (predates the `*-lock.json`/`*-lock.yaml` gitignore rule, so it was never actually excluded); committed a real `pnpm-lock.yaml`; narrowed `.gitignore` to ignore `package-lock.json`/`yarn.lock` by exact name instead of a blanket `*-lock.yaml` pattern that was also swallowing the pnpm lockfile CI needs for `pnpm install --frozen-lockfile`.

Two pre-existing, unrelated items were also fixed since they surfaced while getting the gate green: an `<a href="/">` in `app/s/[code]/client.tsx` that should have been `next/link`'s `<Link>` (real `@next/next/no-html-link-for-pages` lint error), and a `navigator`-narrowing TS quirk in `components/immersive/story-card.tsx` (`typeof navigator !== "undefined"` narrowed `navigator` to `never` in the fallthrough branch — changed the guard to `typeof window !== "undefined"`).

## What's enforced today (all blocking, via existing CI)

| Check | Command | Enforced in |
|---|---|---|
| Lint | `pnpm lint` (ESLint) | `.github/workflows/ci-cd.yml` → `lint` job |
| TypeScript | `pnpm typecheck` (`tsc --noEmit`) | `.github/workflows/ci-cd.yml` → `typecheck` job |
| Build | `pnpm build` (`next build`) | `.github/workflows/ci-cd.yml` → `build` job (needs lint+typecheck) |
| Static analysis | CodeQL (JS/TS, security-extended+quality) | `.github/workflows/security.yml` → `codeql` job |
| Dependency vulnerabilities | `pnpm audit --audit-level=high` (moderate in ci-cd.yml's own check) | `.github/workflows/security.yml` → `dependency-audit`; also `.github/workflows/ci-cd.yml` |
| Secret scanning | Gitleaks | `.github/workflows/security.yml` → `secret-scanning` job |
| Dependency review (PRs) | GitHub dependency-review-action, denies GPL/AGPL/LGPL | `.github/workflows/security.yml` → `dependency-review` job |
| Security headers | grep check on `next.config.ts` (warn-only) | `.github/workflows/security.yml` → `security-headers` job |
| Scheduled DAST | OWASP ZAP baseline scan | `.github/workflows/security.yml` → `owasp-zap` job (weekly cron only) |
| PR hygiene | size labeling, architecture heuristics (direct Prisma access outside `lib/`, oversized API routes, server env vars in `components/`), `console.log`/TODO/`any` counts | `.github/workflows/cto-review.yml` |

A change is mergeable when lint, typecheck, and build all pass, and `security.yml`'s blocking jobs (CodeQL, audit, secret scan, dependency review on PRs) are clean.

## Baseline rule

The baseline (what's required above) can only get **stricter over time, never looser**, without an explicit, reviewed decision recorded in `docs/memory/decisions.md`. `.github/CODEOWNERS` protects this file and the CI workflow files for that reason.

## What's NOT in the gate yet (known gap, not a silent omission)

- **No automated tests.** There is no Jest/Vitest/Playwright in this repo and no `test` script. `09-testing` (`.claude/agents/09-testing.agent.md`) is responsible for flagging this gap on any High/Critical change and proposing minimal coverage — but adding a full test framework is a baseline change requiring a `01-cto`-level decision, not something to do silently mid-task.
- **`any`/unused-vars are not actually linted** — `.eslintrc.json` currently disables `@typescript-eslint/no-explicit-any` and `no-unused-vars`, which contradicts the stated convention in `AGENTS.md`/`.github/copilot-instructions.md`. Tracked in `docs/memory/lessons-learned.md`.
- **`.lighthouserc.json` is orphaned** — present but not wired into any workflow. Either use it or remove it.

## Phase 2 (deferred, not built now)

Adopt only when the team/traffic justifies the added maintenance cost:

- Test framework (Jest/Vitest) + a coverage floor, wired as a blocking CI job.
- Code duplication check (e.g. `jscpd`) with a baseline threshold.
- Max-file-size guardrail (simple line-count script).
- A local pre-push hook (husky) running the fast subset of the gate before every push.
- Tighten `.eslintrc.json` to actually enforce `no-explicit-any`/`no-unused-vars`.

## Local usage

```
pnpm lint
pnpm typecheck
pnpm build
```

Run all three before considering a task done — never claim a passing gate without having actually run these commands in the current session (see `CLAUDE.md` § Validation Rules).
