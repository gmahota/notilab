---
name: "source-command-task-spec"
description: "Migrated source command `task-spec`"
---

# source-command-task-spec

Use this skill when the user asks to run the migrated source command `task-spec`.

## Command Template

Turn the user's request into an execution-ready Task Spec. Do not edit files or implement code in this command — output the spec only.

Read `AGENTS.md` and `AGENTS.md` first. Check `docs/memory/*` and `docs/manager/roadmap/ROADMAP.md` for related context before writing the spec.

Produce the spec using `docs/manager/roadmap/TASK_TEMPLATE.md` as the shape:

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

## Functional & UI Requirements
(if applicable)

## Technical Requirements
(if applicable)

## Owning Agent(s)
Which .Codex/agents/*.agent.md agent(s) should implement this, per AGENTS.md § Agent Routing Rules.

## Acceptance Criteria
- [ ] ...

## Test Plan
How this will be validated (pnpm lint/typecheck/build, manual exercise — see docs/manager/quality/QUALITY_GATE.md).

## Risks
...
```
