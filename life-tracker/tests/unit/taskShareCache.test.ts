import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSharedTaskCache, readSharedTaskCache, writeSharedTaskCache }
  from '../../src/hooks/useSharedTasks';
import type { SharedTaskItem } from '../../src/lib/taskShareQueue';

const sample: SharedTaskItem = {
  id: 'shr_1', taskId: 'task_1', ownerId: 'owner_A',
  title: 'Only user B may see this', date: '2026-10-10',
  completed: false, completionRevision: 'server_a',
  membershipRevision: 'membership_a', grantEpoch: 'epoch_a',
  status: 'accepted',
};

describe('shared-task projection cache isolation', () => {
  const data = new Map<string, string>();
  beforeEach(() => {
    data.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); },
    });
  });

  it('isolates a recipient cache across different signed-in accounts', () => {
    writeSharedTaskCache('user_B', 'received', [sample]);
    expect(readSharedTaskCache('user_C', 'received')).toEqual([]);
    expect(readSharedTaskCache('user_B', 'received')).toEqual([sample]);
    expect(readSharedTaskCache('user_B', 'owned')).toEqual([]);
  });

  it('serializes only the strict participant projection and removes it on erasure', () => {
    const unsafe = { ...sample, memo: 'secret memo', image: 'private image',
      categoryId: 'private category', reactions: 'secret reactions' };
    writeSharedTaskCache('user_B', 'received', [unsafe]);
    const cached = readSharedTaskCache('user_B', 'received');
    expect(cached).toEqual([sample]);
    expect(JSON.stringify(cached)).not.toContain('secret');
    clearSharedTaskCache('user_B');
    expect(readSharedTaskCache('user_B', 'received')).toEqual([]);
  });

  it('fails closed on malformed storage rather than exposing unchecked task rows', () => {
    data.set('mosaic_shared_tasks_cache_v1:user_B:received',
      JSON.stringify([{ ...sample, title: 10 }]));
    expect(readSharedTaskCache('user_B', 'received')).toEqual([]);
  });
});
