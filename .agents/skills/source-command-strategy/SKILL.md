---
name: "source-command-strategy"
description: "Migrated source command `strategy`"
---

# source-command-strategy

Use this skill when the user asks to run the migrated source command `strategy`.

## Command Template

Produce a CTO-style pre-implementation analysis for an architecturally significant change. Do not edit files in this command.

This is effectively an inline invocation of the `01-cto` agent's role (see `.Codex/agents/01-cto.agent.md`). Read `AGENTS.md`, `AGENTS.md`, and `docs/memory/architecture.md` / `docs/memory/decisions.md` first.

Output:

```
## Goal
...

## Current State
...

## Problem
...

## Proposed Strategy
...

## Scope / Out of Scope
...

## Affected Areas
Which agents/domains this touches (frontend, backend-api, database, integrations-social, ai-pipeline, security).

## Implementation Sequence
Phased, with a reference-module-first rollout for anything repeated across modules.

## Risks
...

## Acceptance Criteria
- [ ] ...

## Recommendation
...
```
