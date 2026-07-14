# Task Template

Copy this into a new task spec (or use `/task-spec` to generate one) before starting non-trivial work. Keep it short — this is a working document, not ceremony.

```
## Objective
One sentence: what this task achieves and why.

## Background
Relevant context from docs/memory/*, the roadmap, or prior decisions.

## Scope
What will change.

## Out of Scope
What will explicitly NOT change.

## Target Files
Concrete file paths expected to be touched.

## Owning Agent(s)
Which .claude/agents/*.agent.md agent(s) should implement this.

## Acceptance Criteria
- [ ] ...

## Test Plan
How this will be validated (pnpm lint/typecheck/build, manual exercise).

## Risks
...
```

When done, add/update the corresponding row in `docs/manager/roadmap/ROADMAP.md`.
