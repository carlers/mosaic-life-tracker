#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const authoritativeFiles = [
  'README.md',
  'AGENTS.md',
  'PLAN.md',
  'SESSION_STATE.md',
  'docs/PROJECT_REFERENCE.md',
  'docs/CODEX_WORKFLOW.md',
  'docs/WEB_CHAT_WORKFLOW.md',
  'docs/TEST_WORKFLOW.md',
  'docs/WORKFLOW_TELEMETRY.md',
  'docs/BUNDLE_AUDIT.md',
];

const requiredContractPointers = [
  ['README.md', 'AGENTS.md'],
  ['README.md', 'PLAN.md'],
  ['README.md', 'SESSION_STATE.md'],
  ['AGENTS.md', 'docs/PROJECT_REFERENCE.md'],
  ['AGENTS.md', 'docs/CODEX_WORKFLOW.md'],
  ['AGENTS.md', 'docs/WEB_CHAT_WORKFLOW.md'],
  ['AGENTS.md', 'docs/WORKFLOW_TELEMETRY.md'],
  ['AGENTS.md', 'PLAN.md'],
  ['AGENTS.md', 'SESSION_STATE.md'],
];

function projectPath(absolutePath) {
  return relative(root, absolutePath).replaceAll('\\', '/');
}

function localMarkdownTargets(markdown, sourcePath) {
  const targets = [];
  const pattern = /\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    const raw = match[1].trim();
    if (
      raw === '' ||
      raw.startsWith('#') ||
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('mailto:')
    ) {
      continue;
    }

    const withoutTitle = raw.replace(/\s+["'][^"']*["']$/, '');
    const decoded = decodeURIComponent(withoutTitle.split('#')[0]);
    targets.push(resolve(dirname(sourcePath), decoded));
  }
  return targets;
}

const errors = [];

for (const file of authoritativeFiles) {
  const absolute = resolve(root, file);
  if (!existsSync(absolute)) {
    errors.push(`Missing authoritative project file: ${file}`);
    continue;
  }

  if (!file.endsWith('.md')) continue;
  const markdown = readFileSync(absolute, 'utf8');
  for (const target of localMarkdownTargets(markdown, absolute)) {
    if (!existsSync(target)) {
      errors.push(
        `${file}: local Markdown link target does not exist: ${projectPath(target)}`
      );
    }
  }
}

for (const [source, requiredTarget] of requiredContractPointers) {
  const absolute = resolve(root, source);
  if (!existsSync(absolute)) continue;
  const contents = readFileSync(absolute, 'utf8');
  if (!contents.includes(requiredTarget)) {
    errors.push(`${source}: missing required contract pointer to ${requiredTarget}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log(
    `Project contracts passed: ${authoritativeFiles.length} authoritative files and local references are discoverable.`
  );
}
