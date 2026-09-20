import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const WORKFLOW_METRICS_SCHEMA = 2;
export const WORKFLOW_VERSION = '2';
const SUPPORTED_METRICS_SCHEMAS = [1, WORKFLOW_METRICS_SCHEMA];
export const TASK_PROFILES = ['routine', 'standard', 'complex', 'exceptional'];
export const TASK_RESULTS = ['solved', 'blocked', 'abandoned'];
export const GATE_SCOPES = ['focused', 'project', 'acceptance', 'manual'];
export const GATE_RESULTS = ['pass', 'fail', 'skipped', 'infrastructure'];
export const TOKEN_PROVENANCE = ['provider_exact', 'client_exact', 'estimated', 'unavailable'];
export const EVIDENCE_STATUSES = [
  'existing-direct',
  'existing-indirect',
  'added-red-green',
  'manual',
  'skipped',
  'not-applicable',
];
export const RED_CLASSIFICATIONS = ['behavioral-red', 'structural-red'];
export const LOOP_TAGS = ['v', 'i', 'f', 'u'];

function assertChoice(name, value, choices) {
  if (!choices.includes(value)) {
    throw new Error(`${name} must be one of: ${choices.join(', ')}`);
  }
}

function assertCount(name, value) {
  if (value != null && (!Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

export function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

export function fingerprintSnapshot(files) {
  return stableHash(files.map((file) => ({
    path: file.path,
    added: file.added,
    deleted: file.deleted,
    binary: file.binary,
    contentHash: file.contentHash ?? null,
  })));
}

export function createEvent(type, fields, now = new Date()) {
  if (!type || !fields.taskId) throw new Error('Event type and taskId are required');
  const event = {
    schema: WORKFLOW_METRICS_SCHEMA,
    workflowVersion: WORKFLOW_VERSION,
    eventId: randomUUID(),
    timestamp: now.toISOString(),
    type,
    ...fields,
  };
  validateEvent(event);
  return event;
}

export function validateEvent(event) {
  if (!SUPPORTED_METRICS_SCHEMAS.includes(event.schema)) throw new Error('Unsupported metrics schema');
  if (!event.eventId || !event.timestamp || !event.type || !event.taskId) {
    throw new Error('Metrics event is missing required identity fields');
  }
  if (event.type === 'task_started') assertChoice('profile', event.profile, TASK_PROFILES);
  if (event.type === 'task_completed') assertChoice('result', event.result, TASK_RESULTS);
  if (event.type === 'gate_finished') {
    assertChoice('scope', event.scope, GATE_SCOPES);
    assertChoice('result', event.result, GATE_RESULTS);
    if (!event.gateId || !Array.isArray(event.commands) || event.commands.length === 0) {
      throw new Error('A gate result needs gateId and commands');
    }
  }
  if (event.type === 'turn_recorded') {
    assertChoice('tokenProvenance', event.tokenProvenance, TOKEN_PROVENANCE);
    for (const key of ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens']) {
      assertCount(key, event[key]);
    }
  }
  if (event.type === 'behavior_declared') {
    if (!event.behaviorId || !event.statement || !event.requirement) {
      throw new Error('A declared behavior needs behaviorId, statement and requirement');
    }
  }
  if (event.type === 'test_evidence') validateTestEvidence(event);
  if (event.type === 'loop_corrected') {
    if (!event.gateId || !event.reason) throw new Error('A loop correction needs gateId and reason');
    assertChoice('from', event.from, LOOP_TAGS);
    assertChoice('to', event.to, LOOP_TAGS);
    if (event.from === event.to) throw new Error('A loop correction must change the classification');
  }
  return event;
}

function requiredEvidenceFields(event, fields) {
  const missing = fields.filter((field) => !event[field]);
  if (missing.length > 0) {
    throw new Error(`${event.status} evidence requires: ${missing.join(', ')}`);
  }
}

function validateTestEvidence(event) {
  if (!event.behaviorId) throw new Error('Test evidence requires behaviorId');
  assertChoice('status', event.status, EVIDENCE_STATUSES);
  if (event.status === 'existing-direct' || event.status === 'existing-indirect') {
    requiredEvidenceFields(event, ['testPath', 'testName']);
  } else if (event.status === 'added-red-green') {
    requiredEvidenceFields(event, [
      'testPath',
      'testName',
      'command',
      'redClassification',
      'redFailureSignature',
      'greenResult',
    ]);
    assertChoice('redClassification', event.redClassification, RED_CLASSIFICATIONS);
    if (event.greenResult !== 'pass') throw new Error('added-red-green evidence requires greenResult=pass');
  } else if (event.status === 'manual') {
    requiredEvidenceFields(event, ['reason', 'manualProtocol']);
  } else if (event.status === 'skipped' || event.status === 'not-applicable') {
    requiredEvidenceFields(event, ['reason']);
  }
}

export function readEvents(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return validateEvent(JSON.parse(line));
      } catch (error) {
        throw new Error(`Invalid metrics record on line ${index + 1}: ${error.message}`);
      }
    });
}

