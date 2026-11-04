import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeCompletionFeedback } from '../../src/lib/completionFeedback';
import type { TaskDocument } from '../../src/db/schema';

const state = vi.hoisted(() => ({
  ownerId: 'owner_A',
  rows: [] as TaskDocument[],
  failPatch: false,
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: state.ownerId ? { $id: state.ownerId } : null }),
}));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({ tasks: {
    findOne: (id: string) => ({ exec: async () => {
      const row = state.rows.find(task => task.id === id);
      return row ? { ...row, patch: async (updates: Partial<TaskDocument>) => {
        if (state.failPatch) throw Error('local write failed');
        Object.assign(row, updates);
      } } : null;
    } }),
    find: () => ({ exec: async () => state.rows.map(task => ({ ...task })) }),
  } }),
}));
vi.mock('../../src/lib/ownerCompletionPending', () => ({
  hasCachedOwnedSharedTask: () => false,
  markOwnerCompletionPending: vi.fn(),
  restoreOwnerCompletionPending: vi.fn(),
}));

import { useTasks } from '../../src/hooks/useTasks';

function task(id: string, completed: boolean, date = '2026-11-04'): TaskDocument {
  return {
    id, title: id, userId: 'owner_A', date, completed,
    categoryId: 'cat', order: 1, isDeleted: false,
    createdAt: '2026-11-04T00:00:00Z', updatedAt: '2026-11-04T00:00:00Z',
  } as TaskDocument;
}

beforeEach(() => {
  state.ownerId = 'owner_A';
  state.rows = [];
  state.failPatch = false;
});

describe('local task-completion milestones', () => {
  it('emits a completed-day milestone after the last local task persists', async () => {
    state.rows = [task('earlier', true), task('last', false)];
    const events: string[] = [];
    const unsubscribe = subscribeCompletionFeedback(event => events.push(event.phase));
    const { result } = renderHook(() => useTasks());
    await act(async () => result.current.toggleTaskCompletion('last', true));
    await waitFor(() => expect(events).toEqual(['prepare', 'complete', 'day-complete']));
    expect(state.rows[1].completed).toBe(true);
    unsubscribe();
  });

  it('never emits a day milestone while another task is pending or for a backlog', async () => {
    state.rows = [task('first', false), task('last', false)];
    const events: string[] = [];
    const unsubscribe = subscribeCompletionFeedback(event => events.push(event.phase));
    const { result } = renderHook(() => useTasks());
    await act(async () => result.current.toggleTaskCompletion('first', true));
    await waitFor(() => expect(events).toContain('complete'));
    expect(events).not.toContain('day-complete');
    events.length = 0;
    state.rows = [task('backlog', false, '')];
    await act(async () => result.current.toggleTaskCompletion('backlog', true));
    await waitFor(() => expect(events).toContain('complete'));
    expect(events).not.toContain('day-complete');
    unsubscribe();
  });

  it('never celebrates a failed local write, an undo, or a no-op', async () => {
    state.rows = [task('last', false)];
    const events: string[] = [];
    const unsubscribe = subscribeCompletionFeedback(event => events.push(event.phase));
    const { result } = renderHook(() => useTasks());
    state.failPatch = true;
    await expect(result.current.toggleTaskCompletion('last', true)).rejects.toThrow('local write failed');
    expect(events).toEqual(['prepare']);
    state.failPatch = false;
    events.length = 0;
    await act(async () => result.current.toggleTaskCompletion('last', false));
    expect(events).toEqual([]);
    unsubscribe();
  });
});
