#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyToClipboard } from './clipboard.mjs';
import {
  buildWebChatPacket,
  estimateTokens,
  HANDOFF_TARGETS,
  HANDOFF_TOKEN_WARNING,
  normalizeHandoffTarget,
  parseWorkingSet,
  promptForTarget,
  resolveWorkingSet,
  validateSessionState,
} from './lib/create-handoff.mjs';
import {
  appendEvent,
  createEvent,
  formatRunLine,
  latestTaskSummary,
  readEvents,
} from './lib/workflow-metrics.mjs';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const stdout = args.includes('--stdout');
const positional = args.filter((arg) => arg !== '--stdout');
const [requestedTarget, ...extraPaths] = positional;

function recordHandoff(target) {
  const metricsPath = join(projectRoot, '.mosaic/metrics/events.jsonl');
  if (!existsSync(metricsPath)) return null;
  try {
    const events = readEvents(metricsPath);
    const active = latestTaskSummary(events);
    if (!active) return null;
    appendEvent(metricsPath, createEvent('handoff_recorded', {
      taskId: active.taskId,
      target,
    }));
    return formatRunLine(latestTaskSummary(readEvents(metricsPath)));
  } catch (error) {
    console.warn(`Telemetry unavailable; continuing handoff: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

if (!requestedTarget) {
  console.error(`Usage: npm run handoff -- <${HANDOFF_TARGETS.join('|')}> [--stdout] [extra paths...]`);
  process.exit(1);
}

try {
  const { target, alias } = normalizeHandoffTarget(requestedTarget);
  const prompt = promptForTarget(target);
  const sessionState = readFileSync(join(projectRoot, 'SESSION_STATE.md'), 'utf8');
  validateSessionState(sessionState);

  if (alias) {
    console.warn(`Handoff target "${alias}" is an alias; prefer "${target}".`);
  }
  const metricsSummary = recordHandoff(target);

  if (target === 'agent') {
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
  const packet = buildWebChatPacket({
    target,
    projectRoot,
    sessionState,
    plan: readFileSync(join(projectRoot, 'PLAN.md'), 'utf8'),
    agents: readFileSync(join(projectRoot, 'AGENTS.md'), 'utf8'),
    webChatWorkflow: readFileSync(join(projectRoot, 'docs/WEB_CHAT_WORKFLOW.md'), 'utf8'),
    workingSet,
    metricsSummary,
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
  const copied = stdout ? false : copyToClipboard(packet);

  if (stdout) console.log(packet);
  console.log(`Wrote .mosaic-handoff.md (${packet.length.toLocaleString()} characters, approximately ${tokens.toLocaleString()} tokens).`);
  console.log(`Working files: ${workingSet.length > 0 ? workingSet.join(', ') : 'none'}`);
  if (tokens > HANDOFF_TOKEN_WARNING) {
    console.warn(`Warning: packet exceeds the ${HANDOFF_TOKEN_WARNING.toLocaleString()}-token target. Reduce the working set if the omitted files are not required.`);
  }
  if (!stdout) {
    console.log(copied ? 'Copied packet to clipboard.' : 'Clipboard unavailable; attach .mosaic-handoff.md or rerun with --stdout.');
  }
  console.log(`Start the new chat with: ${prompt}`);
} catch (error) {
  console.error(`Handoff failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
