#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyToClipboard } from './clipboard.mjs';
import {
  buildDeepSeekPacket,
  estimateTokens,
  HANDOFF_TARGETS,
  HANDOFF_TOKEN_WARNING,
  parseWorkingSet,
  promptForTarget,
  resolveWorkingSet,
  validateSessionState,
} from './lib/create-handoff.mjs';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const [target, ...extraPaths] = process.argv.slice(2);

if (!target) {
  console.error(`Usage: npm run handoff -- <${HANDOFF_TARGETS.join('|')}> [extra paths...]`);
  process.exit(1);
}

try {
  const prompt = promptForTarget(target);
  const sessionState = readFileSync(join(projectRoot, 'SESSION_STATE.md'), 'utf8');
  validateSessionState(sessionState);

  if (target === 'codex') {
    const copied = copyToClipboard(prompt);
    console.log(prompt);
    console.log(copied ? 'Copied prompt to clipboard.' : 'Clipboard unavailable; copy the prompt above.');
    process.exit(0);
  }

  const workingSet = resolveWorkingSet(
    projectRoot,
    parseWorkingSet(sessionState),
    extraPaths
  );
  const git = (args) =>
    execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trimEnd();
  const selectedDiff = (args) =>
    workingSet.length > 0 ? git([...args, '--', ...workingSet]) : '';
  const packet = buildDeepSeekPacket({
    target,
    projectRoot,
    sessionState,
    plan: readFileSync(join(projectRoot, 'PLAN.md'), 'utf8'),
    agents: readFileSync(join(projectRoot, 'AGENTS.md'), 'utf8'),
    legacyWorkflow: readFileSync(join(projectRoot, 'docs/LEGACY_WORKFLOW.md'), 'utf8'),
    workingSet,
    git: {
      branch: git(['branch', '--show-current']),
      head: git(['rev-parse', '--short', 'HEAD']),
      status: git(['status', '--short', '--', '.']),
      unstagedDiff: selectedDiff(['diff', '--no-ext-diff']),
      stagedDiff: selectedDiff(['diff', '--cached', '--no-ext-diff']),
    },
  });
  const outputPath = join(projectRoot, '.mosaic-handoff.md');
  writeFileSync(outputPath, packet);
  const tokens = estimateTokens(packet);
  const copied = copyToClipboard(packet);

  console.log(`Wrote .mosaic-handoff.md (${packet.length.toLocaleString()} characters, approximately ${tokens.toLocaleString()} tokens).`);
  console.log(`Working files: ${workingSet.length > 0 ? workingSet.join(', ') : 'none'}`);
  if (tokens > HANDOFF_TOKEN_WARNING) {
    console.warn(`Warning: packet exceeds the ${HANDOFF_TOKEN_WARNING.toLocaleString()}-token target. Reduce the working set if the omitted files are not required.`);
  }
  console.log(copied ? 'Copied packet to clipboard.' : 'Clipboard unavailable; attach .mosaic-handoff.md.');
  console.log(`Start the new chat with: ${prompt}`);
} catch (error) {
  console.error(`Handoff failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
