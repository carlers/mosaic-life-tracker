import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
const updateRowMock = vi.hoisted(() => vi.fn());
const upsertRowMock = vi.hoisted(() => vi.fn());
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
    updateRow: updateRowMock,
    upsertRow: upsertRowMock,
  },
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: getDatabaseMock,
}));
type SyncModule = typeof import('../../src/db/sync');
let syncModule!: SyncModule;
let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
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
function makeTaskRow(id: string) {
  return {
    $id: id,
    user_id: 'user_A',
    $updatedAt: '2026-01-01T00:00:00.000Z',
    title: 'x',
    is_completed: false,
    category_id: '',
    date: '2026-01-01',
    memo: '',
    image: '',
    tags: '',
    source: '',
    routine_id: '',
    reminder_time: '',
    reactions: '',
    visibility: '',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    completed_at: '',
    deleted: false,
  };
}
function makeLocalDoc(id: string) {
  return {
    id,
    _meta: { lwt: Date.now() + 1_000_000 },
    toJSON: () => ({
      id,
      userId: 'user_A',
      title: `title-${id}`,
      completed: false,
      categoryId: '',
      date: '2026-01-01',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isDeleted: false,
      visibility: '',
    }),
    incrementalPatch: vi.fn(),
  };
}
beforeEach(async () => {
  vi.resetModules();
  syncModule = await import('../../src/db/sync');
  localStorageMock.clear();
  accountGetMock.mockReset();
  listRowsMock.mockReset();
  updateRowMock.mockReset();
  upsertRowMock.mockReset();
  getDatabaseMock.mockReset();
  getDatabaseMock.mockReturnValue(makeDb());
  listRowsMock.mockResolvedValue({ rows: [] });
  accountGetMock.mockResolvedValue({ $id: 'user_A' });
  updateRowMock.mockResolvedValue({});
  upsertRowMock.mockResolvedValue({});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});
