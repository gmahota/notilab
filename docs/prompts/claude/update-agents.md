# Agent Template Sync — Workflow Spec

This is a mechanical copy operation, not a rewrite. Do not summarize, rename, reformat, or "improve" the content while syncing — the templates below are the source of truth, and `.claude/agents/*.agent.md` are their exact active copies.

## Source → Target mapping

| Source (edit here) | Target (active copy) |
|---|---|
| `docs/prompts/claude/agents/00-orchestrator.agent.md` | `.claude/agents/00-orchestrator.agent.md` |
| `docs/prompts/claude/agents/01-cto.agent.md` | `.claude/agents/01-cto.agent.md` |
| `docs/prompts/claude/agents/02-editorial-content.agent.md` | `.claude/agents/02-editorial-content.agent.md` |
| `docs/prompts/claude/agents/03-frontend.agent.md` | `.claude/agents/03-frontend.agent.md` |
| `docs/prompts/claude/agents/04-backend-api.agent.md` | `.claude/agents/04-backend-api.agent.md` |
| `docs/prompts/claude/agents/05-database.agent.md` | `.claude/agents/05-database.agent.md` |
| `docs/prompts/claude/agents/06-integrations-social.agent.md` | `.claude/agents/06-integrations-social.agent.md` |
| `docs/prompts/claude/agents/07-ai-pipeline.agent.md` | `.claude/agents/07-ai-pipeline.agent.md` |
| `docs/prompts/claude/agents/08-security.agent.md` | `.claude/agents/08-security.agent.md` |
| `docs/prompts/claude/agents/09-testing.agent.md` | `.claude/agents/09-testing.agent.md` |
| `docs/prompts/claude/agents/10-docs-memory.agent.md` | `.claude/agents/10-docs-memory.agent.md` |

## Rules

- **Do not** rewrite, summarize, or rename files during sync — copy byte-for-byte.
- **Do not** change YAML frontmatter (`name`, `description`, `tools`, `model`, `effort`, `permissionMode`, `memory`, `color`, `maxTurns`) unless that's the actual intent of the edit you're syncing.
- **Do not** run destructive commands as part of this workflow (no `rm -rf`, no `git clean`, no force-push). This is a copy, not a reset.
- If a target file exists but has diverged from its source (hand-edited directly in `.claude/agents/`), that's a bug — the edit should have gone into the `docs/prompts/claude/agents/` source first. Report the divergence; do not silently overwrite without flagging it.

## How to run it

```
pnpm agents:sync
```

This runs `scripts/agents/sync-claude-agents.mjs`, which copies each mapped file and reports missing/updated files, exiting non-zero if any source file is missing.

## Report format

```
## Agent Sync Report
- Updated: [...]
- Unchanged: [...]
- Missing source: [...] (should be empty)
```
