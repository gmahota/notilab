---
name: worktree-breaks-lint-and-test
description: In .claude/worktrees/* checkouts, pnpm lint and pnpm test both fail for environmental reasons, not code reasons - with workarounds
metadata:
  type: project
---

Inside a worktree under `.claude/worktrees/<name>/`, two quality-gate commands fail
before they examine any code. Neither failure means the change under test is broken.

- `pnpm lint` dies with `Plugin "@next/next" was conflicted between ".eslintrc.json"
  and "..\..\..\.eslintrc.json"`. The worktree sits *inside* the main repo, so ESLint
  walks up and finds the repo root config too. Nothing is linted at all - it aborts
  during config resolution. Reproduce/confirm with `pnpm exec next lint --dir components`,
  which fails identically on files you never touched.
  Workaround that actually lints:
  `ESLINT_USE_FLAT_CONFIG=false pnpm exec eslint . --ext .ts,.tsx --no-eslintrc -c .eslintrc.json --ignore-pattern node_modules --ignore-pattern .next`
- `pnpm test` reports `No tests found` for *all* suites. `<rootDir>` interpolates to
  `C:/GMM/source/Tranning/notilab\.claude/worktrees/...` and the stray backslash before
  `.claude` breaks the testMatch glob.
  Workaround: `pnpm exec jest --testMatch "**/__tests__/**/*.test.ts"` (relative glob).

Also: the committed `.eslintrc.json` sets `no-explicit-any` and `no-unused-vars` to
`off`, but the main checkout at `C:\GMM\source\Tranning\notilab` has an UNCOMMITTED
local edit setting both to `warn`. That is where the frequently quoted "~76 pre-existing
warnings" number comes from (79 as of 2026-09-04); the committed config yields only
3 problems repo-wide. Two different baselines exist - say which one you measured.

**Why:** A whole verification pass can be wasted concluding a change broke lint or the
test suite when the worktree path is the actual cause, or reporting "lint clean" from a
command that silently linted nothing.

**How to apply:** In a worktree, run the workaround commands, and report both the
verbatim `pnpm lint` failure and the workaround result rather than claiming the gate
passed. `pnpm typecheck` and `pnpm build` are unaffected and trustworthy as-is.
