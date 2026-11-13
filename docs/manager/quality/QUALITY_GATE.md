# Quality Gate

This documents what "passing the gate" means for NotiLab today. It is deliberately scoped to what is already enforced — no new third-party tooling has been introduced to write it (see `docs/memory/decisions.md`, 2026-07-13, and `AGENTS.md` § Dependency Policy).

> **Read this first.** An earlier revision of this file described the gate as GREEN, and it was: every check that existed passed. Two live security defects were in `main` at the same time — a broken-access-control family across the `/api/user` endpoints, and hardcoded staff credentials in `app/api/admin/auth/route.ts`. Neither was a tool misfiring. **A green gate has never meant "this code is secure"; it means "the specific checks listed below did not fail."** Everything in this document is now labelled with what it actually enforces, because the previous revision's own inaccuracies were part of how those defects stayed invisible. See § What the gate does not cover.

## Status (last verified 2026-09-04)

Verified by running the commands in this session, not inferred:

| Command | Result |
|---|---|
| `pnpm lint` | passes (1 pre-existing `no-img-element` warning in `app/s/[code]/client.tsx`) |
| `pnpm typecheck` | passes, no output |
| `pnpm test` | passes — 12 suites, 185 tests |
| `pnpm build` | passes |
| `pnpm check:authorization` | passes — 38 routes, 14 authorized, 15 declared public, 9 known violations (at cap) |
| `pnpm check:secrets` | passes — 7 findings, all 7 matched by 3 tracked allowlist entries |

The last two commands are new in this revision, and the last one passes **only because both live defects are recorded as tracked exceptions**. That is the honest state: the scanner now detects them, and their exemptions are counted and capped so they can only be removed, never quietly extended.

Run everything at once with `pnpm gate`.

## What is enforced, and how strongly

The previous revision headed this table "all blocking, via existing CI". That was wrong for four of its ten rows. Enforcement level is now stated per row.

| Check | Command / mechanism | Where | Enforcement |
|---|---|---|---|
| Lint | `pnpm lint` (ESLint) | `ci-cd.yml` → `lint` | **Blocking** |
| TypeScript | `pnpm typecheck` (`tsc --noEmit`) | `ci-cd.yml` → `typecheck` | **Blocking** |
| Unit tests | `pnpm exec jest --ci` | `ci-cd.yml` → `test` | **Blocking** (new — see § Changes in this revision) |
| Build | `pnpm build` | `ci-cd.yml` → `build` (needs lint + typecheck + test) | **Blocking** |
| Route authorization manifest | `node scripts/quality/check-route-authorization.mjs` | `security.yml` → `route-authorization` | **Blocking** (new) |
| Hardcoded secrets | `node scripts/quality/check-hardcoded-secrets.mjs` | `security.yml` → `hardcoded-secrets` | **Blocking** (new — replaces a check that could not fail) |
| Dependency vulnerabilities | `pnpm audit --audit-level=high` | `security.yml` → `dependency-audit` | **Blocking** |
| Secret scanning | Gitleaks | `security.yml` → `secret-scanning` | **Blocking** |
| Dependency review (PRs) | `dependency-review-action`, denies GPL/AGPL/LGPL | `security.yml` → `dependency-review` | **Blocking on PRs only** |
| Static analysis | CodeQL (`security-extended`, `security-and-quality`) | `security.yml` → `codeql` | **NOT blocking** — see below |
| Security headers | grep over `next.config.ts` | `security.yml` → `security-headers` | **Warn only** (`::warning::`, never fails) |
| Oversized API routes | route files over 120 lines | `cto-review.yml` → `architecture-review` | **Warn only** |
| Prisma layering | no `PrismaClient` outside `lib/` | `cto-review.yml` → `architecture-review` | **Blocking** |
| `console.log` / TODO / `any` counts | grep counts posted as a PR comment | `cto-review.yml` → `code-quality` | **Reporting only** — no threshold fails the job |
| PR size label | file/line count | `cto-review.yml` → `pr-size-check` | **Reporting only** |
| Bundle size | `du` over `.next/` | `cto-review.yml` → `bundle-analysis` | **Reporting only** — printed, never compared to a budget |
| Scheduled DAST | OWASP ZAP baseline | `security.yml` → `owasp-zap` | **Non-blocking**, weekly cron only (`fail_action: false`) |

### CodeQL is not a blocking check

`github/codeql-action/analyze@v3` has no `fail-on` input. It uploads results to GitHub code scanning and **exits 0 regardless of what it finds**. A green tick on that job means "analysis completed", not "no alerts". Making an alert block a merge requires enabling the code-scanning rule under branch protection — a repository setting that does not live in this repo and cannot be verified from it.

The previous revision listed CodeQL as blocking. It was not, and this correction does not change the outcome for the defects at hand: see § What the gate does not cover.

### "Blocking" means the job fails, not that the merge is stopped

Every "blocking" above means the CI job exits non-zero. Whether that actually prevents a merge is a **branch-protection setting** in repository settings — not something any file in this repo can assert. This document deliberately does not claim otherwise.

## What the gate does not cover

Three distinct categories. Conflating them is how the previous revision overstated its coverage.

