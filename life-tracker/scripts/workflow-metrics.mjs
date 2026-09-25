#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendEvent,
  assertTaskCanAppend,
  createEvent,
  formatPortfolio,
  formatEvidenceSummary,
  formatRunLine,
  fingerprintSnapshot,
  readEvents,
  stableHash,
  summarizePortfolio,
  validateEvidenceCoverage,
  summarizeTask,
} from './lib/workflow-metrics.mjs';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const metricsFile = join(projectRoot, '.mosaic/metrics/events.jsonl');
const [command, ...rawArgs] = process.argv.slice(2);

function options(args) {
  const result = { _: [] };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith('--')) result._.push(value);
    else {
      const key = value.slice(2);
      const next = args[index + 1];
      if (!next || next.startsWith('--')) result[key] = true;
      else {
        result[key] = next;
        index += 1;
      }
    }
  }
  return result;
}

function git(args) {
  return execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trimEnd();
}

function snapshot() {
  const output = git(['diff', '--numstat', 'HEAD', '--', '.']);
  const files = output ? output.split('\n').map((line) => {
    const [added, deleted, ...path] = line.split('\t');
    const filePath = path.join('\t');
    const fullPath = join(projectRoot, filePath);
    return {
      path: filePath,
      added: added === '-' ? 0 : Number(added),
      deleted: deleted === '-' ? 0 : Number(deleted),
      binary: added === '-' || deleted === '-',
      contentHash: existsSync(fullPath) ? stableHash(readFileSync(fullPath).toString('base64')) : null,
    };
  }) : [];
  const known = new Set(files.map((file) => file.path));
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean);
  for (const path of untracked) {
    if (known.has(path)) continue;
    const content = readFileSync(join(projectRoot, path));
    const binary = content.includes(0);
    const text = binary ? '' : content.toString('utf8');
    files.push({
      path,
      added: binary || text.length === 0
        ? 0
        : text.split(/\r?\n/).length - (/\r?\n$/.test(text) ? 1 : 0),
      deleted: 0,
      binary,
      contentHash: stableHash(content.toString('base64')),
    });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  return { files, fingerprint: fingerprintSnapshot(files) };
}

function required(value, name) {
  if (!value || value === true) throw new Error(`Missing --${name}`);
  return value;
}

function integer(value, name) {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`--${name} must be a non-negative integer`);
  return parsed;
}

function append(type, fields) {
  const events = readEvents(metricsFile);
  assertTaskCanAppend(events, fields.taskId, type, fields);
  const event = createEvent(type, fields);
  appendEvent(metricsFile, event);
  return event;
}

