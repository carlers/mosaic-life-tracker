import { describe, expect, it, vi } from 'vitest';
import { runBulkTaskActions } from '../../src/components/home/views/bulkTaskActions';

const tasks = [{ id: 'task_a' }, { id: 'task_b' }, { id: 'task_c' }];

describe('selected-task bulk operation semantics', () => {
  it('settles every write and retains failed IDs in original selection order', async () => {
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

  it('settles synchronous validation failures and continues other tasks', async () => {
    const calls: string[] = [];
    const failed = await runBulkTaskActions(tasks, task => {
      calls.push(task.id);
      if (task.id === 'task_b') throw new Error('Invalid scheduled date');
      return Promise.resolve();
    });
    expect(calls).toEqual(['task_a', 'task_b', 'task_c']);
    expect(failed).toEqual(new Set(['task_b']));
  });

  it('returns an empty selection after total success or an empty batch', async () => {
    const write = vi.fn(async () => undefined);
    expect(await runBulkTaskActions(tasks, write)).toEqual(new Set());
    expect(await runBulkTaskActions([], write)).toEqual(new Set());
    expect(write).toHaveBeenCalledTimes(3);
  });

  it('caps concurrent writes and reports actual settled progress', async () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ id: 'task_' + index }));
    const progress: Array<{ completed: number; total: number; failed: number }> = [];
    let active = 0;
    let maxActive = 0;
    const failed = await runBulkTaskActions(many, async task => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        await Promise.resolve();
        if (task.id === 'task_7' || task.id === 'task_12') throw new Error('offline');
      } finally {
        active -= 1;
      }
    }, value => progress.push(value));

    expect(maxActive).toBe(6);
    expect(failed).toEqual(new Set(['task_7', 'task_12']));
    expect(progress[0]).toEqual({ completed: 0, total: 20, failed: 0 });
    expect(progress[progress.length - 1]).toEqual({ completed: 20, total: 20, failed: 2 });
    expect(progress).toHaveLength(21);
  });

  it('does not let a broken progress observer interrupt task writes', async () => {
    const write = vi.fn(async () => undefined);
    const failed = await runBulkTaskActions(tasks, write, () => {
      throw new Error('observer failure');
    });
    expect(failed.size).toBe(0);
    expect(write).toHaveBeenCalledTimes(3);
  });
});
