import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Signed provider isolation is incomplete if a stale local task/category ID
// can mutate a different cached account before the server sees the write.
const fixture = vi.hoisted(() => ({
  currentUserId: 'owner_a' as string | null,
  task: null as null | { id: string; userId: string; patch: (changes: unknown) => Promise<void> },
  categories: new Map<string, {
    id: string; userId: string; order: number; name: string; isDeleted: boolean;
    incrementalPatch: (changes: unknown) => Promise<void>;
  }>(),
  taskLookup: vi.fn(async () => null as null | { id: string; userId: string; patch: (changes: unknown) => Promise<void> }),
  categoryLookup: vi.fn(async (_id: string) => null as null | {
    id: string; userId: string; order: number; name: string; isDeleted: boolean;
    incrementalPatch: (changes: unknown) => Promise<void>;
  }),
  taskSiblings: vi.fn(async () => []),
  taskInsert: vi.fn(async () => {}),
  taskPatch: vi.fn(async () => {}),
  categoryPatch: vi.fn(async () => {}),
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: fixture.currentUserId ? { $id: fixture.currentUserId } : null }),
}));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({
    tasks: {
      findOne: () => ({ exec: () => fixture.taskLookup() }),
      find: () => ({ exec: () => fixture.taskSiblings() }),
      insert: fixture.taskInsert,
    },
    categories: { findOne: (id: string) => ({ exec: () => fixture.categoryLookup(id) }) },
  }),
}));

import { useTasks } from '../../src/hooks/useTasks';
import { useCategories } from '../../src/hooks/useCategories';

