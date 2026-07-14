# Daily Reports

One Markdown file per work day at `docs/manager/daily-reports/YYYY/MM/YYYY-MM-DD.md`, following `TEMPLATE.md`.

This is hand-maintained (or produced via the `/daily-close` Claude Code command), not auto-generated from git history — deliberately lean, see `docs/memory/decisions.md` (2026-07-13). If daily volume grows enough to justify it, a `git log`-driven generator script can be added later without changing this file's format.

## How to add today's entry

1. Create the folder if it doesn't exist: `docs/manager/daily-reports/<year>/<month>/`.
2. Copy `TEMPLATE.md` to `<year>/<month>/<YYYY-MM-DD>.md`.
3. Fill it in from `git log`/`git status` for the day, plus any decisions made.
4. Or just run `/daily-close` and let it do steps 1–3 for you — it will still ask you to confirm anything it can't verify from git alone.

Never fabricate completed work — if nothing shipped today, say so.
