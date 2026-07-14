Implement a change with strict scope control.

1. Read `AGENTS.md` and `CLAUDE.md` first. Check `docs/memory/*` for constraints on the area being touched.
2. Do not expand scope beyond what was asked — if you notice something else that should change, name it as a follow-up, don't fold it in.
3. If the change is repeated across multiple modules/files of the same kind (e.g. the same fix in 5 API routes), implement it in **one reference module first**, then stop and report before rolling out to the rest.
4. Write an Execution Plan before making any edits.
5. After implementing, write a completion report.

Execution Plan (before editing):

```
## Execution Plan
Goal: ...
Target files: ...
Out of scope: ...
Reference module (if repeated change): ...
```

Completion report (after editing):

```
## Completed
...

## Files Changed
- ...

## Validation
- pnpm lint: ...
- pnpm typecheck: ...
- pnpm build (if relevant): ...
- Manual test: ...

## Risks
...

## Next Step
(e.g. "apply the same fix to the remaining N modules once this one is approved")
```
