import {
  assertTaskCanAppend,
  createEvent,
  formatEvidenceSummary,
  fingerprintSnapshot,
  summarizeEvidence,
  summarizeTask,
  validateEvidenceCoverage,
  validateEvent,
} from '../../scripts/lib/workflow-metrics.mjs';

function event(type: string, fields: Record<string, unknown>) {
  return createEvent(type, { taskId: 'task-1', ...fields });
}

describe('workflow test evidence', () => {
  it('continues to read schema-1 events after the evidence schema upgrade', () => {
    expect(() => validateEvent({
      schema: 1,
      workflowVersion: '1',
      eventId: 'legacy-event',
      timestamp: '2026-09-20T00:00:00.000Z',
      type: 'task_started',
      taskId: 'legacy-task',
      profile: 'standard',
    })).not.toThrow();
  });

  it('distinguishes content-only edits with unchanged line counts', () => {
    const shared = { path: 'src/example.ts', added: 1, deleted: 1, binary: false };
    expect(fingerprintSnapshot([{ ...shared, contentHash: 'before' }]))
      .not.toBe(fingerprintSnapshot([{ ...shared, contentHash: 'after' }]));
  });

  it('applies an auditable loop-classification correction', () => {
    const events = [
      event('task_started', { profile: 'standard' }),
      event('gate_finished', {
        gateId: 'gate-red', scope: 'focused', result: 'fail', commands: ['npm test'],
        snapshot: { fingerprint: 'same', files: [] },
      }),
      event('gate_finished', {
        gateId: 'gate-green', scope: 'focused', result: 'pass', commands: ['npm test'],
        snapshot: { fingerprint: 'same', files: [] },
      }),
      event('loop_corrected', {
        gateId: 'gate-red', from: 'f', to: 'v', reason: 'Content changed without line-count drift.',
      }),
    ];

    expect(summarizeTask(events, 'task-1')).toMatchObject({
      loops: { v: 1, i: 0 },
      retries: { f: 0, u: 0 },
    });
  });

  // Regression: AGENTS.md — Definition of done
  it('requires evidence for every declared behavioral change', () => {
    const events = [event('behavior_declared', {
      behaviorId: 'EVIDENCE-1',
      statement: 'Every declared behavior has an evidence row.',
      requirement: 'AGENTS.md — Definition of done',
    })];

    expect(() => validateEvidenceCoverage(events, 'task-1')).toThrow(/EVIDENCE-1/);
  });

  it('blocks solved completion while declared behavior lacks evidence', () => {
    const events = [
      event('task_started', { profile: 'standard' }),
      event('behavior_declared', {
        behaviorId: 'EVIDENCE-1',
        statement: 'Every behavior has evidence.',
        requirement: 'AGENTS.md — Definition of done',
      }),
      event('gate_finished', {
        gateId: 'acceptance-1',
        scope: 'acceptance',
        result: 'pass',
        commands: ['npm test'],
      }),
    ];

    expect(() => assertTaskCanAppend(events, 'task-1', 'task_completed', { result: 'solved' }))
      .toThrow(/missing evidence/);
  });

  it('validates status-specific evidence without judging adequacy', () => {
    const declarations = [
      event('behavior_declared', {
        behaviorId: 'EVIDENCE-1', statement: 'Direct coverage', requirement: '§24.7',
      }),
      event('behavior_declared', {
        behaviorId: 'EVIDENCE-2', statement: 'Manual coverage', requirement: '§24.13',
      }),
      event('behavior_declared', {
        behaviorId: 'EVIDENCE-3', statement: 'Skipped coverage', requirement: 'task acceptance EVIDENCE-3',
      }),
    ];
    const evidence = [
      event('test_evidence', {
        behaviorId: 'EVIDENCE-1',
        status: 'added-red-green',
        testPath: 'tests/unit/example.test.ts',
        testName: 'rejects invalid evidence',
        command: 'npm test -- tests/unit/example.test.ts',
        redClassification: 'behavioral-red',
        redFailureSignature: 'expected function to throw',
        greenResult: 'pass',
      }),
      event('test_evidence', {
        behaviorId: 'EVIDENCE-2',
        status: 'manual',
        reason: 'Requires a physical iOS device.',
        manualProtocol: 'Install from Safari and relaunch offline.',
      }),
      event('test_evidence', {
        behaviorId: 'EVIDENCE-3',
        status: 'skipped',
        reason: 'External account is unavailable.',
      }),
    ];

    expect(validateEvidenceCoverage([...declarations, ...evidence], 'task-1')).toMatchObject({
      declared: 3,
      documented: 3,
      statuses: { 'added-red-green': 1, manual: 1, skipped: 1 },
      red: { behavioral: 1, structural: 0 },
    });
  });

  it('rejects incomplete red-green, manual, and skipped evidence', () => {
    const declaration = event('behavior_declared', {
      behaviorId: 'EVIDENCE-1', statement: 'Evidence is complete.', requirement: '§24.7',
    });
    for (const evidence of [
      { behaviorId: 'EVIDENCE-1', status: 'added-red-green', testPath: 'test.ts' },
      { behaviorId: 'EVIDENCE-1', status: 'manual' },
      { behaviorId: 'EVIDENCE-1', status: 'skipped' },
    ]) {
      expect(() => validateEvidenceCoverage([
        declaration,
        event('test_evidence', evidence),
      ], 'task-1')).toThrow(/requires/);
    }
  });

  it('formats one factual paragraph and makes no adequacy judgment', () => {
    const events = [
      event('behavior_declared', {
        behaviorId: 'EVIDENCE-1', statement: 'Direct coverage', requirement: '§24.7',
      }),
      event('test_evidence', {
        behaviorId: 'EVIDENCE-1',
        status: 'existing-direct',
        testPath: 'tests/unit/example.test.ts',
        testName: 'covers the behavior',
      }),
    ];
    const report = summarizeEvidence(events, 'task-1');
    const summary = formatEvidenceSummary(report, { focused: 'passed', acceptance: 'pending' });

    expect(summary.split('\n')).toHaveLength(1);
    expect(summary).toContain('1 behavioral change was identified');
    expect(summary).toContain('No judgment of overall suite sufficiency is made here.');
    expect(summary).not.toMatch(/comprehensive|adequate|fully covered/i);
  });
});
