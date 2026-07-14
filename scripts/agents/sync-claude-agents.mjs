#!/usr/bin/env node
// Copies agent template files from docs/prompts/claude/agents/ into .claude/agents/.
// Source of truth lives under docs/prompts/claude/agents/ — never hand-edit the
// .claude/agents/ copies directly. See docs/prompts/claude/update-agents.md.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

const SOURCE_DIR = join(repoRoot, 'docs', 'prompts', 'claude', 'agents');
const TARGET_DIR = join(repoRoot, '.claude', 'agents');

const AGENT_FILES = [
  '00-orchestrator.agent.md',
  '01-cto.agent.md',
  '02-editorial-content.agent.md',
  '03-frontend.agent.md',
  '04-backend-api.agent.md',
  '05-database.agent.md',
  '06-integrations-social.agent.md',
  '07-ai-pipeline.agent.md',
  '08-security.agent.md',
  '09-testing.agent.md',
  '10-docs-memory.agent.md',
];

const updated = [];
const unchanged = [];
const missingSource = [];

mkdirSync(TARGET_DIR, { recursive: true });

for (const file of AGENT_FILES) {
  const sourcePath = join(SOURCE_DIR, file);
  const targetPath = join(TARGET_DIR, file);

  if (!existsSync(sourcePath)) {
    missingSource.push(file);
    continue;
  }

  const sourceContent = readFileSync(sourcePath, 'utf8');
  const targetContent = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : null;

  if (targetContent === sourceContent) {
    unchanged.push(file);
  } else {
    writeFileSync(targetPath, sourceContent, 'utf8');
    updated.push(file);
  }
}

console.log('## Agent Sync Report');
console.log(`- Updated: ${updated.length ? updated.join(', ') : '(none)'}`);
console.log(`- Unchanged: ${unchanged.length ? unchanged.join(', ') : '(none)'}`);
console.log(`- Missing source: ${missingSource.length ? missingSource.join(', ') : '(none)'}`);

if (missingSource.length > 0) {
  console.error(`\nError: ${missingSource.length} agent template file(s) missing from ${SOURCE_DIR}`);
  process.exit(1);
}
