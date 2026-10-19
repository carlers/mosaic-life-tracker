import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue([]),
  changed: vi.fn(),
  subscribed: vi.fn(() => () => {}),
  delivered: vi.fn(() => () => {}),
}));
vi.mock('../../src/lib/backendCapabilities', () => ({
  hasCapability: (capability: string) => capability !== 'sharedTasks',
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'synthetic_owner_a' } }),
}));
vi.mock('../../src/hooks/useConnectivity', () => ({
  useConnectivity: () => ({ status: 'online' }),
}));
vi.mock('../../src/lib/taskShareQueue', () => ({
  changeSharedTaskMembership: mocks.changed,
  enqueueSharedCompletion: vi.fn(),
  flushSharedCompletions: vi.fn(),
  enqueueSharedMembership: vi.fn(),
  flushSharedMemberships: vi.fn(),
  pendingSharedMembership: vi.fn(),
  listSharedTasks: mocks.list,
  pendingSharedCompletion: vi.fn(),
  readSharedCompletionFailures: vi.fn(() => []),
  acknowledgeSharedCompletionFailures: vi.fn(),
  subscribeSharedTaskQueue: mocks.subscribed,
  subscribeSharedTaskSettlements: mocks.delivered,
}));

import { useSharedTasks, writeSharedTaskCache } from '../../src/hooks/useSharedTasks';

describe('core-only social-data suppression (#1026 / #1027)', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('does not surface cached social membership or perform any remote reads', () => {
    writeSharedTaskCache('synthetic_owner_a', 'received', [{
      id: 'synthetic_share', ownerId: 'synthetic_friend', taskId: 'task_x',
      title: 'private peer task', date: '2026-10-19', completed: false,
      status: 'accepted', grantEpoch: '1', membershipRevision: '1',
      completionRevision: '1',
    }]);
    const { result } = renderHook(() => useSharedTasks('received'));
    expect(result.current.items).toEqual([]);
    expect(result.current.activeItems).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.pendingFor('task_x')).toBeUndefined();
    expect(result.current.pendingMembershipFor('task_x')).toBeUndefined();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.subscribed).not.toHaveBeenCalled();
    expect(mocks.delivered).not.toHaveBeenCalled();
  });

  it('denies feature-disabled mutation handlers without dispatching commands', async () => {
    const { result } = renderHook(() => useSharedTasks('owned'));
    await expect(result.current.invite('task_x', 'synthetic_friend'))
      .rejects.toThrow('Shared tasks unavailable');
    await expect(result.current.updateMembership({
      id: 'share_1', taskId: 'task_x', ownerId: 'synthetic_owner_a',
      status: 'accepted', grantEpoch: '1',
    } as never, 'revoke')).rejects.toThrow('Shared tasks unavailable');
    await expect(result.current.updateCompletion({
      id: 'share_1', taskId: 'task_x', ownerId: 'synthetic_owner_a',
      status: 'accepted', grantEpoch: '1',
    } as never, true)).rejects.toThrow('Shared-task membership unavailable');
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.changed).not.toHaveBeenCalled();
  });
});
