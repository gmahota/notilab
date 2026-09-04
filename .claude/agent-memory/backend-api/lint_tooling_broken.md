---
name: lint-tooling-broken
description: pnpm lint (next lint) was broken repo-wide 2026-07-13 to ~2026-09; fixed by 2026-09-04 — verify current state before assuming it still fails
metadata:
  type: project
---

Between 2026-07-13 and some point before 2026-09-04, `pnpm lint` (`next lint`) failed on a clean `main` checkout with a "Converting circular structure to JSON" error from `.eslintrc.json`, caused by an ESLint v9→v10 bump colliding with the repo's legacy `.eslintrc.json` flat-config expectations.

**Status as of 2026-09-04: fixed.** `pnpm lint` now runs cleanly to completion, emitting only pre-existing `@typescript-eslint/no-explicit-any` / `no-unused-vars` warnings across various `components/` and `lib/` files — no crash. `.eslintrc.json` shows as locally modified in git status, consistent with someone having patched the config.

**Why this memory exists:** don't blindly cite the old "lint is broken" finding — it was true for about two months but is stale now. A prior version of this memory told future-me to skip running lint and just report the crash; that guidance is now wrong.

**How to apply:** Always actually run `pnpm lint` yourself and report the real output. If it fails again in the future, verify with `git stash` (stash your changes, run `pnpm lint`, `git stash pop`) to confirm the failure is pre-existing and not caused by your diff before reporting it as a tooling issue.
