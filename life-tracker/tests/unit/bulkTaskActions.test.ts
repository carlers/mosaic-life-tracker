import { describe, expect, it, vi } from 'vitest';
import { runBulkTaskActions } from '../../src/components/home/views/bulkTaskActions';

const tasks = [{ id: 'task_a' }, { id: 'task_b' }, { id: 'task_c' }];

describe('selected-task bulk operation semantics', () => {
  it('settles all writes and keeps only failed IDs for retry', async () => {
    const calls: string[] = [];
    const write = vi.fn(async (task: { id: string }) => {
      calls.push(task.id);
      if (task.id === 'task_b') throw new Error('failed');
    });
    const failed = await runBulkTaskActions(tasks, write);
    expect(calls).toEqual(['task_a', 'task_b', 'task_c']);
    expect(failed).toEqual(new Set(['task_b']));
    expect(write).toHaveBeenCalledTimes(3);
  });

  it('returns an empty selection after total success or an empty batch', async () => {
    const write = vi.fn(async () => undefined);
    expect(await runBulkTaskActions(tasks, write)).toEqual(new Set());
    expect(await runBulkTaskActions([], write)).toEqual(new Set());
    expect(write).toHaveBeenCalledTimes(3);
  });

  it('retains all failed IDs in original selection order', async () => {
    const failed = await runBulkTaskActions(tasks, async () => {
      throw new Error('offline');
    });
    expect([...failed]).toEqual(['task_a', 'task_b', 'task_c']);
  });
});
