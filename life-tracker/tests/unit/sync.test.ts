import { describe, it, expect, beforeEach, vi } from 'vitest';
// localStorage must exist before src/db/sync.ts is imported: the module
// reads localStorage.getItem('lastSyncTime') at module-evaluation time.
// vi.hoisted runs before both vi.mock factories and ES imports, so this
// assignment is guaranteed to land first.
const localStorageMock = vi.hoisted(() => {
  const store = new Map<string, string>();
  const mock = {
    getItem: (k: string) => (store.has(k) ? store.get(k) ?? null : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
  (globalThis as unknown as { localStorage: typeof mock }).localStorage = mock;
  return mock;
});
const accountGetMock = vi.hoisted(() => vi.fn());
const listRowsMock = vi.hoisted(() => vi.fn());
const getDatabaseMock = vi.hoisted(() => vi.fn());
vi.mock('appwrite', () => ({
  Query: {
    equal: (k: string, v: unknown) => ({ op: 'equal', k, v }),
    limit: (n: number) => ({ op: 'limit', n }),
    orderAsc: (f: string) => ({ op: 'orderAsc', f }),
    greaterThan: (k: string, v: unknown) => ({ op: 'greaterThan', k, v }),
    cursorAfter: (id: string) => ({ op: 'cursorAfter', id }),
  },
  Permission: {
    read: (r: string) => `read("${r}")`,
    update: (r: string) => `update("${r}")`,
    delete: (r: string) => `delete("${r}")`,
  },
  Role: {
    user: (id: string) => `user:${id}`,
  },
}));
vi.mock('../../src/lib/sdk', () => ({
  guardedAccount: {
    get: accountGetMock,
  },
  guardedTablesDB: {
    listRows: listRowsMock,
    updateRow: vi.fn(),
    upsertRow: vi.fn(),
  },
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: getDatabaseMock,
}));
import {
  initializeSync,
  forceSync,
  getSyncStatus,
  subscribeToSyncStatus,
} from '../../src/db/sync';
function makeDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
function makeEmptyCollection() {
  return {
    findOne: () => ({ exec: async () => null }),
    find: () => ({ exec: async () => [] }),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
}
function makeDb() {
  return {
    tasks: makeEmptyCollection(),
    categories: makeEmptyCollection(),
    diary: makeEmptyCollection(),
    settings: makeEmptyCollection(),
    friendships: makeEmptyCollection(),
    messages: makeEmptyCollection(),
  };
}
let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  localStorageMock.clear();
  accountGetMock.mockReset();
  listRowsMock.mockReset();
  getDatabaseMock.mockReset();
  getDatabaseMock.mockReturnValue(makeDb());
  listRowsMock.mockResolvedValue({ rows: [] });
  accountGetMock.mockResolvedValue({ $id: 'user_A' });
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});
describe('sync — listener isolation', () => {
  it('a throwing status listener does not prevent initializeSync from completing', async () => {
    const unsubscribe = subscribeToSyncStatus(() => {
      throw new Error('listener boom');
    });
    await expect(initializeSync()).resolves.toBeUndefined();
    unsubscribe();
    expect(getSyncStatus().isSyncing).toBe(false);
    const messages = errorSpy.mock.calls.map((args) => String(args[0]));
    expect(
      messages.some((m) => m.includes('Status listener threw'))
    ).toBe(true);
  });
  it('does not leave isSyncInProgress stuck when a listener throws', async () => {
    const unsubscribe = subscribeToSyncStatus(() => {
      throw new Error('listener boom');
    });
    await initializeSync();
    unsubscribe();
    accountGetMock.mockClear();
    await initializeSync();
    // If isSyncInProgress had been left at true, the second call would
    // early-return before resolveAuthenticatedUserId, and account.get()
    // would never be invoked again.
    expect(accountGetMock).toHaveBeenCalledTimes(1);
  });
  it('a listener that throws on initial subscribe does not crash the subscriber', () => {
    expect(() =>
      subscribeToSyncStatus(() => {
        throw new Error('subscribe boom');
      })
    ).not.toThrow();
    const messages = errorSpy.mock.calls.map((args) => String(args[0]));
    expect(
      messages.some((m) => m.includes('Status listener threw on subscribe'))
    ).toBe(true);
  });
});
describe('sync — forceSync follow-up queueing', () => {
  it('runs a follow-up when forceSync is called during an in-flight sync', async () => {
    const firstGet = makeDeferred<{ $id: string }>();
    accountGetMock.mockReturnValueOnce(firstGet.promise);
    accountGetMock.mockResolvedValue({ $id: 'user_A' });
    const first = initializeSync();
    // Yield a microtask so initializeSync reaches its awaited account.get.
    await Promise.resolve();
    await forceSync();
    // The in-flight call holds isSyncInProgress; the second call must have
    // been queued, not dropped. No second account.get has fired yet.
    expect(accountGetMock).toHaveBeenCalledTimes(1);
    firstGet.resolve({ $id: 'user_A' });
    await first;
    // Allow the queued microtask to run.
    await new Promise((r) => setTimeout(r, 0));
    expect(accountGetMock).toHaveBeenCalledTimes(2);
  });
  it('does not queue a follow-up when initializeSync is blocked by backoff', async () => {
    // Prime per-collection state with a clean first run.
    await initializeSync();
    accountGetMock.mockClear();
    // Force a single 429 on the first listRows call of the next cycle.
    const rateLimitErr = Object.assign(new Error('rate limit'), {
      code: 429,
    });
    listRowsMock.mockRejectedValueOnce(rateLimitErr);
    await initializeSync();
    expect(getSyncStatus().errors.length).toBeGreaterThan(0);
    // Immediately retry via forceSync. Backoff should reject the second
    // call without queueing a follow-up: account.get() must not fire.
    accountGetMock.mockClear();
    await forceSync();
    expect(accountGetMock).not.toHaveBeenCalled();
  });
});
