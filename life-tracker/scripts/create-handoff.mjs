#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyToClipboard } from './clipboard.mjs';
import {
  assertGithubCheckpoint,
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
const telemetry = args.includes('--telemetry');
const transportIndex = args.indexOf('--transport');
const transport = transportIndex === -1 ? 'files' : args[transportIndex + 1];
const positional = args.filter((arg, index) =>
  !['--stdout', '--telemetry'].includes(arg) && index !== transportIndex &&
  !(transportIndex !== -1 && index === transportIndex + 1)
);
const [requestedTarget, ...extraPaths] = positional;
const report = (...values) => console.error(...values);

function recordHandoff(target) {
  if (!telemetry) return null;
  const metricsPath = join(projectRoot, '.mosaic/metrics/events.jsonl');
  if (!existsSync(metricsPath)) return null;
  try {
    const events = readEvents(metricsPath);
    const active = latestTaskSummary(events);
    if (!active || active.result !== 'active') return null;
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
  console.error(`Usage: npm run handoff -- <${HANDOFF_TARGETS.join('|')}> [--stdout] [--transport files|github] [--telemetry] [extra paths...]`);
  process.exit(1);
}

try {
  if (!['files', 'github'].includes(transport)) throw new Error('Expected --transport files|github');
  const { target, alias } = normalizeHandoffTarget(requestedTarget);
  const prompt = promptForTarget(target);
  const sessionState = readFileSync(join(projectRoot, 'docs/SESSION_STATE.md'), 'utf8');
  validateSessionState(sessionState);

  if (alias) {
    console.warn(`Handoff target "${alias}" is an alias; prefer "${target}".`);
  }
  const metricsSummary = recordHandoff(target);

  if (target === 'agent') {
    const copied = stdout ? false : copyToClipboard(prompt);
    console.log(prompt);
    report(copied ? 'Copied prompt to clipboard.' : 'Clipboard unavailable; copy the prompt above.');
    process.exit(0);
  }

  const git = (args) =>
    execFileSync('git', args, {
      cwd: projectRoot, encoding: 'utf8', timeout: 15000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '', SSH_ASKPASS: '' },
    }).trimEnd();
  const snapshot = {
    branch: git(['branch', '--show-current']),
    head: git(['rev-parse', 'HEAD']),
    status: git(['status', '--short']),
    repository: '',
  };
  try { snapshot.repository = git(['remote', 'get-url', 'origin']); } catch { /* Local-only repository. */ }
  if (transport === 'github') {
    assertGithubCheckpoint(snapshot, snapshot.head);
    try {
      snapshot.remoteHead = git(['ls-remote', '--exit-code', 'origin', `refs/heads/${snapshot.branch}`]).split(/\s+/)[0];
    } catch {
      throw new Error('Cannot verify the remote branch. Use the default file packet for local-only work.');
    }
    assertGithubCheckpoint(snapshot, snapshot.remoteHead);
  }
  const workingSet = resolveWorkingSet(
    projectRoot,
    parseWorkingSet(sessionState),
    extraPaths
  );
  const packet = buildWebChatPacket({
    target,
    projectRoot,
    sessionState,
    agents: readFileSync(join(projectRoot, 'AGENTS.md'), 'utf8'),
    workingSet,
    metricsSummary,
    transport,
    git: snapshot,
  });
  const outputPath = join(projectRoot, '.mosaic-handoff.md');
  writeFileSync(outputPath, packet);
  const tokens = estimateTokens(packet);
  const copied = stdout ? false : copyToClipboard(packet);

  if (stdout) console.log(packet);
  report(`Wrote .mosaic-handoff.md (${packet.length.toLocaleString()} characters, approximately ${tokens.toLocaleString()} tokens).`);
  report(`Working files: ${workingSet.length > 0 ? workingSet.join(', ') : 'none'}`);
  if (tokens > HANDOFF_TOKEN_WARNING) {
    console.warn(`Warning: packet exceeds the ${HANDOFF_TOKEN_WARNING.toLocaleString()}-token target. Reduce the working set if the omitted files are not required.`);
  }
  if (!stdout) {
    report(copied ? 'Copied packet to clipboard.' : 'Clipboard unavailable; attach .mosaic-handoff.md or rerun with --stdout.');
  }
  report(`Start the new chat with: ${prompt}`);
} catch (error) {
  console.error(`Handoff failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
