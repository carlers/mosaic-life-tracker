import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';
import { useTasks } from '../../src/hooks/useTasks';

const state = vi.hoisted(() => ({
  userId: 'owner_A',
  rows: [] as Array<{ id: string; incrementalModify: (modify: (current: TaskDocument) => TaskDocument) => Promise<TaskDocument> }>,
  query: vi.fn(),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: state.userId ? { $id: state.userId } : null }),
}));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({
    tasks: {
      findByIds: (ids: string[]) => ({
        exec: async () => {
          state.query(ids);
          return new Map(state.rows.map(row => [row.id, row]));
        },
      }),
    },
  }),
}));

const task = (overrides: Partial<TaskDocument> = {}): TaskDocument => ({
  id: 'task_A',
  title: 'Batch task',
  userId: 'owner_A',
  isDeleted: false,
  categoryId: 'category_A',
  completed: false,
  order: 1,
  date: '2026-11-01',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  visibility: '',
  memo: '',
  image: '',
  ...overrides,
});

function makeDocument(overrides: Partial<TaskDocument> = {}) {
  let current = task(overrides);
  const incrementalModify = vi.fn(async (modify: (latest: TaskDocument) => TaskDocument) => {
    current = modify({ ...current });
    return current;
  });
  return {
    id: current.id,
    incrementalModify,
    get: () => current,
    replace: (next: Partial<TaskDocument>) => { current = { ...current, ...next }; },
  };
}

describe('useTasks.updateTasks — owner-scoped batched local writes', () => {
  beforeEach(() => {
    state.userId = 'owner_A';
    state.rows = [];
    state.query.mockReset();
  });

  it('uses one primary-key batch lookup and atomically updates every selected owner task', async () => {
    const first = makeDocument({ id: 'task_A' });
    const second = makeDocument({ id: 'task_B', visibility: 'public' });
    state.rows = [first, second];
    const { result } = renderHook(() => useTasks());
    const progress: Array<{ completed: number; total: number; failed: number }> = [];
    let failed = new Set<string>();

    await act(async () => {
      failed = await result.current.updateTasks(
        [{ id: 'task_A', date: '2026-11-01' }, { id: 'task_B', date: '2026-11-01' }, { id: 'task_A', date: '2026-11-01' }],
        { date: '2026-11-12' },
        value => progress.push(value)
      );
    });

    expect(state.query).toHaveBeenCalledTimes(1);
    expect(state.query).toHaveBeenCalledWith(['task_A', 'task_B']);
    expect(first.incrementalModify).toHaveBeenCalledTimes(1);
    expect(second.incrementalModify).toHaveBeenCalledTimes(1);
    expect(first.get()).toMatchObject({ date: '2026-11-12', title: 'Batch task', isDeleted: false });
    expect(second.get()).toMatchObject({ date: '2026-11-12', visibility: 'public' });
    expect(failed).toEqual(new Set());
    expect(progress[0]).toEqual({ completed: 0, total: 2, failed: 0 });
    expect(progress[progress.length - 1]).toEqual({ completed: 2, total: 2, failed: 0 });
  });

  it('retains missing and concurrently re-owned tasks as failures without changing them', async () => {
    const valid = makeDocument({ id: 'task_A' });
    const foreign = makeDocument({ id: 'task_B', userId: 'owner_B' });
    state.rows = [valid, foreign];
    const { result } = renderHook(() => useTasks());
    let failed = new Set<string>();

    await act(async () => {
      failed = await result.current.updateTasks(
        [{ id: 'task_A', date: '2026-11-01' }, { id: 'task_B', date: '2026-11-01' }, { id: 'task_C', date: '2026-11-01' }],
        { visibility: 'private' }
      );
    });

    expect(valid.get().visibility).toBe('private');
    expect(foreign.get().visibility).toBe('');
    expect(failed).toEqual(new Set(['task_B', 'task_C']));
  });

  it('rejects a stale date snapshot without modifying an externally moved task', async () => {
    const document = makeDocument({ id: 'task_A', date: '2026-11-02' });
    state.rows = [document];
    const { result } = renderHook(() => useTasks());
    let failed = new Set<string>();

    await act(async () => {
      failed = await result.current.updateTasks(
        [{ id: 'task_A', date: '2026-11-01' }],
        { date: '2026-11-12' }
      );
    });

    expect(failed).toEqual(new Set(['task_A']));
    expect(document.get().date).toBe('2026-11-02');
  });

  it('uses the same safe batch path for selected-task deletion', async () => {
    const document = makeDocument({ id: 'task_A' });
    state.rows = [document];
    const { result } = renderHook(() => useTasks());

    await act(async () => {
      await result.current.updateTasks([{ id: 'task_A', date: '2026-11-01' }], { isDeleted: true });
    });

    expect(document.get()).toMatchObject({
      id: 'task_A',
      isDeleted: true,
      title: 'Batch task',
      date: '2026-11-01',
    });
  });

  it('fails closed without an authenticated owner and performs no database query', async () => {
    state.userId = '';
    const { result } = renderHook(() => useTasks());
    let failed = new Set<string>();

    await act(async () => {
      failed = await result.current.updateTasks([{ id: 'task_A', date: '2026-11-01' }], { date: '2026-11-12' });
    });

    expect(failed).toEqual(new Set(['task_A']));
    expect(state.query).not.toHaveBeenCalled();
  });
});