### (a) Defects no tool can find

**Broken access control (OWASP A01) is the absence of a check, and absence has no syntactic signature.** No SAST tool — CodeQL included — flags `app/api/user/route.ts` for trusting a client-supplied `userId`, because nothing in the source says that endpoint was meant to be authenticated. `prisma.user.findUnique({ where: { id: userId } })` is identical code whether `userId` came from a verified session or a query string. The missing information is *intent*, and intent is not in the file.

This is not a tool failing. It is a category of defect that automated analysis cannot decide, and the honest response is to record intent somewhere a machine can check it — which is what `scripts/quality/authorization-manifest.json` now does. The manifest does not detect vulnerabilities; it makes an *undeclared* route a hard failure, so "forgot the check" becomes a reviewable diff instead of silence.

### (b) Defects a tool could find, but the configuration missed

The hardcoded-credential defect was in this category, and the miss was total:

```
password\s*=\s*['"][^'"]{8,}|api_key\s*=\s*['"][^'"]{10,}|secret\s*=\s*['"][^'"]{8,}
```

Run over `app/ lib/ components/`, this returned **zero matches** on a tree containing three admin accounts sharing the published bcrypt test-vector hash for `password`, plus `JWT_SECRET` falling back to the literal `"your-secret-key"`. Two independent reasons:

1. It required `password =`. The vulnerable code writes `password:` — an object property. One character of syntax defeated it.
2. It required the literal to follow the operator directly. The JWT fallback is `process.env.JWT_SECRET || "your-secret-key"`, so what follows `SECRET =` is `p`, not a quote.

