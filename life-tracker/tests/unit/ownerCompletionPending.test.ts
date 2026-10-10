import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readOwnerCompletionPending, markOwnerCompletionPending,
  restoreOwnerCompletionPending, pendingOwnerCompletionIds,
  acknowledgeOwnerCompletionSent, rejectOwnerCompletionPending,
  clearOwnerCompletionPending,
} from '../../src/lib/ownerCompletionPending';

describe('shared owner completion presentation receipts', () => {
  const data = new Map<string, string>();
  beforeEach(() => {
    data.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); },
    });
  });

  it('uses only account-scoped, durable local metadata (not an outgoing command)', () => {
    markOwnerCompletionPending('owner_a', 'task_1', true, '2026-10-10T09:00:00.000Z');
    expect(pendingOwnerCompletionIds('owner_a')).toEqual(new Set(['task_1']));
    expect(pendingOwnerCompletionIds('owner_b')).toEqual(new Set());
    expect(readOwnerCompletionPending('owner_a')).toEqual([{
      taskId: 'task_1', completed: true, updatedAt: '2026-10-10T09:00:00.000Z',
    }]);
    clearOwnerCompletionPending('owner_a');
    expect(pendingOwnerCompletionIds('owner_a')).toEqual(new Set());
  });

  it('does not mistake an old sent$ event for a newer opposite completion intent', () => {
    markOwnerCompletionPending('owner_a', 'task_1', true, '2026-10-10T09:00:00.000Z');
    const previous = markOwnerCompletionPending('owner_a', 'task_1', false, '2026-10-10T09:01:00.000Z');
    expect(previous?.completed).toBe(true);
    acknowledgeOwnerCompletionSent('owner_a', {
      id: 'task_1', userId: 'owner_a', completed: true,
      updatedAt: '2026-10-10T09:00:00.000Z',
    });
    expect(pendingOwnerCompletionIds('owner_a').has('task_1')).toBe(true);
    acknowledgeOwnerCompletionSent('owner_a', {
      id: 'task_1', userId: 'owner_a', completed: false,
      updatedAt: '2026-10-10T09:01:00.000Z',
    });
    expect(pendingOwnerCompletionIds('owner_a')).toEqual(new Set());
  });

  it('restores a prior pending intention if a local patch fails', () => {
    markOwnerCompletionPending('owner_a', 'task_1', true, '2026-10-10T09:00:00.000Z');
    const previous = markOwnerCompletionPending('owner_a', 'task_1', false, '2026-10-10T09:01:00.000Z');
    restoreOwnerCompletionPending('owner_a', 'task_1', previous);
    expect(readOwnerCompletionPending('owner_a')).toMatchObject([{ completed: true }]);
  });

  it('clears pending without confirmation after a conflict and keeps other tasks', () => {
    markOwnerCompletionPending('owner_a', 'task_1', true, '2026-10-10T09:00:00.000Z');
    markOwnerCompletionPending('owner_a', 'task_2', true, '2026-10-10T09:00:01.000Z');
    rejectOwnerCompletionPending('owner_a', 'task_1');
    expect(pendingOwnerCompletionIds('owner_a')).toEqual(new Set(['task_2']));
  });

  it('refuses malformed or oversized caches instead of claiming delivery', () => {
    data.set('mosaic_shared_owner_completion_v1:owner_a', JSON.stringify([{ taskId: '__bad', completed: true, updatedAt: 'invalid' }]));
    expect(pendingOwnerCompletionIds('owner_a')).toEqual(new Set());
  });
});