export function appendEvent(filePath, event) {
  validateEvent(event);
  mkdirSync(dirname(filePath), { recursive: true });
  appendFileSync(filePath, `${JSON.stringify(event)}\n`, { flag: 'a' });
}

export function assertTaskCanAppend(events, taskId, type, fields = {}) {
  const task = events.filter((event) => event.taskId === taskId);
  const starts = task.filter((event) => event.type === 'task_started');
  if (type === 'task_started') {
    if (starts.length > 0) throw new Error(`Task already exists: ${taskId}`);
    return;
  }
  if (starts.length !== 1) throw new Error(`Task has no unique start event: ${taskId}`);
  if (task.some((event) => event.type === 'task_completed')) {
    throw new Error(`Task is already complete: ${taskId}`);
  }
  if (
    type === 'task_completed' &&
    fields.result === 'solved' &&
    !fields.acceptanceException &&
    !task.some((event) =>
      event.type === 'gate_finished' && event.scope === 'acceptance' && event.result === 'pass'
    )
  ) {
    throw new Error('A solved task needs a passing acceptance gate or --exception');
  }
  if (
    type === 'task_completed' &&
    fields.result === 'solved' &&
    task.some((event) => event.type === 'behavior_declared')
  ) {
    validateEvidenceCoverage(events, taskId);
  }
}

function snapshotChanged(before, after) {
  return Boolean(before && after && before.fingerprint !== after.fingerprint);
}

function sameGate(left, right) {
  return left.scope === right.scope && stableHash(left.commands) === stableHash(right.commands);
}

export function summarizeTask(events, taskId) {
  const task = events.filter((event) => event.taskId === taskId);
  const start = task.find((event) => event.type === 'task_started');
  if (!start) throw new Error(`Unknown task: ${taskId}`);
  const gates = task.filter((event) => event.type === 'gate_finished');
  const focusedGates = gates.filter((event) => event.scope !== 'acceptance');
  const summary = {
    taskId,
    profile: start.profile,
    result: task.findLast((event) => event.type === 'task_completed')?.result || 'active',
    gateAttempts: gates.length,
    acceptanceAttempts: gates.filter((event) => event.scope === 'acceptance').length,
    acceptanceStatus: gates.filter((event) => event.scope === 'acceptance').at(-1)?.result || 'pending',
    focusedStatus: focusedGates.at(-1)?.result || 'not reported',
    loops: { v: 0, i: 0 },
    retries: { f: 0, u: gates.filter((event) => event.result === 'infrastructure').length },
    handoffs: task.filter((event) => event.type === 'handoff_recorded').length,
    tokens: {
      exact: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, receipts: 0 },
      estimated: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, receipts: 0 },
      unavailable: 0,
    },
    cadence: cadenceFromSnapshots(start.snapshot, gates[0]?.snapshot),
    evidence: summarizeEvidence(events, taskId),
  };

  for (let index = 0; index < gates.length - 1; index += 1) {
    const failed = gates[index];
    const rerun = gates[index + 1];
    if (failed.result !== 'fail' || !sameGate(failed, rerun)) continue;
    const between = task.filter((event) =>
      event.timestamp >= failed.timestamp && event.timestamp <= rerun.timestamp
    );
    const environmentChanged = between.some((event) => event.type === 'environment_changed');
    if (environmentChanged) summary.retries.u += 1;
    else if (snapshotChanged(failed.snapshot, rerun.snapshot)) summary.loops.v += 1;
    else if (rerun.result === 'pass') summary.retries.f += 1;
  }

  const acceptedFindings = task.filter((event) =>
    event.type === 'review_finding' && event.accepted && event.preExistingRequirement
  );
  for (const finding of acceptedFindings) {
    const priorGreen = gates.findLast((gate) => gate.timestamp <= finding.timestamp && gate.result === 'pass');
    const nextGate = gates.find((gate) => gate.timestamp > finding.timestamp);
    if (priorGreen && nextGate && snapshotChanged(priorGreen.snapshot, nextGate.snapshot)) {
      summary.loops.i += 1;
    }
  }

  for (const turn of task.filter((event) => event.type === 'turn_recorded')) {
    if (turn.tokenProvenance === 'unavailable') summary.tokens.unavailable += 1;
    else {
      const bucket = turn.tokenProvenance === 'estimated'
        ? summary.tokens.estimated
        : summary.tokens.exact;
      bucket.input += turn.inputTokens || 0;
      bucket.output += turn.outputTokens || 0;
      bucket.cacheRead += turn.cacheReadTokens || 0;
      bucket.cacheWrite += turn.cacheWriteTokens || 0;
      bucket.receipts += 1;
    }
  }
  for (const correction of task.filter((event) => event.type === 'loop_corrected')) {
    const from = correction.from === 'v' || correction.from === 'i'
      ? summary.loops
      : summary.retries;
    const to = correction.to === 'v' || correction.to === 'i'
      ? summary.loops
      : summary.retries;
    if (from[correction.from] > 0) {
      from[correction.from] -= 1;
      to[correction.to] += 1;
    }
  }
  return summary;
}

