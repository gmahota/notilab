---
name: lint-tooling-broken
description: pnpm lint (next lint) fails repo-wide with a circular JSON error, unrelated to any specific diff
metadata:
  type: project
---

As of 2026-07-13, `pnpm lint` (which runs `next lint`) fails on a clean `main` checkout with:

```
Converting circular structure to JSON
    --> starting at object with constructor 'Object'
    ...
    --- property 'react' closes the circle
Referenced from: C:\GMM\source\Tranning\notilab\.eslintrc.json
```

**Why:** Recent dependabot bumps (`eslint 9.35.0 -> 10.5.0`, `eslint-config-next -> 16.2.9`, see commits `822d820`, `33ea38f`) introduced an incompatibility between ESLint v10's flat-config expectations and the repo's legacy `.eslintrc.json`. `next lint` is also flagged as deprecated in Next 16 and recommends migrating to the ESLint CLI directly (`npx @next/codemod@canary next-lint-to-eslint-cli .`).

**How to apply:** Before reporting a lint failure as caused by your own change, verify with `git stash` (stash working changes, run `pnpm lint`, then `git stash pop`) to confirm the failure reproduces on the pre-existing tree. If it does, report it as a pre-existing/unrelated tooling issue rather than trying to fix ESLint config yourself (config migration is a bigger, cross-cutting task outside a single feature's scope — flag it to 01-cto/05-database-adjacent owners instead of silently fixing or silently ignoring).
