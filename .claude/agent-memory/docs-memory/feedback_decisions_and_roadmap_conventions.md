---
name: feedback-decisions-and-roadmap-conventions
description: How to append to docs/memory/decisions.md and docs/manager/roadmap/ROADMAP.md correctly for this repo
metadata:
  type: feedback
---

When recording a shipped feature/decision in this repo, follow the exact existing format rather than improvising:

- `docs/memory/decisions.md` is append-only, dated `## YYYY-MM-DD — Title` sections, each decision as a `- **Decision**: ...` bullet. Never edit/delete prior entries — if something is superseded, add a new bullet/section saying so explicitly.
- `docs/manager/roadmap/ROADMAP.md` uses numbered table rows (`| # | Status | Task | Area | Depends on | Blocks |`) continuing the global numbering sequence across sections, status enum is `planned`/`in_progress`/`done`/`blocked` only. New initiatives get a new `## Section Name — YYYY-MM-DD` heading with a short context blurb above the table, matching the style of "Editorial Pivot — 2026-07-14".
- Daily reports live at `docs/manager/daily-reports/YYYY/MM/YYYY-MM-DD.md`, copied from `TEMPLATE.md` (Overview/Completed/Decisions/Files Changed/Validation Run/Risks/Next Actions) — the folder is not auto-created, check with `ls`/`Glob` before writing.

**Why**: `docs/memory/*` and the roadmap are hand-maintained by design (see the repo's own 2026-07-13 decision to defer generator scripts) — deviating from the established format creates drift that future sessions (including this one) will have to reconcile.

**How to apply**: Before writing any memory/roadmap/daily-report entry in this repo, read the target file first to confirm the current format hasn't changed, then match it exactly rather than inventing a new structure.