describe('sync — listener isolation', () => {
  it('a throwing status listener does not prevent initializeSync from completing', async () => {
    const unsubscribe = syncModule.subscribeToSyncStatus(() => {
      throw new Error('listener boom');
    });
    await expect(syncModule.initializeSync()).resolves.toBeUndefined();
    unsubscribe();
    expect(syncModule.getSyncStatus().isSyncing).toBe(false);
    const messages = errorSpy.mock.calls.map((args) => String(args[0]));
    expect(messages.some((m) => m.includes('Status listener threw'))).toBe(
      true
    );
  });
  it('does not leave isSyncInProgress stuck when a listener throws', async () => {
    const unsubscribe = syncModule.subscribeToSyncStatus(() => {
      throw new Error('listener boom');
    });
    await syncModule.initializeSync();
    unsubscribe();
    accountGetMock.mockClear();
    await syncModule.initializeSync();
    expect(accountGetMock).toHaveBeenCalledTimes(1);
  });
  it('a listener that throws on initial subscribe does not crash the subscriber', () => {
    expect(() =>
      syncModule.subscribeToSyncStatus(() => {
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
    const first = syncModule.initializeSync();
    await Promise.resolve();
    await syncModule.forceSync();
    expect(accountGetMock).toHaveBeenCalledTimes(1);
    firstGet.resolve({ $id: 'user_A' });
    await first;
    await new Promise((r) => setTimeout(r, 0));
    expect(accountGetMock).toHaveBeenCalledTimes(2);
  });
  it('does not queue a follow-up when initializeSync is blocked by backoff', async () => {
    await syncModule.initializeSync();
    accountGetMock.mockClear();
    const rateLimitErr = Object.assign(new Error('rate limit'), {
      code: 429,
    });
    listRowsMock.mockRejectedValueOnce(rateLimitErr);
    await syncModule.initializeSync();
    expect(syncModule.getSyncStatus().errors.length).toBeGreaterThan(0);
    accountGetMock.mockClear();
    await syncModule.forceSync();
    expect(accountGetMock).not.toHaveBeenCalled();
  });
});
describe('sync — boundary advancement (F1, F3, F5)', () => {
  it('F1: after a successful cycle, dirty boundary equals cycle-start, not cycle-end', async () => {
    const observedFirstListRowsAt = { value: 0 };
    listRowsMock.mockImplementation(async () => {
      if (observedFirstListRowsAt.value === 0) {
        observedFirstListRowsAt.value = Date.now();
      }
      return { rows: [] };
    });
    await syncModule.initializeSync();
    const raw = localStorageMock.getItem('lastSyncTimePerCollection');
    expect(raw).toBeTruthy();
    const state = JSON.parse(raw!);
    const dirtyMs = new Date(state.entries.tasks.dirty).getTime();
    const pullMs = new Date(state.entries.tasks.pull).getTime();
    expect(dirtyMs).toBe(pullMs);
    expect(dirtyMs).toBeLessThanOrEqual(observedFirstListRowsAt.value);
  });
  it('F3: pull boundary is not advanced when a pull row fails to apply', async () => {
    const failingUpsert = vi.fn().mockRejectedValue(new Error('upsert boom'));
    getDatabaseMock.mockReturnValue({
      tasks: {
        findOne: () => ({ exec: async () => null }),
        find: () => ({ exec: async () => [] }),
        upsert: failingUpsert,
      },
      categories: makeEmptyCollection(),
      diary: makeEmptyCollection(),
      settings: makeEmptyCollection(),
      friendships: makeEmptyCollection(),
      messages: makeEmptyCollection(),
    });
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId === 'tasks') {
          return { rows: [makeTaskRow('task_x')] };
        }
        return { rows: [] };
      }
    );
    await syncModule.initializeSync();
    expect(failingUpsert).toHaveBeenCalledTimes(1);
    const raw = localStorageMock.getItem('lastSyncTimePerCollection');
    const state = JSON.parse(raw!);
    expect(state.entries.tasks.pull).toBe('');
  });
  it('F3: pull boundary is not advanced when a row-level error is thrown during apply', async () => {
    const findOneThrows = vi.fn().mockImplementation(() => ({
      exec: async () => {
        throw new Error('findOne boom');
      },
    }));
    getDatabaseMock.mockReturnValue({
      tasks: {
        findOne: findOneThrows,
        find: () => ({ exec: async () => [] }),
        upsert: vi.fn().mockResolvedValue(undefined),
      },
      categories: makeEmptyCollection(),
      diary: makeEmptyCollection(),
      settings: makeEmptyCollection(),
      friendships: makeEmptyCollection(),
      messages: makeEmptyCollection(),
    });
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId === 'tasks') {
          return { rows: [makeTaskRow('task_y')] };
        }
        return { rows: [] };
      }
    );
    await syncModule.initializeSync();
    const raw = localStorageMock.getItem('lastSyncTimePerCollection');
    const state = JSON.parse(raw!);
    expect(state.entries.tasks.pull).toBe('');
  });
  it('F5: a push failure on one row does not prevent later rows from being attempted', async () => {
    const docs = [makeLocalDoc('d1'), makeLocalDoc('d2'), makeLocalDoc('d3')];
    getDatabaseMock.mockReturnValue({
      tasks: {
        findOne: () => ({ exec: async () => null }),
        find: () => ({ exec: async () => docs }),
        upsert: vi.fn(),
      },
      categories: makeEmptyCollection(),
      diary: makeEmptyCollection(),
      settings: makeEmptyCollection(),
      friendships: makeEmptyCollection(),
      messages: makeEmptyCollection(),
    });
    updateRowMock.mockResolvedValueOnce({});
    updateRowMock.mockRejectedValueOnce(
      Object.assign(new Error('server boom'), { code: 500 })
    );
    updateRowMock.mockResolvedValueOnce({});
    await syncModule.initializeSync();
    expect(updateRowMock).toHaveBeenCalledTimes(3);
  });
  it('F5: a push failure leaves the dirty boundary at its previous value', async () => {
    await syncModule.initializeSync();
    const rawBefore = localStorageMock.getItem('lastSyncTimePerCollection');
    const dirtyBefore = JSON.parse(rawBefore!).entries.tasks.dirty;
    const docs = [makeLocalDoc('d_bad')];
    getDatabaseMock.mockReturnValue({
      tasks: {
        findOne: () => ({ exec: async () => null }),
        find: () => ({ exec: async () => docs }),
        upsert: vi.fn(),
      },
      categories: makeEmptyCollection(),
      diary: makeEmptyCollection(),
      settings: makeEmptyCollection(),
      friendships: makeEmptyCollection(),
      messages: makeEmptyCollection(),
    });
    updateRowMock.mockRejectedValueOnce(
      Object.assign(new Error('server boom'), { code: 500 })
    );
    await syncModule.initializeSync();
    const rawAfter = localStorageMock.getItem('lastSyncTimePerCollection');
    const dirtyAfter = JSON.parse(rawAfter!).entries.tasks.dirty;
    expect(dirtyAfter).toBe(dirtyBefore);
  });
  it('F5: a clean cycle still advances the dirty boundary', async () => {
    await syncModule.initializeSync();
    const rawBefore = localStorageMock.getItem('lastSyncTimePerCollection');
    const dirtyBefore = JSON.parse(rawBefore!).entries.tasks.dirty;
    await new Promise((r) => setTimeout(r, 5));
    await syncModule.initializeSync();
    const rawAfter = localStorageMock.getItem('lastSyncTimePerCollection');
    const dirtyAfter = JSON.parse(rawAfter!).entries.tasks.dirty;
    expect(new Date(dirtyAfter).getTime()).toBeGreaterThan(
      new Date(dirtyBefore).getTime()
    );
  });
});
