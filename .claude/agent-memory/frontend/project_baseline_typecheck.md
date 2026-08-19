---
name: project-baseline-typecheck
description: pnpm typecheck has pre-existing unrelated failures on main — know the baseline before blaming new work
metadata:
  type: project
---

As of 2026-07-15 (commit f2d9136), `pnpm typecheck` fails on `main` with errors unrelated to `app/**`/`components/**` UI work:
- `components/share-panel.tsx` — missing `@/components/ui/popover` module (shadcn primitive never added/exported).
- `lib/admin/experiment-results.ts` and `lib/growth/experiments.ts` — Prisma `JsonValue` not narrowed to the app's expected `Record<string, ...>` shapes (`variants`, `meta` fields).

**Why:** confirmed via `git stash -u` + rerun that these errors exist independent of any in-progress frontend change, so they are not something a frontend task introduced.

**How to apply:** when `pnpm typecheck` fails during a frontend task, check whether the failing file paths are ones you touched. If not, and they match the list above (or errors in `components/share-panel.tsx`, `lib/admin/experiment-results.ts`, `lib/growth/experiments.ts`), report them as pre-existing rather than treating them as regressions to fix. `pnpm lint` (`next lint`), by contrast, currently runs cleanly (deprecated-command warning only, one unrelated `no-img-element` warning in `app/s/[code]/client.tsx`) — it is *not* broken, so don't skip it by default; only skip if a future check reconfirms it's broken.
