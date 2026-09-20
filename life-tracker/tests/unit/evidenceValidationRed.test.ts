import { createEvent } from '../../scripts/lib/workflow-metrics.mjs';

describe('workflow evidence validation', () => {
  // Regression: AGENTS.md — Definition of done
  it('rejects a declared behavior without its statement and requirement source', () => {
    expect(() => createEvent('behavior_declared', {
      taskId: 'task-1',
      behaviorId: 'EVIDENCE-1',
    })).toThrow(/statement and requirement/);
  });
});
