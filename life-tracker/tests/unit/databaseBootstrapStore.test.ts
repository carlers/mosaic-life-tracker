import { beforeEach, describe, expect, it, vi } from 'vitest';

const initializeDatabaseWithRetryMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/db/database', () => ({
  initializeDatabaseWithRetry: initializeDatabaseWithRetryMock,
}));

import {
  getDatabaseBootstrapSnapshot,
  resetDatabaseBootstrapForTests,
  retryDatabaseBootstrap,
  startDatabaseBootstrap,
} from '../../src/lib/databaseBootstrap';

describe('databaseBootstrap', () => {
  beforeEach(() => {
    initializeDatabaseWithRetryMock.mockReset();
    resetDatabaseBootstrapForTests();
  });

  it('shares one in-flight database open across callers', async () => {
    let resolve!: () => void;
    initializeDatabaseWithRetryMock.mockReturnValueOnce(
      new Promise<void>((done) => {
        resolve = done;
      })
    );

    const first = startDatabaseBootstrap();
    const second = startDatabaseBootstrap();

    expect(first).toBe(second);
    expect(getDatabaseBootstrapSnapshot().state).toBe('loading');
    await vi.waitFor(() =>
      expect(initializeDatabaseWithRetryMock).toHaveBeenCalledTimes(1)
    );

    resolve();
    await first;
    expect(getDatabaseBootstrapSnapshot()).toEqual({
      state: 'ready',
      error: null,
    });
  });

  it('surfaces failure but allows an explicit retry', async () => {
    initializeDatabaseWithRetryMock
      .mockRejectedValueOnce(new Error('indexeddb blocked'))
      .mockResolvedValueOnce(undefined);

    await expect(startDatabaseBootstrap()).rejects.toThrow('indexeddb blocked');
    expect(getDatabaseBootstrapSnapshot()).toEqual({
      state: 'error',
      error: 'indexeddb blocked',
    });

    await expect(retryDatabaseBootstrap()).resolves.toBeUndefined();
    expect(getDatabaseBootstrapSnapshot().state).toBe('ready');
    expect(initializeDatabaseWithRetryMock).toHaveBeenCalledTimes(2);
  });
});
