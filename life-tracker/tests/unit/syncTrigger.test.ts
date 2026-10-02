import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initializeSyncMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../src/db/sync', () => ({
  initializeSync: initializeSyncMock,
}));

import {
  __resetLocalMutationSyncForTests,
  requestSyncAfterLocalMutation,
} from '../../src/lib/syncTrigger';

beforeEach(() => {
  vi.useFakeTimers();
  initializeSyncMock.mockReset();
  initializeSyncMock.mockResolvedValue(undefined);
  __resetLocalMutationSyncForTests();
});

afterEach(() => {
  __resetLocalMutationSyncForTests();
  vi.useRealTimers();
});

describe('syncTrigger', () => {
  it('debounces repeated local mutations for the same user into one sync', async () => {
    requestSyncAfterLocalMutation('user_A');
    requestSyncAfterLocalMutation('user_A');
    requestSyncAfterLocalMutation('user_A');

    await vi.advanceTimersByTimeAsync(299);
    expect(initializeSyncMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();

    expect(initializeSyncMock).toHaveBeenCalledTimes(1);
    expect(initializeSyncMock).toHaveBeenCalledWith('user_A');
  });

  it('keeps mutation timers isolated by account', async () => {
    requestSyncAfterLocalMutation('user_A');
    requestSyncAfterLocalMutation('user_B');

    await vi.advanceTimersByTimeAsync(300);
    await Promise.resolve();

    expect(initializeSyncMock).toHaveBeenCalledTimes(2);
    expect(initializeSyncMock).toHaveBeenCalledWith('user_A');
    expect(initializeSyncMock).toHaveBeenCalledWith('user_B');
  });
});
