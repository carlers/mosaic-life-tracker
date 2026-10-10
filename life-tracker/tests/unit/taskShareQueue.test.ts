import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendAction = vi.hoisted(() => vi.fn());
const connectivity = vi.hoisted(() => ({ status: 'offline' }));

vi.mock('../../src/lib/appAction', () => ({ sendAppAction: sendAction }));
vi.mock('../../src/lib/connectivity', () => ({ getConnectivitySnapshot: () => connectivity }));

import {
  scopeSharedTaskQueue, enqueueSharedCompletion, flushSharedCompletions,
  pendingSharedCompletion, clearSharedCompletionQueue, readSharedCompletionFailures,
  subscribeSharedTaskSettlements, enqueueSharedMembership,
  pendingSharedMembership, flushSharedMemberships,
  type SharedTaskItem,
} from '../../src/lib/taskShareQueue';

function item(overrides: Partial<SharedTaskItem> = {}): SharedTaskItem {
  return {
    id: 'shr_test', taskId: 'task_1', ownerId: 'user_a',
    title: 'Shared', date: '2026-10-10', status: 'accepted',
    completed: false, completionRevision: 'version1',
    membershipRevision: 'membership1', grantEpoch: 'epoch1', ...overrides,
  };
}

describe('durable shared-task completion queue', () => {
  const data = new Map<string, string>();
  beforeEach(() => {
    data.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); },
    });
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal('navigator', { locks: undefined });
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-2222-4333-8444-555555555555' });
    scopeSharedTaskQueue('user_b');
    connectivity.status = 'offline';
    sendAction.mockReset();
  });

  it('persists a desired state but does not dispatch while offline', async () => {
    const command = enqueueSharedCompletion('user_b', item(), true);
    expect(command.operationId).toMatch(/^cmd_[a-f0-9]{32}$/);
    expect(pendingSharedCompletion('user_b', 'task_1')?.completed).toBe(true);
    expect(await flushSharedCompletions('user_b')).toEqual([
      { operationId: command.operationId, status: 'pending' },
    ]);
    expect(sendAction).not.toHaveBeenCalled();
  });

  it('refuses a second pending toggle and an unaccepted invitation', () => {
    enqueueSharedCompletion('user_b', item(), true);
    expect(() => enqueueSharedCompletion('user_b', item(), false)).toThrow(/already pending/);
    expect(() => enqueueSharedCompletion('user_b', item({ status: 'pending', taskId: 'task_2' }), true))
      .toThrow(/membership is not ready/);
  });

  it('does not replay a previous account command after switching accounts', async () => {
    enqueueSharedCompletion('user_b', item(), true);
    scopeSharedTaskQueue('user_c');
    connectivity.status = 'online';
    expect(await flushSharedCompletions('user_b')).toEqual([]);
    expect(sendAction).not.toHaveBeenCalled();
  });

  it('acknowledges an idempotent server result and clears the durable command', async () => {
    const command = enqueueSharedCompletion('user_b', item(), true);
    const settled = vi.fn();
    const unsubscribe = subscribeSharedTaskSettlements(settled);
    connectivity.status = 'online';
    sendAction.mockResolvedValue({ ok: true, item: { taskId: 'task_1' } });
    expect(await flushSharedCompletions('user_b')).toEqual([
      { operationId: command.operationId, status: 'confirmed' },
    ]);
    expect(pendingSharedCompletion('user_b', 'task_1')).toBeUndefined();
    expect(settled).toHaveBeenCalledWith({ userId: 'user_b', operationId: command.operationId, status: 'confirmed' });
    unsubscribe();
    expect(sendAction).toHaveBeenCalledWith(expect.objectContaining({
      operationId: command.operationId, completed: true,
      expectedRevision: 'version1', grantEpoch: 'epoch1',
    }));
  });

  it('surfaces stale revisions and never automatically rebases the intended action', async () => {
    enqueueSharedCompletion('user_b', item(), true);
    connectivity.status = 'online';
    sendAction.mockRejectedValue(Object.assign(new Error('Conflict'), { code: 409 }));
    const result = await flushSharedCompletions('user_b');
    expect(result[0].status).toBe('rejected');
    expect(result[0].reason).toMatch(/Refresh and retry/);
    expect(pendingSharedCompletion('user_b', 'task_1')).toBeUndefined();
    expect(sendAction).toHaveBeenCalledTimes(1);
    expect(readSharedCompletionFailures('user_b')).toMatchObject([{ taskId: 'task_1',
      reason: 'Completion changed. Refresh and retry.' }]);
    expect(readSharedCompletionFailures('user_a')).toEqual([]);
  });

  it('keeps a timed-out dispatch for replay with the same operation ID', async () => {
    const command = enqueueSharedCompletion('user_b', item(), true);
    connectivity.status = 'online';
    sendAction.mockRejectedValue(new Error('Timed out'));
    expect((await flushSharedCompletions('user_b'))[0].status).toBe('pending');
    expect(pendingSharedCompletion('user_b', 'task_1')?.operationId).toBe(command.operationId);
    expect(pendingSharedCompletion('user_b', 'task_1')?.attempts).toBe(1);
  });

  it('reports storage failure instead of pretending to queue', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw Error('quota'); } });
    expect(() => enqueueSharedCompletion('user_b', item(), true)).toThrow('quota');
  });

  it('purges only the designated account and invalidates in-flight generations', () => {
    enqueueSharedCompletion('user_b', item(), true);
    clearSharedCompletionQueue('user_b');
    expect(pendingSharedCompletion('user_b', 'task_1')).toBeUndefined();
  });
  it('queues an invitation acceptance while offline using the observed grant epoch', async () => {
    const pending = item({ status: 'pending' });
    const command = enqueueSharedMembership('user_b', pending, 'accept');
    expect(command.operationId).toMatch(/^mbr_[a-f0-9]{32}$/);
    expect(pendingSharedMembership('user_b', 'task_1')?.grantEpoch).toBe('epoch1');
    expect(await flushSharedMemberships('user_b')).toEqual([
      { operationId: command.operationId, status: 'pending' },
    ]);
    expect(sendAction).not.toHaveBeenCalled();
  });

  it('sends offline invitation acceptance exactly once and clears a confirmed retry', async () => {
    const command = enqueueSharedMembership('user_b', item({ status: 'pending' }), 'accept');
    connectivity.status = 'online';
    sendAction.mockResolvedValue({ ok: true, duplicate: true, item: { taskId: 'task_1' } });
    expect(await flushSharedMemberships('user_b')).toEqual([
      { operationId: command.operationId, status: 'confirmed' },
    ]);
    expect(sendAction).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'accept', operationId: command.operationId, grantEpoch: 'epoch1',
    }));
    expect(pendingSharedMembership('user_b', 'task_1')).toBeUndefined();
  });

  it('does not replay queued invitation actions after an account switch', async () => {
    enqueueSharedMembership('user_b', item({ status: 'pending' }), 'decline');
    scopeSharedTaskQueue('user_c');
    connectivity.status = 'online';
    expect(await flushSharedMemberships('user_b')).toEqual([]);
    expect(sendAction).not.toHaveBeenCalled();
  });

  it('rejects changed invitation epochs without unsafe rebasing', async () => {
    enqueueSharedMembership('user_b', item({ status: 'pending' }), 'accept');
    connectivity.status = 'online';
    sendAction.mockRejectedValue(Object.assign(new Error('Invitation changed'), { code: 409 }));
    const result = await flushSharedMemberships('user_b');
    expect(result[0]).toMatchObject({ status: 'rejected', reason: 'Invitation changed. Refresh and retry.' });
    expect(pendingSharedMembership('user_b', 'task_1')).toBeUndefined();
    expect(readSharedCompletionFailures('user_b').at(-1)?.reason).toBe('Invitation changed. Refresh and retry.');
  });

});