export function cadenceFromSnapshots(start, firstGate) {
  if (!start || !firstGate) return null;
  const before = new Map((start.files || []).map((file) => [file.path, file]));
  const after = new Map((firstGate.files || []).map((file) => [file.path, file]));
  const paths = new Set([...before.keys(), ...after.keys()]);
  let files = 0;
  let changedLines = 0;
  for (const path of paths) {
    const left = before.get(path) || { added: 0, deleted: 0 };
    const right = after.get(path) || { added: 0, deleted: 0 };
    if (left.added !== right.added || left.deleted !== right.deleted) {
      files += 1;
      changedLines += Math.abs(right.added - left.added) + Math.abs(right.deleted - left.deleted);
    }
  }
  return { files, changedLines };
}

export function formatRunLine(summary) {
  const acceptance = summary.acceptanceStatus === 'pass'
    ? `green@${summary.acceptanceAttempts}`
    : summary.acceptanceStatus === 'fail'
      ? `red@${summary.acceptanceAttempts}`
      : 'pending';
  const cadence = summary.cadence
    ? `${summary.cadence.files}f/${summary.cadence.changedLines}Δ`
    : '?';
  const exactTotal = summary.tokens.exact.input + summary.tokens.exact.output;
  const estimatedTotal = summary.tokens.estimated.input + summary.tokens.estimated.output;
  const tokenReceipts = summary.tokens.exact.receipts + summary.tokens.estimated.receipts;
  const inputTotal = summary.tokens.exact.input + summary.tokens.estimated.input;
  const cacheReadTotal = summary.tokens.exact.cacheRead + summary.tokens.estimated.cacheRead;
  const tokens = tokenReceipts === 0
    ? '?'
    : `${estimatedTotal > 0 ? '~' : ''}${exactTotal + estimatedTotal}`;
  const cache = inputTotal > 0
    ? `${summary.tokens.estimated.input > 0 ? '~' : ''}${Math.round(cacheReadTotal / inputTotal * 100)}%`
    : '?';
  const evidence = summary.evidence.declared > 0
    ? ` · evidence=${summary.evidence.documented}/${summary.evidence.declared}`
    : '';
  return `**Run:** task=${summary.taskId} · gate=${acceptance} · loops=v${summary.loops.v}/i${summary.loops.i} · retry=f${summary.retries.f}/u${summary.retries.u} · cadence=${cadence} · tok=${tokens} · cache=${cache}${evidence}`;
}

export function summarizeEvidence(events, taskId) {
  const task = events.filter((event) => event.taskId === taskId);
  const declarations = task.filter((event) => event.type === 'behavior_declared');
  const latestEvidence = new Map();
  for (const evidence of task.filter((event) => event.type === 'test_evidence')) {
    latestEvidence.set(evidence.behaviorId, evidence);
  }
  const statuses = Object.fromEntries(EVIDENCE_STATUSES.map((status) => [status, 0]));
  const red = { behavioral: 0, structural: 0 };
  const manualNotes = [];
  const skippedNotes = [];
  for (const declaration of declarations) {
    const evidence = latestEvidence.get(declaration.behaviorId);
    if (!evidence) continue;
    statuses[evidence.status] += 1;
    if (evidence.redClassification === 'behavioral-red') red.behavioral += 1;
    if (evidence.redClassification === 'structural-red') red.structural += 1;
    if (evidence.status === 'manual') manualNotes.push(evidence.reason);
    if (evidence.status === 'skipped') skippedNotes.push(evidence.reason);
  }
  return {
    declared: declarations.length,
    documented: declarations.filter((declaration) => latestEvidence.has(declaration.behaviorId)).length,
    statuses,
    red,
    missing: declarations
      .filter((declaration) => !latestEvidence.has(declaration.behaviorId))
      .map((declaration) => declaration.behaviorId),
    undeclared: [...latestEvidence.keys()].filter((behaviorId) =>
      !declarations.some((declaration) => declaration.behaviorId === behaviorId)
    ),
    manualNotes,
    skippedNotes,
  };
}