It also sat in a job gated `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, so **it never ran on a pull request at all** — it could not have blocked the merge that introduced the code even had the pattern worked. Its `grep -v placeholder` filter would additionally have discarded `"your-secret-key"` on sight.

Both problems are fixed (§ Changes in this revision). The lesson generalises: **a check that has never been observed to fail is not known to work.** Every enforcement script under `scripts/quality/` is runnable locally for exactly this reason, and was proven against known-bad input before being made blocking.

### (c) Defects the gate finds but only warns about

`app/api/user/route.ts` is 175 lines, over the 120-line threshold in `cto-review.yml` → `architecture-review`. That check **did** fire on this file. It emits `::warning::` and the step ends `echo "✅ API route check complete"`, so the job passes.

The warning was also the wrong signal: it says "consider extracting logic to `lib/`", which is an architecture hint, not a security finding. A file can be 40 lines and still be a perfect IDOR. Route length was never going to catch this, and it is left warn-only deliberately — raising it to blocking would fail on pre-existing files while still not detecting the defect class.

`console.log`, TODO and `any` counts are in the same category, one step weaker: they are posted as a PR comment and no count fails anything.

### (d) Claims this document made that were not enforced

Recorded rather than quietly edited away, because the inaccuracies were themselves part of the failure:

| Previous claim | Reality |
|---|---|
| "What's enforced today (**all blocking**, via existing CI)" | Four of ten rows were warn-only or reporting-only; CodeQL was non-blocking. |
| CodeQL listed as blocking | `analyze@v3` has no `fail-on` and exits 0 regardless of alerts. |
| "Dependency vulnerabilities … (moderate in `ci-cd.yml`'s own check)" | `ci-cd.yml` contains **no** audit step. The only audit is `security.yml` → `dependency-audit`. |
| "**No automated tests.** There is no Jest/Vitest/Playwright in this repo and no `test` script." | False since the Jest suite landed. `package.json` has had `"test": "jest"` and the suite passed — while being wired into **no** workflow, so CI never ran it. The doc understated coverage and overstated enforcement at the same time. |
| Secret scanning described as covering hardcoded secrets in source | The inline grep could not match the code that was there, and did not run on PRs. Gitleaks (a separate, genuinely blocking job) targets committed credentials in git history, not source-literal patterns like these. |
| CODEOWNERS framed as review protection | With one owner who is also the author, GitHub requests no review and counts no approval. See the note at the top of `.github/CODEOWNERS`. |

## Changes in this revision (2026-09-04)

All are strictness increases, permitted under § Baseline rule.

1. **`pnpm test` is now blocking** — new `test` job in `ci-cd.yml`; `build` now needs it. `--passWithNoTests` is deliberately not set, so a config change that stops matching test files fails the job instead of reporting a green "0 tests" run.
2. **The hardcoded-secret check was rewritten** as `scripts/quality/check-hardcoded-secrets.mjs`, moved into its own always-running `hardcoded-secrets` job, and now detects object-property syntax, `process.env.X || "literal"` fallbacks, bcrypt digests and private-key blocks. It has no "benign value" filter — exemptions go in a counted allowlist, not a regex.
3. **A route authorization manifest was added** — `scripts/quality/authorization-manifest.json`, enforced by `check-route-authorization.mjs` in a blocking `route-authorization` job.
4. **`security.yml` now runs on PRs to `develop`** as well as `main`, and the `security-headers` job lost its push-to-main-only gate.
5. **`lib/admin-auth.ts` gained specs** — `__tests__/lib/admin-auth.test.ts`, 21 tests covering role gating, signature/expiry/`alg:none` rejection, and two that document the `JWT_SECRET` fallback by demonstrating a forged `SUPER_ADMIN` token being accepted. Those two are marked `FIXME(ROADMAP #23)` and are expected to invert when the defect is fixed.
6. **CODEOWNERS covers `app/api/**/route.ts`, `app/api/user/`, `app/api/growth/` and `scripts/quality/`**, and now states plainly what single-owner ownership cannot do.
7. **`jest.config.mjs` `testMatch` is relative, not `<rootDir>`-prefixed.** Interpolating `rootDir` into a glob breaks when the absolute path contains a backslash or a dot-segment: in a Windows git worktree the pattern became `…notilab\.claude/…`, micromatch read `\.` as an escaped dot, and Jest reported "0 matches" for 11 suites that were present. Directly relevant to making `pnpm test` blocking — combined with `--passWithNoTests` this would have been a permanently green job that ran nothing.
8. **`.eslintrc.json` sets `"root": true`**, so `pnpm lint` no longer fails with a plugin conflict when the repo is checked out beneath another ESLint config (as in a `.claude/worktrees/` worktree). No effect on a clean CI checkout.
9. **This directory was renamed** `docs/manager/qualidade/` → `docs/manager/quality/`, with all ten references updated including `.github/CODEOWNERS` and the agent templates.

### The two ratchets

`authorization-manifest.json` and `secret-allowlist.json` each carry a cap (`maxKnownViolations`, `maxEntries`) set to the current count. They exist so unrelated PRs are not blocked by pre-existing defects — **not** to make those defects acceptable. Both scripts fail if a list exceeds its cap, if an entry is stale, if an entry lacks a reason or a `trackedIn`, or if an entry names something no longer detected. Lists can only shrink; growing one is a baseline change under § Baseline rule.

The route checker additionally refuses to let the routes that matter be waved through: anything under `app/api/user/`, `app/api/admin/`, `app/api/growth/`, `app/api/cron/` or `app/api/ai/` **cannot** be declared public, except `admin/auth` and `admin/logout` via a flag whose permitted paths are hardcoded in the script. It also rejects an authorization call with no reachable 401/403, so a dangling `await checkAdminAuth()` does not satisfy it. Each of these was exercised against a deliberately-broken tree before the job was made blocking.

## Baseline rule

The baseline can only get **stricter over time, never looser**, without an explicit, reviewed decision recorded in `docs/memory/decisions.md`. `.github/CODEOWNERS` protects this file, the workflow files and `scripts/quality/` for that reason — with the caveat above about what single-owner CODEOWNERS actually achieves.

## Still not in the gate (known gaps, not silent omissions)

- **No integration or end-to-end tests.** The 12 Jest suites are unit-level and cover `lib/` modules plus two route handlers. Nothing exercises a request end-to-end against a database, so an authorization regression in a route with no unit test would still pass.
- **The authorization manifest checks declaration, not correctness.** A route can call `checkAdminAuth()`, return 403, and still authorize the wrong user. The manifest guarantees a posture was *recorded*, never that it is right. Only review and tests do that.
- **`any` and unused vars are not linted** — `.eslintrc.json` disables `@typescript-eslint/no-explicit-any` and `no-unused-vars`, contradicting `AGENTS.md`. `cto-review.yml` counts `any` usages but fails on no threshold.
- **`.lighthouserc.json` is orphaned** — present, referenced by no workflow. Use it or delete it.
- **No privilege separation among admin roles.** `checkAdminAuth()` returns a user for any of the seven roles and no route narrows further, so a `REDATOR` token authorises `app/api/admin/experiments` and `app/api/ai/generate-news`. The authorization manifest counts these routes as authorized — correctly, since they *do* check — which is exactly the manifest's stated limit: it verifies a posture was recorded, not that the posture is right. Roadmap #26.
- **No rate limiting anywhere.** Several unauthenticated endpoints call paid LLM providers (`app/api/ai/explain`, `app/api/news/summarize-link`, `app/api/chat`). Recorded in the manifest; no check enforces it.
- **Whether CI blocks a merge is branch protection**, unverifiable from this repo.

## Phase 2 (deferred)

Adopt when team size or traffic justifies the maintenance cost:

- A coverage floor on the existing Jest suite.
- Integration tests against a throwaway Postgres, so authorization can be asserted end-to-end.
- Code duplication check (e.g. `jscpd`) with a baseline threshold.
- A local pre-push hook (husky) running the fast subset of the gate.
- Tighten `.eslintrc.json` to actually enforce `no-explicit-any` / `no-unused-vars`.
- A bundle-size *budget*, so `bundle-analysis` can fail rather than only print.

## Local usage

```
pnpm gate
```

That runs `lint → typecheck → test → check:authorization → check:secrets → build`. The individual commands:

```
pnpm lint
pnpm typecheck
pnpm test
pnpm check:authorization
pnpm check:secrets
pnpm build
```

Run these before considering a task done, and never claim a passing gate without having actually run them in the current session (`CLAUDE.md` § Validation Rules). Note what the top of this document says: passing them is a floor, not a security assurance.
