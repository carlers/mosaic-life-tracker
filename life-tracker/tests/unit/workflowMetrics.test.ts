import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendEvent,
  assertTaskCanAppend,
  createEvent,
  formatRunLine,
  readEvents,
  summarizePortfolio,
  summarizeTask,
} from '../../scripts/lib/workflow-metrics.mjs';

const snapshot = (fingerprint: string, added = 0) => ({
  fingerprint,
  files: added ? [{ path: 'src/example.ts', added, deleted: 0, binary: false }] : [],
});

function event(type: string, second: number, fields: Record<string, unknown>) {
  return createEvent(type, fields, new Date(`2026-09-20T00:00:${String(second).padStart(2, '0')}.000Z`));
}

const start = () => event('task_started', 0, {
  taskId: 'task-1',
  profile: 'complex',
  surface: 'workspace-agent',
  snapshot: snapshot('clean'),
});

const gate = (
  second: number,
  result: 'pass' | 'fail' | 'infrastructure',
  fingerprint: string,
  scope = 'acceptance'
) => event('gate_finished', second, {
  taskId: 'task-1',
  gateId: `gate-${second}`,
  scope,
  result,
  commands: ['npm test'],
  failedChecks: result === 'pass' ? [] : ['tests/unit/example.test.ts'],
  snapshot: snapshot(fingerprint, fingerprint === 'clean' ? 0 : 12),
});

describe('workflow metrics ledger', () => {
  it('round-trips append-only JSONL events and rejects malformed records', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'mosaic-metrics-')), 'events.jsonl');
    const started = start();
    appendEvent(file, started);
    appendEvent(file, gate(1, 'pass', 'clean'));

    expect(readEvents(file)).toEqual([started, expect.objectContaining({ type: 'gate_finished' })]);
    expect(() => createEvent('turn_recorded', {
      taskId: 'task-1',
      tokenProvenance: 'provider_exact',
      inputTokens: -1,
    })).toThrow(/non-negative integer/);
  });

  it('enforces a unique start and prevents events after completion', () => {
    const events = [start()];
    expect(() => assertTaskCanAppend(events, 'task-1', 'task_started')).toThrow(/already exists/);
    expect(() => assertTaskCanAppend(events, 'missing', 'gate_finished')).toThrow(/no unique start/);
    expect(() => assertTaskCanAppend(events, 'task-1', 'task_completed', { result: 'solved' }))
      .toThrow(/passing acceptance gate/);
    const completed = [...events, event('task_completed', 1, { taskId: 'task-1', result: 'solved' })];
    expect(() => assertTaskCanAppend(completed, 'task-1', 'gate_finished')).toThrow(/already complete/);
  });
});

describe('workflow metric derivation', () => {
  it('reports a first-attempt green acceptance gate and first-gate cadence', () => {
    const summary = summarizeTask([start(), gate(1, 'pass', 'edited')], 'task-1');

    expect(summary.acceptanceAttempts).toBe(1);
    expect(summary.acceptanceStatus).toBe('pass');
    expect(summary.loops).toEqual({ v: 0, i: 0 });
    expect(summary.cadence).toEqual({ files: 1, changedLines: 12 });
    expect(formatRunLine(summary)).toContain('gate=green@1');
    expect(formatRunLine(summary)).toContain('tok=? · cache=?');
  });

  it('classifies red-edit-green as verification repair and red-retry-green as flaky', () => {
    const verification = summarizeTask([
      start(),
      gate(1, 'fail', 'edited'),
      gate(2, 'pass', 'fixed'),
    ], 'task-1');
    const flaky = summarizeTask([
      start(),
      gate(1, 'fail', 'edited'),
      gate(2, 'pass', 'edited'),
    ], 'task-1');

    expect(verification.loops.v).toBe(1);
    expect(flaky.retries.f).toBe(1);
    expect(flaky.loops.v).toBe(0);
  });

  it('counts a red-edit-red rerun as a repair loop without calling it flaky', () => {
    const summary = summarizeTask([
      start(),
      gate(1, 'fail', 'edited'),
      gate(2, 'fail', 'first-fix'),
      gate(3, 'pass', 'second-fix'),
    ], 'task-1');

    expect(summary.loops.v).toBe(2);
    expect(summary.retries.f).toBe(0);
  });

  it('separates environment retries and accepted pre-existing intent defects', () => {
    const environment = event('environment_changed', 2, {
      taskId: 'task-1',
      reason: 'dependency registry unavailable',
    });
    const review = event('review_finding', 2, {
      taskId: 'task-1',
      findingId: 'finding-1',
      reviewer: 'human',
      requirement: 'AGENTS.md data rule',
      category: 'architecture_violation',
      accepted: true,
      preExistingRequirement: true,
    });
    const infrastructure = summarizeTask([
      start(),
      gate(1, 'fail', 'edited'),
      environment,
      gate(3, 'pass', 'edited'),
    ], 'task-1');
    const intent = summarizeTask([
      start(),
      gate(1, 'pass', 'edited'),
      review,
      gate(3, 'pass', 'review-fixed'),
    ], 'task-1');

    expect(infrastructure.retries).toEqual({ f: 0, u: 1 });
    expect(intent.loops.i).toBe(1);
  });

  it('keeps exact, estimated, unavailable, and cache token data distinguishable', () => {
    const exact = event('turn_recorded', 1, {
      taskId: 'task-1',
      turnId: 'turn-1',
      tokenProvenance: 'provider_exact',
      inputTokens: 100,
      outputTokens: 25,
      cacheReadTokens: 50,
      cacheWriteTokens: 0,
    });
    const estimated = event('turn_recorded', 2, {
      taskId: 'task-1',
      turnId: 'turn-2',
      tokenProvenance: 'estimated',
      inputTokens: 20,
      outputTokens: 5,
      cacheReadTokens: 0,
    });
    const unavailable = event('turn_recorded', 3, {
      taskId: 'task-1',
      turnId: 'turn-3',
      tokenProvenance: 'unavailable',
    });
    const summary = summarizeTask([start(), exact, estimated, unavailable], 'task-1');

    expect(summary.tokens).toEqual({
      exact: { input: 100, output: 25, cacheRead: 50, cacheWrite: 0, receipts: 1 },
      estimated: { input: 20, output: 5, cacheRead: 0, cacheWrite: 0, receipts: 1 },
      unavailable: 1,
    });
    expect(formatRunLine(summary)).toContain('tok=~150 · cache=~42%');
  });

  it('reports portfolio rates without mixing estimated tokens into exact averages', () => {
    const exact = event('turn_recorded', 1, {
      taskId: 'task-1',
      turnId: 'turn-1',
      tokenProvenance: 'provider_exact',
      inputTokens: 100,
      outputTokens: 25,
    });
    const completed = event('task_completed', 3, { taskId: 'task-1', result: 'solved' });
    const portfolio = summarizePortfolio([start(), exact, gate(2, 'pass', 'edited'), completed]);

    expect(portfolio).toMatchObject({
      tasks: 1,
      solved: 1,
      firstAcceptancePassRate: 1,
      exactTokensPerSolvedTask: 125,
      exactTokenTaskCount: 1,
    });
  });
});
