import { formatRunLine } from '../../scripts/lib/workflow-metrics.mjs';

describe('workflow evidence handoff summary', () => {
  // Regression: AGENTS.md — Rolling handoff
  it('includes compact evidence completion when behaviors were declared', () => {
    const line = formatRunLine({
      taskId: 'task-1',
      acceptanceStatus: 'pending',
      acceptanceAttempts: 0,
      loops: { v: 0, i: 0 },
      retries: { f: 0, u: 0 },
      cadence: null,
      tokens: {
        exact: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, receipts: 0 },
        estimated: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, receipts: 0 },
        unavailable: 0,
      },
      evidence: { declared: 3, documented: 2 },
    });

    expect(line).toContain('evidence=2/3');
  });
});
