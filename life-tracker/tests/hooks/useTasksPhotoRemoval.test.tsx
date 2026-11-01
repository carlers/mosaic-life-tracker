import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';

const state = vi.hoisted(() => ({
  userId: 'owner_A',
  document: null as { incrementalModify: (modify: (current: TaskDocument) => TaskDocument) => Promise<TaskDocument> } | null,
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: state.userId ? { $id: state.userId } : null }),
}));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: () => ({data: [], isLoading: false}),
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({ tasks: {findOne: () => ({exec: async () => state.document})} }),
}));

import { useTasks } from '../../src/hooks/useTasks';

const task = (overrides: Partial<TaskDocument> = {}): TaskDocument => ({
  id: 'task_A', title: 'Test', userId: 'owner_A', isDeleted: false,
  categoryId: 'cat', completed: false, order: 1, date: '2026-11-01',
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
  image: 'img_original', visibility: 'private', memo: '', ...overrides,
});

function setup(current: TaskDocument) {
  let persisted = {...current};
  const incrementalModify = vi.fn(async (modify: (latest: TaskDocument) => TaskDocument) => {
    const modified = modify({...persisted});
    persisted = modified;
    return modified;
  });
  state.document = { incrementalModify };
  return { incrementalModify, get: () => persisted,
    overwrite: (fields: Partial<TaskDocument>) => { persisted = {...persisted, ...fields}; } };
}

describe('task photo detachment — non-destructive local reference change', () => {
  beforeEach(() => { state.userId = 'owner_A'; state.document = null; });

  it('detaches the expected owner photo without deleting bytes or other task fields', async () => {
    const document = setup(task());
    const { result } = renderHook(() => useTasks());
    await act(async () => result.current.removeTaskPhoto('task_A', 'img_original'));
    expect(document.incrementalModify).toHaveBeenCalledTimes(1);
    expect(document.get()).toMatchObject({
      userId: 'owner_A', title: 'Test', image: '', categoryId: 'cat', isDeleted: false,
    });
    expect(document.get().updatedAt).not.toBe('2026-11-01T00:00:00Z');
  });

  it('preserves the newer photo when a concurrent upload replaces the old reference', async () => {
    const document = setup(task());
    document.overwrite({image: 'img_new'});
    const { result } = renderHook(() => useTasks());
    await expect(result.current.removeTaskPhoto('task_A', 'img_original'))
      .rejects.toThrow('Task photo changed');
    expect(document.get().image).toBe('img_new');
  });

  it('rejects foreign, deleted, unauthenticated and absent tasks without updates', async () => {
    const document = setup(task({userId: 'other'}));
    const { result } = renderHook(() => useTasks());
    await expect(result.current.removeTaskPhoto('task_A', 'img_original')).rejects.toThrow();
    expect(document.get().image).toBe('img_original');
    document.overwrite({userId: 'owner_A', isDeleted: true});
    await expect(result.current.removeTaskPhoto('task_A', 'img_original')).rejects.toThrow();
    expect(document.get().image).toBe('img_original');
    state.document = null;
    await expect(result.current.removeTaskPhoto('task_A', 'img_original'))
      .rejects.toThrow('Task is no longer available');
    state.userId = '';
    const other = renderHook(() => useTasks());
    await expect(other.result.current.removeTaskPhoto('task_A', 'img_original'))
      .rejects.toThrow('Cannot remove an unowned');
  });

  it('detaches a pending offline image reference without destroying the pending blob', async () => {
    const document = setup(task({image:'localimg_123'}));
    const { result } = renderHook(() => useTasks());
    await act(async () => result.current.removeTaskPhoto('task_A', 'localimg_123'));
    expect(document.get().image).toBe('');
  });
});
