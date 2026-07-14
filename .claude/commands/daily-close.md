Produce an end-of-day summary for today's work.

1. Read `AGENTS.md`, `CLAUDE.md`, and `docs/memory/decisions.md` / `docs/memory/lessons-learned.md`.
2. Run `git log --since=midnight --oneline` (or ask for the relevant date range) and `git status` to see what actually changed today.
3. Never fabricate completed work, and never claim a test/build passed without having run it this session.
4. Write the report to `docs/manager/daily-reports/YYYY/MM/YYYY-MM-DD.md` following `docs/manager/daily-reports/TEMPLATE.md`, creating the date folders if needed.
5. Separate observed facts (from git) from assumptions (e.g. "commit message says X was done" is not the same as "I verified X works").

Output the same content you write to the file:

```
## Overview
Date / Branch / Author

## Completed
(from git log + session context)

## Decisions
(anything durable enough for docs/memory/decisions.md — cross-reference if you also updated it there)

## Files Changed / Areas
...

## Validation Run
(what was actually executed and its result)

## Risks / Blockers
...

## Next Actions
...
```