describe('local RxDB task/category owner mutation fences (#1027)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.currentUserId = 'owner_a';
    fixture.taskLookup.mockImplementation(async () => fixture.task);
    fixture.categoryLookup.mockImplementation(async id => fixture.categories.get(id) ?? null);
    fixture.task = { id: 'task_a', userId: 'owner_a', patch: fixture.taskPatch };
    fixture.categories.clear();
    fixture.categories.set('cat_a', {
      id: 'cat_a', userId: 'owner_a', order: 3, name: 'Before',
      isDeleted: false, incrementalPatch: fixture.categoryPatch,
    });
    fixture.categories.set('cat_b', {
      id: 'cat_b', userId: 'owner_b', order: 2, name: 'Other owner',
      isDeleted: false, incrementalPatch: fixture.categoryPatch,
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('refuses foreign cached task edits, completion and soft deletion', async () => {
    fixture.task = { id: 'task_b', userId: 'owner_b', patch: fixture.taskPatch };
    const { result } = renderHook(() => useTasks());
    await act(async () => {
      await expect(result.current.updateTask('task_b', { title: 'Leaked' }))
        .rejects.toThrow('another account');
      await expect(result.current.toggleTaskCompletion('task_b', true))
        .rejects.toThrow('another account');
      await expect(result.current.deleteTask('task_b'))
        .rejects.toThrow('another account');
    });
    expect(fixture.taskPatch).not.toHaveBeenCalled();
  });

  it('rejects attempts to rewrite task or category owner/primary ID', async () => {
    const tasks = renderHook(() => useTasks());
    const cats = renderHook(() => useCategories());
    await act(async () => {
      await expect(tasks.result.current.updateTask('task_a', { userId: 'owner_b' }))
        .rejects.toThrow('reassign task identity');
      await expect(tasks.result.current.updateTask('task_a', { id: 'task_other' }))
        .rejects.toThrow('reassign task identity');
      await expect(cats.result.current.updateCategory('cat_a', { userId: 'owner_b' }))
        .rejects.toThrow('reassign category identity');
      await expect(cats.result.current.updateCategory('cat_a', { id: 'cat_other' }))
        .rejects.toThrow('reassign category identity');
    });
    expect(fixture.taskPatch).not.toHaveBeenCalled();
    expect(fixture.categoryPatch).not.toHaveBeenCalled();
  });

  it('refuses to modify foreign category on edit or tombstone', async () => {
    const { result } = renderHook(() => useCategories());
    await act(async () => {
      await expect(result.current.updateCategory('cat_b', { name: 'Wrong' }))
        .rejects.toThrow('another account');
      await expect(result.current.deleteCategory('cat_b'))
        .rejects.toThrow('another account');
    });
    expect(fixture.categoryPatch).not.toHaveBeenCalled();
  });

  it('aborts a mixed-owner category drag before ANY queued write', async () => {
    const { result } = renderHook(() => useCategories());
    await act(async () => {
      await expect(result.current.reorderCategories([
        { id: 'cat_a' }, { id: 'cat_b' },
      ] as never)).rejects.toThrow('another account');
    });
    expect(fixture.categoryPatch).not.toHaveBeenCalled();
  });

  it('preserves ordinary same-owner task edit, category edit and category reorder', async () => {
    const tasks = renderHook(() => useTasks());
    const cats = renderHook(() => useCategories());
    await act(async () => {
      await tasks.result.current.updateTask('task_a', { title: 'Safe' });
      await cats.result.current.updateCategory('cat_a', { name: 'After' });
      await cats.result.current.reorderCategories([{ id: 'cat_a' }] as never);
    });
    expect(fixture.taskPatch).toHaveBeenCalledTimes(1);
    expect(fixture.categoryPatch).toHaveBeenCalledTimes(2);
  });

  it('rejects old task/category IDs after the mounted account changes', async () => {
    const tasks = renderHook(() => useTasks());
    const cats = renderHook(() => useCategories());
    fixture.currentUserId = 'owner_b';
    tasks.rerender();
    cats.rerender();
    await act(async () => {
      await expect(tasks.result.current.updateTask('task_a', { title: 'Stale' }))
        .rejects.toThrow('another account');
      await expect(cats.result.current.updateCategory('cat_a', { name: 'Stale' }))
        .rejects.toThrow('another account');
    });
    expect(fixture.taskPatch).not.toHaveBeenCalled();
    expect(fixture.categoryPatch).not.toHaveBeenCalled();
  });
  it('cancels a task edit when the owner changes during its awaited lookup', async () => {
    let release!: () => void;
    const paused = new Promise<void>(resolve => { release = resolve; });
    fixture.taskLookup.mockImplementationOnce(async () => {
      await paused;
      return fixture.task;
    });
    const tasks = renderHook(() => useTasks());
    const write = tasks.result.current.updateTask('task_a', { title: 'Stale edit' });
    fixture.currentUserId = 'owner_b';
    tasks.rerender();
    await act(async () => {
      release();
      await expect(write).rejects.toThrow('Account changed');
    });
    expect(fixture.taskPatch).not.toHaveBeenCalled();
  });

  it('cancels a category edit when the owner changes during its awaited lookup', async () => {
    let release!: () => void;
    const paused = new Promise<void>(resolve => { release = resolve; });
    fixture.categoryLookup.mockImplementationOnce(async id => {
      await paused;
      return fixture.categories.get(id) ?? null;
    });
    const cats = renderHook(() => useCategories());
    const write = cats.result.current.updateCategory('cat_a', { name: 'Stale edit' });
    fixture.currentUserId = 'owner_b';
    cats.rerender();
    await act(async () => {
      release();
      await expect(write).rejects.toThrow('Account changed');
    });
    expect(fixture.categoryPatch).not.toHaveBeenCalled();
  });

  it('cancels an already-queued category reorder after account switch without partial writes', async () => {
    let release!: () => void;
    const paused = new Promise<void>(resolve => { release = resolve; });
    fixture.categoryLookup.mockImplementationOnce(async id => {
      await paused;
      return fixture.categories.get(id) ?? null;
    });
    const cats = renderHook(() => useCategories());
    const write = cats.result.current.reorderCategories([{ id: 'cat_a' }] as never);
    fixture.currentUserId = 'owner_b';
    cats.rerender();
    await act(async () => {
      release();
      await expect(write).rejects.toThrow('Account changed');
    });
    expect(fixture.categoryPatch).not.toHaveBeenCalled();
  });

  it('blocks stale task callbacks after unmount and account switch during task creation', async () => {
    const tasks = renderHook(() => useTasks());
    const stale = tasks.result.current.updateTask;
    tasks.unmount();
    await expect(stale('task_a', { title: 'After unmount' }))
      .rejects.toThrow('Account changed');
    expect(fixture.taskPatch).not.toHaveBeenCalled();

    let release!: () => void;
    const paused = new Promise<void>(resolve => { release = resolve; });
    fixture.taskSiblings.mockImplementationOnce(async () => {
      await paused;
      return [];
    });
    const second = renderHook(() => useTasks());
    const create = second.result.current.addTask({
      title: 'Never insert', date: '2026-10-20', categoryId: 'cat_a',
    } as never);
    fixture.currentUserId = 'owner_b';
    second.rerender();
    await act(async () => {
      release();
      await expect(create).rejects.toThrow('Account changed');
    });
    expect(fixture.taskInsert).not.toHaveBeenCalled();
  });
});