try {
  const args = options(rawArgs);
  const taskId = args.task || args._[0];
  if (command === 'start') {
    const event = append('task_started', {
      taskId: required(taskId, 'task'),
      profile: required(args.profile, 'profile').toLowerCase(),
      surface: args.surface || 'workspace-agent',
      model: args.model || null,
      git: { head: git(['rev-parse', '--short', 'HEAD']), dirty: Boolean(git(['status', '--short', '--', '.'])) },
      snapshot: snapshot(),
    });
    console.log(`Started telemetry task ${event.taskId}.`);
  } else if (command === 'gate') {
    const commands = required(args.commands, 'commands').split('|').map((value) => value.trim()).filter(Boolean);
    const event = append('gate_finished', {
      taskId: required(taskId, 'task'),
      gateId: args.id || `gate-${Date.now()}`,
      scope: required(args.scope, 'scope'),
      result: required(args.result, 'result'),
      commands,
      failedChecks: args.failed ? args.failed.split(',').map((value) => value.trim()) : [],
      snapshot: snapshot(),
    });
    console.log(`Recorded ${event.scope} gate: ${event.result}.`);
  } else if (command === 'turn') {
    const event = append('turn_recorded', {
      taskId: required(taskId, 'task'),
      turnId: args.id || `turn-${Date.now()}`,
      tokenProvenance: args.provenance || 'unavailable',
      inputTokens: integer(args.input, 'input'),
      outputTokens: integer(args.output, 'output'),
      cacheReadTokens: integer(args['cache-read'], 'cache-read'),
      cacheWriteTokens: integer(args['cache-write'], 'cache-write'),
    });
    console.log(`Recorded turn ${event.turnId}.`);
  } else if (command === 'review') {
    append('review_finding', {
      taskId: required(taskId, 'task'),
      findingId: args.id || `finding-${Date.now()}`,
      reviewer: required(args.reviewer, 'reviewer'),
      requirement: required(args.requirement, 'requirement'),
      category: required(args.category, 'category'),
      accepted: args.accepted === 'true',
      preExistingRequirement: args['pre-existing'] === 'true',
    });
    console.log('Recorded review finding.');
  } else if (command === 'behavior') {
    append('behavior_declared', {
      taskId: required(taskId, 'task'),
      behaviorId: required(args.id, 'id'),
      statement: required(args.statement, 'statement'),
      requirement: required(args.requirement, 'requirement'),
    });
    console.log(`Declared behavior ${args.id}.`);
  } else if (command === 'evidence') {
    append('test_evidence', {
      taskId: required(taskId, 'task'),
      behaviorId: required(args.behavior, 'behavior'),
      status: required(args.status, 'status'),
      testPath: args.test,
      testName: args.name,
      command: args.command,
      redClassification: args.red,
      redFailureSignature: args['red-signature'],
      greenResult: args.green,
      reason: args.reason,
      manualProtocol: args.protocol,
    });
    console.log(`Recorded ${args.status} evidence for ${args.behavior}.`);
  } else if (command === 'evidence-check') {
    const events = readEvents(metricsFile);
    const report = validateEvidenceCoverage(events, required(taskId, 'task'));
    const taskSummary = summarizeTask(events, taskId);
    console.log(args.json
      ? JSON.stringify(report, null, 2)
      : formatEvidenceSummary(report, {
        focused: taskSummary.focusedStatus,
        acceptance: taskSummary.acceptanceStatus,
      }));
  } else if (command === 'correct-loop') {
    const events = readEvents(metricsFile);
    const summary = summarizeTask(events, required(taskId, 'task'));
    const from = required(args.from, 'from');
    const gateId = required(args.gate, 'gate');
    if (!events.some((event) =>
      event.taskId === taskId && event.type === 'gate_finished' && event.gateId === gateId
    )) {
      throw new Error(`Unknown gate for task ${taskId}: ${gateId}`);
    }
    const bucket = from === 'v' || from === 'i' ? summary.loops : summary.retries;
    if (!bucket || !bucket[from]) throw new Error(`Task has no ${from} loop to correct`);
    append('loop_corrected', {
      taskId,
      gateId,
      from,
      to: required(args.to, 'to'),
      reason: required(args.reason, 'reason'),
    });
    console.log(`Corrected loop ${from} → ${args.to}.`);
  } else if (command === 'environment') {
    append('environment_changed', { taskId: required(taskId, 'task'), reason: required(args.reason, 'reason') });
    console.log('Recorded environment change.');
  } else if (command === 'handoff') {
    append('handoff_recorded', { taskId: required(taskId, 'task'), target: required(args.target, 'target') });
    console.log('Recorded handoff.');
  } else if (command === 'end') {
    append('task_completed', {
      taskId: required(taskId, 'task'),
      result: required(args.result, 'result'),
      acceptanceException: args.exception || null,
    });
    console.log(`Completed telemetry task ${taskId}: ${args.result}.`);
  } else if (command === 'summary') {
    const events = readEvents(metricsFile);
    const summary = taskId ? summarizeTask(events, taskId) : summarizePortfolio(events);
    console.log(args.json
      ? JSON.stringify(summary, null, 2)
      : taskId ? formatRunLine(summary) : formatPortfolio(summary));
  } else {
    throw new Error('Usage: npm run metrics -- <start|gate|turn|review|behavior|evidence|evidence-check|correct-loop|environment|handoff|end|summary> [options]');
  }
} catch (error) {
  console.error(`Metrics failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
