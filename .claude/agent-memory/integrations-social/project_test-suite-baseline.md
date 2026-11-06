---
name: test-suite-baseline
description: pnpm test is not fully green on this machine — 3 pre-existing failures in __tests__/lib/mcp/server.test.ts unrelated to ingestion work
metadata:
  type: project
---

`pnpm test` reports 3 failing tests in `__tests__/lib/mcp/server.test.ts`
("refuses a key shorter than 32 characters", "does not fall back to the Agent
API credential", and one sibling): they expect HTTP 503 and get 401. Verified
2026-11-06 as pre-existing by stashing all ingestion changes and re-running —
the failures persist on untouched sources.

**Why:** the MCP auth tests assert on the absence of credentials, and
`next/jest` loads the repo `.env` the way `next build` does, so what is set
locally changes the outcome. Nothing in `lib/ingestion/**` is in that module's
import graph.

**How to apply:** when a task in `lib/ingestion/`, `lib/messaging/` or
`app/api/cron/**` ends with "3 failed, N passed", that is the baseline, not a
regression. Confirm with `pnpm test -- __tests__/lib/ingestion` (or the suite
you touched) being green, and state the baseline explicitly in the report
rather than claiming the whole suite is green. Re-check the baseline before
trusting this note — the MCP owner may have fixed it.