export function validateEvidenceCoverage(events, taskId) {
  const report = summarizeEvidence(events, taskId);
  const errors = [];
  const declarations = events.filter((event) =>
    event.taskId === taskId && event.type === 'behavior_declared'
  );
  const duplicateIds = [...new Set(declarations
    .map((event) => event.behaviorId)
    .filter((behaviorId, index, values) => values.indexOf(behaviorId) !== index))];
  if (duplicateIds.length > 0) errors.push(`duplicate behaviors: ${duplicateIds.join(', ')}`);
  if (report.missing.length > 0) errors.push(`missing evidence: ${report.missing.join(', ')}`);
  if (report.undeclared.length > 0) errors.push(`undeclared evidence: ${report.undeclared.join(', ')}`);
  if (errors.length > 0) throw new Error(`Evidence check failed (${errors.join('; ')})`);
  return report;
}

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatEvidenceSummary(report, gates = {}) {
  const statusParts = EVIDENCE_STATUSES
    .filter((status) => report.statuses[status] > 0)
    .map((status) => `${report.statuses[status]} ${status}`);
  const notes = [
    report.manualNotes.length > 0 ? `Manual reasons: ${report.manualNotes.join('; ')}.` : '',
    report.skippedNotes.length > 0 ? `Skipped reasons: ${report.skippedNotes.join('; ')}.` : '',
  ].filter(Boolean).join(' ');
  return `Test-evidence summary: ${countLabel(report.declared, 'behavioral change', 'behavioral changes')} ${report.declared === 1 ? 'was' : 'were'} identified; ${statusParts.length > 0 ? statusParts.join(', ') : 'no evidence statuses'} were recorded. ${countLabel(report.red.behavioral, 'behavioral-red test')} and ${countLabel(report.red.structural, 'structural-red test')} were recorded. Focused verification: ${gates.focused || 'not reported'}; acceptance gate: ${gates.acceptance || 'pending'}. ${notes ? `${notes} ` : ''}No judgment of overall suite sufficiency is made here.`;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarizePortfolio(events) {
  const starts = events.filter((event) => event.type === 'task_started');
  const summaries = starts.map((start) => summarizeTask(events, start.taskId));
  const solved = summaries.filter((summary) => summary.result === 'solved');
  const exactTokenTasks = solved.filter((summary) =>
    summary.tokens.exact.receipts > 0 &&
    summary.tokens.estimated.receipts === 0 &&
    summary.tokens.unavailable === 0
  );
  const groups = new Map();
  for (const summary of solved) {
    const start = starts.find((event) => event.taskId === summary.taskId);
    const key = [
      summary.profile,
      start.surface || 'unknown',
      start.model || 'unknown-model',
      start.workflowVersion,
    ].join('/');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(summary);
  }
  return {
    tasks: summaries.length,
    solved: solved.length,
    firstAcceptancePassRate: solved.length
      ? solved.filter((summary) => summary.acceptanceStatus === 'pass' && summary.acceptanceAttempts === 1).length / solved.length
      : null,
    medianLoops: {
      v: median(solved.map((summary) => summary.loops.v)),
      i: median(solved.map((summary) => summary.loops.i)),
      f: median(solved.map((summary) => summary.retries.f)),
      u: median(solved.map((summary) => summary.retries.u)),
    },
    exactTokensPerSolvedTask: exactTokenTasks.length
      ? exactTokenTasks.reduce((total, summary) =>
        total + summary.tokens.exact.input + summary.tokens.exact.output, 0) / exactTokenTasks.length
      : null,
    exactTokenTaskCount: exactTokenTasks.length,
    groups: [...groups.entries()].map(([key, values]) => ({ key, solved: values.length })),
  };
}

export function formatPortfolio(summary) {
  const rate = summary.firstAcceptancePassRate == null
    ? '?'
    : `${Math.round(summary.firstAcceptancePassRate * 100)}%`;
  const tokens = summary.exactTokensPerSolvedTask == null
    ? '?'
    : Math.round(summary.exactTokensPerSolvedTask);
  return [
    `Tasks: ${summary.tasks}; solved: ${summary.solved}; first acceptance pass: ${rate}.`,
    `Median loops: v${summary.medianLoops.v ?? '?'}/i${summary.medianLoops.i ?? '?'}; retries: f${summary.medianLoops.f ?? '?'}/u${summary.medianLoops.u ?? '?'}.`,
    `Exact tokens per solved task: ${tokens} (${summary.exactTokenTaskCount} eligible).`,
  ].join('\n');
}

export function latestTaskSummary(events) {
  const starts = events.filter((event) => event.type === 'task_started');
  const active = starts.findLast((start) =>
    !events.some((event) => event.taskId === start.taskId && event.type === 'task_completed')
  );
  return active ? summarizeTask(events, active.taskId) : null;
}
