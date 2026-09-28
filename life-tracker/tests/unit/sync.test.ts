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
const createRowMock = vi.hoisted(() => vi.fn());
const getDatabaseMock = vi.hoisted(() => vi.fn());
const uploadPendingImageMock = vi.hoisted(() => vi.fn());
const deletePendingImageMock = vi.hoisted(() => vi.fn());
// Test fixture note: sync.ts reads `account` directly from '../../src/lib/appwrite'
// instead of going through guardedAccount. The appwrite SDK mock must
// therefore provide `Client` and `Account` so the real appwrite.ts module
// can construct them at import time. Query/Permission/Role stay because
// sync.ts imports them for query construction and row permissions.
vi.mock('appwrite', () => {
  class Client {
    setEndpoint(_url: string) {
      return this;
    }
    setProject(_id: string) {
      return this;
    }
  }
  class Account {
    async get() {
      return accountGetMock();
    }
    async deleteSession(_id: string) {
      return undefined;
    }
    async createEmailPasswordSession(_email: string, _password: string) {
      return undefined;
    }
  }
  return {
    Client,
    Account,
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
  };
});
vi.mock('../../src/lib/sdk', () => ({
  guardedAccount: {
    get: accountGetMock,
  },
  guardedTablesDB: {
    listRows: listRowsMock,
    updateRow: updateRowMock,
    upsertRow: upsertRowMock,
    createRow: createRowMock,
  },
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: getDatabaseMock,
}));
vi.mock('../../src/lib/storage', () => ({
  uploadPendingImage: uploadPendingImageMock,
}));
vi.mock('../../src/lib/pendingImages', () => ({
  isPendingImageId: (fileId: string) => fileId.startsWith('localimg_'),
  deletePendingImage: deletePendingImageMock,
}));
vi.mock('../../src/lib/connectivity', () => ({
  getConnectivitySnapshot: () => ({
    status: 'online',
    reason: 'sync-unit-test',
    lastConfirmedAt: '2026-01-01T00:00:00.000Z',
  }),
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
function makeRemoteTaskRow(id: string, updatedAt: string) {
  return {
    ...makeTaskRow(id),
    $updatedAt: updatedAt,
    updated_at: updatedAt,
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
function makeLocalDocWithLwt(id: string, lwt: number) {
  return {
    id,
    _meta: { lwt },
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
    incrementalPatch: vi.fn().mockResolvedValue(undefined),
  };
}
function makeMessageRow(id: string, direction: 'outgoing' | 'incoming') {
  return {
    $id: id,
    user_id: 'user_A',
    $updatedAt: '2026-01-01T00:00:00.000Z',
    thread_id: 'th_x',
    sender_id: 'user_A',
    recipient_id: 'user_B',
    direction,
    content: 'hi',
    task_ref_id: '',
    task_ref_title: '',
    task_ref_date: '',
    task_ref_color: '',
    reply_to_id: '',
    reply_to_content: '',
    reply_to_sender_id: '',
    is_unsent: false,
    original_message_id: id,
    reactions: '',
    read_at: '2026-06-01T00:00:00.000Z',
    delivery_status: 'delivered',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted: false,
  };
}
function makeLocalMessageDoc(
  id: string,
  direction: 'outgoing' | 'incoming',
  readAt: string
) {
  return {
    id,
    _meta: { lwt: Date.now() + 1_000_000 },
    toJSON: () => ({
      id,
      userId: 'user_A',
      threadId: 'th_x',
      senderId: 'user_A',
      recipientId: 'user_B',
      direction,
      content: 'hi',
      taskRefId: '',
      taskRefTitle: '',
      taskRefDate: '',
      taskRefColor: '',
      replyToId: '',
      replyToContent: '',
      replyToSenderId: '',
      isUnsent: false,
      originalMessageId: id,
      reactions: '',
      readAt,
      deliveryStatus: 'delivered',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isDeleted: false,
    }),
    incrementalPatch: vi.fn().mockResolvedValue(undefined),
  };
}
function makeTaskOnlyDb(tasks: {
  findOne: () => { exec: () => Promise<unknown> };
  find: () => { exec: () => Promise<unknown[]> };
  upsert: ReturnType<typeof vi.fn>;
}) {
  return {
    tasks,
    categories: makeEmptyCollection(),
    diary: makeEmptyCollection(),
    settings: makeEmptyCollection(),
    friendships: makeEmptyCollection(),
    messages: makeEmptyCollection(),
  };
}
function taskListRowsCalls() {
  return listRowsMock.mock.calls.filter(
    (c) => (c[0] as { tableId: string }).tableId === 'tasks'
  );
}
beforeEach(async () => {
  vi.resetModules();
  syncModule = await import('../../src/db/sync');
  localStorageMock.clear();
  accountGetMock.mockReset();
  listRowsMock.mockReset();
  updateRowMock.mockReset();
  upsertRowMock.mockReset();
  createRowMock.mockReset();
  getDatabaseMock.mockReset();
  uploadPendingImageMock.mockReset();
  deletePendingImageMock.mockReset();
  uploadPendingImageMock.mockResolvedValue('img_uploaded');
  deletePendingImageMock.mockResolvedValue(undefined);
  getDatabaseMock.mockReturnValue(makeDb());
  listRowsMock.mockResolvedValue({ rows: [] });
  accountGetMock.mockResolvedValue({ $id: 'user_A' });
  updateRowMock.mockResolvedValue({});
  upsertRowMock.mockResolvedValue({});
  createRowMock.mockResolvedValue({});
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
    await expect(syncModule.initializeSync('user_A')).resolves.toBeUndefined();
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
    await syncModule.initializeSync('user_A');
    unsubscribe();
    listRowsMock.mockClear();
    await syncModule.initializeSync('user_A');
    expect(listRowsMock).toHaveBeenCalled();
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
describe('sync — explicit fresh refresh', () => {
  it('waits for an in-flight cycle before starting the caller-required fresh cycle', async () => {
    const firstPull = makeDeferred<{ rows: never[] }>();
    listRowsMock.mockReturnValueOnce(firstPull.promise);
    listRowsMock.mockResolvedValue({ rows: [] });

    const first = syncModule.initializeSync('user_A');
    await Promise.resolve();

    let refreshSettled = false;
    const refresh = syncModule.refreshSync('user_A', 1_000).then((result) => {
      refreshSettled = true;
      return result;
    });
    await Promise.resolve();

    expect(refreshSettled).toBe(false);

    firstPull.resolve({ rows: [] });
    await first;
    const refreshed = await refresh;

    expect(taskListRowsCalls()).toHaveLength(2);
    expect(refreshed.status.isSyncing).toBe(false);
    expect(refreshed.status.errors).toEqual([]);
    expect(Date.parse(refreshed.status.lastSync!)).toBeGreaterThanOrEqual(
      refreshed.startedAt
    );
  });
});

describe('sync — forceSync follow-up queueing', () => {
  it('runs a follow-up when forceSync is called during an in-flight sync', async () => {
    const firstPull = makeDeferred<{ rows: never[] }>();
    listRowsMock.mockReturnValueOnce(firstPull.promise);
    listRowsMock.mockResolvedValue({ rows: [] });

    const first = syncModule.initializeSync('user_A');
    await Promise.resolve();
    await syncModule.forceSync('user_A');

    firstPull.resolve({ rows: [] });
    await first;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(taskListRowsCalls()).toHaveLength(2);
  });
  it('does not queue a follow-up when initializeSync is blocked by backoff', async () => {
    await syncModule.initializeSync('user_A');
    const rateLimitErr = Object.assign(new Error('rate limit'), {
      code: 429,
    });
    listRowsMock.mockRejectedValueOnce(rateLimitErr);
    await syncModule.initializeSync('user_A');
    expect(syncModule.getSyncStatus().errors.length).toBeGreaterThan(0);
    listRowsMock.mockClear();
    await syncModule.forceSync('user_A');
    expect(listRowsMock).not.toHaveBeenCalled();
  });
});
// Regression: §18 (sync failure isolation and boundary safety).
describe('sync — boundary advancement', () => {
  it('after a successful cycle, dirty boundary equals cycle-start, not cycle-end', async () => {
    const observedFirstListRowsAt = { value: 0 };
    listRowsMock.mockImplementation(async () => {
      if (observedFirstListRowsAt.value === 0) {
        observedFirstListRowsAt.value = Date.now();
      }
      return { rows: [] };
    });
    await syncModule.initializeSync('user_A');
    const raw = localStorageMock.getItem('lastSyncTimePerCollection');
    expect(raw).toBeTruthy();
    const state = JSON.parse(raw!);
    const dirtyMs = new Date(state.entries.tasks.dirty).getTime();
    const pullMs = new Date(state.entries.tasks.pull).getTime();
    expect(dirtyMs).toBe(pullMs);
    expect(dirtyMs).toBeLessThanOrEqual(observedFirstListRowsAt.value);
  });
  it('pull boundary is not advanced when a pull row fails to apply', async () => {
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
    await syncModule.initializeSync('user_A');
    expect(failingUpsert).toHaveBeenCalledTimes(1);
    const raw = localStorageMock.getItem('lastSyncTimePerCollection');
    const state = JSON.parse(raw!);
    expect(state.entries.tasks.pull).toBe('');
  });
  it('pull boundary is not advanced when a row-level error is thrown during apply', async () => {
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
    await syncModule.initializeSync('user_A');
    const raw = localStorageMock.getItem('lastSyncTimePerCollection');
    const state = JSON.parse(raw!);
    expect(state.entries.tasks.pull).toBe('');
  });
  it('a push failure on one row does not prevent later rows from being attempted', async () => {
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
    await syncModule.initializeSync('user_A');
    expect(updateRowMock).toHaveBeenCalledTimes(3);
  });
  it('a push failure leaves the dirty boundary at its previous value', async () => {
    await syncModule.initializeSync('user_A');
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
    await syncModule.initializeSync('user_A');
    const rawAfter = localStorageMock.getItem('lastSyncTimePerCollection');
    const dirtyAfter = JSON.parse(rawAfter!).entries.tasks.dirty;
    expect(dirtyAfter).toBe(dirtyBefore);
  });
  it('a clean cycle still advances the dirty boundary', async () => {
    await syncModule.initializeSync('user_A');
    const rawBefore = localStorageMock.getItem('lastSyncTimePerCollection');
    const dirtyBefore = JSON.parse(rawBefore!).entries.tasks.dirty;
    await new Promise((r) => setTimeout(r, 5));
    await syncModule.initializeSync('user_A');
    const rawAfter = localStorageMock.getItem('lastSyncTimePerCollection');
    const dirtyAfter = JSON.parse(rawAfter!).entries.tasks.dirty;
    expect(new Date(dirtyAfter).getTime()).toBeGreaterThan(
      new Date(dirtyBefore).getTime()
    );
  });
});
describe('sync — per-collection state versioning', () => {
  it('writes version: 1 on the per-collection state blob', async () => {
    await syncModule.initializeSync('user_A');
    const raw = localStorageMock.getItem('lastSyncTimePerCollection');
    expect(raw).toBeTruthy();
    const state = JSON.parse(raw!);
    expect(state.version).toBe(1);
  });
  it('accepts a legacy unversioned blob without discarding its entries', async () => {
    const recent = new Date(Date.now() - 1_000).toISOString();
    const legacy = {
      ownerId: 'user_A',
      entries: {
        tasks: {
          pull: recent,
          dirty: recent,
        },
      },
    };
    localStorageMock.setItem(
      'lastSyncTimePerCollection',
      JSON.stringify(legacy)
    );
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId === 'tasks') {
          return { rows: [] };
        }
        return { rows: [] };
      }
    );
    await syncModule.initializeSync('user_A');
    const tasksCall = taskListRowsCalls()[0];
    expect(tasksCall).toBeDefined();
    const queries = (tasksCall[0] as { queries: { op?: string }[] }).queries;
    expect(queries.some((q) => q.op === 'greaterThan')).toBe(true);
    const rawAfter = localStorageMock.getItem('lastSyncTimePerCollection');
    const stateAfter = JSON.parse(rawAfter!);
    expect(stateAfter.version).toBe(1);
  });
  it('rejects a blob with an unrecognized version', async () => {
    const future = {
      version: 999,
      ownerId: 'user_A',
      entries: {
        tasks: {
          pull: '2026-01-01T00:00:00.000Z',
          dirty: '2026-01-01T00:00:00.000Z',
        },
      },
    };
    localStorageMock.setItem(
      'lastSyncTimePerCollection',
      JSON.stringify(future)
    );
    await syncModule.initializeSync('user_A');
    const tasksCall = taskListRowsCalls()[0];
    expect(tasksCall).toBeDefined();
    const queries = (tasksCall[0] as { queries: { op?: string }[] }).queries;
    expect(queries.some((q) => q.op === 'greaterThan')).toBe(false);
  });
});
describe('sync — lastSyncTime is user-scoped', () => {
  it('writes lastSyncTime_<userId> and does not write the bare key', async () => {
    await syncModule.initializeSync('user_A');
    const scoped = localStorageMock.getItem('lastSyncTime_user_A');
    expect(scoped).toBeTruthy();
    expect(localStorageMock.getItem('lastSyncTime')).toBeNull();
  });
  it('a different user on the same tab does not inherit the previous lastSyncTime', async () => {
    await syncModule.initializeSync('user_A');
    const userATimestamp = localStorageMock.getItem('lastSyncTime_user_A');
    expect(userATimestamp).toBeTruthy();
    await new Promise((r) => setTimeout(r, 10));
    await syncModule.initializeSync('user_B');
    const userBTimestamp = localStorageMock.getItem('lastSyncTime_user_B');
    expect(userBTimestamp).toBeTruthy();
    expect(localStorageMock.getItem('lastSyncTime_user_A')).toBe(
      userATimestamp
    );
    expect(userBTimestamp).not.toBe(userATimestamp);
    const statusAfterB = syncModule.getSyncStatus();
    expect(statusAfterB.lastSync).toBe(userBTimestamp);
  });
});
// Regression: §12 (server-owned outgoing read_at survives local dirtiness).
describe('sync — read_at pull for dirty outgoing messages', () => {
  it('an outgoing message row that is dirty still receives the remote read_at', async () => {
    const local = makeLocalMessageDoc('msg_dirty_out', 'outgoing', '');
    getDatabaseMock.mockReturnValue({
      tasks: makeEmptyCollection(),
      categories: makeEmptyCollection(),
      diary: makeEmptyCollection(),
      settings: makeEmptyCollection(),
      friendships: makeEmptyCollection(),
      messages: {
        findOne: () => ({ exec: async () => local }),
        find: () => ({ exec: async () => [] }),
        upsert: vi.fn(),
      },
    });
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId === 'messages') {
          return { rows: [makeMessageRow('msg_dirty_out', 'outgoing')] };
        }
        return { rows: [] };
      }
    );
    await syncModule.initializeSync('user_A');
    expect(local.incrementalPatch).toHaveBeenCalledTimes(1);
    expect(local.incrementalPatch).toHaveBeenCalledWith({
      readAt: '2026-06-01T00:00:00.000Z',
    });
  });
  it('a dirty outgoing message is not overwritten by the remote row', async () => {
    const local = makeLocalMessageDoc('msg_dirty_out', 'outgoing', '');
    const upsertSpy = vi.fn().mockResolvedValue(undefined);
    getDatabaseMock.mockReturnValue({
      tasks: makeEmptyCollection(),
      categories: makeEmptyCollection(),
      diary: makeEmptyCollection(),
      settings: makeEmptyCollection(),
      friendships: makeEmptyCollection(),
      messages: {
        findOne: () => ({ exec: async () => local }),
        find: () => ({ exec: async () => [] }),
        upsert: upsertSpy,
      },
    });
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId === 'messages') {
          return {
            rows: [
              {
                ...makeMessageRow('msg_dirty_out', 'outgoing'),
                $updatedAt: '2027-01-01T00:00:00.000Z',
              },
            ],
          };
        }
        return { rows: [] };
      }
    );
    await syncModule.initializeSync('user_A');
    expect(local.incrementalPatch).toHaveBeenCalledTimes(1);
    expect(upsertSpy).not.toHaveBeenCalled();
  });
  it('an incoming message row that is dirty does NOT hit the outgoing-only read_at branch', async () => {
    const local = makeLocalMessageDoc('msg_dirty_in', 'incoming', '');
    getDatabaseMock.mockReturnValue({
      tasks: makeEmptyCollection(),
      categories: makeEmptyCollection(),
      diary: makeEmptyCollection(),
      settings: makeEmptyCollection(),
      friendships: makeEmptyCollection(),
      messages: {
        findOne: () => ({ exec: async () => local }),
        find: () => ({ exec: async () => [] }),
        upsert: vi.fn(),
      },
    });
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId === 'messages') {
          return { rows: [makeMessageRow('msg_dirty_in', 'incoming')] };
        }
        return { rows: [] };
      }
    );
    await syncModule.initializeSync('user_A');
    expect(local.incrementalPatch).not.toHaveBeenCalled();
  });
});
// Regression: §10/§18 (pull conflicts preserve local edits without freezing sync).
describe('sync — pull upsert race window', () => {
  it('a local edit landing between check and upsert is not clobbered', async () => {
    await syncModule.initializeSync('user_A');
    const rawPrimed = localStorageMock.getItem('lastSyncTimePerCollection');
    const dirtyMs = new Date(
      JSON.parse(rawPrimed!).entries.tasks.dirty
    ).getTime();
    const cleanLwt = dirtyMs - 100;
    const racedLwt = dirtyMs + 100;
    const upsertSpy = vi.fn().mockResolvedValue(undefined);
    let findOneCalls = 0;
    getDatabaseMock.mockReturnValue(
      makeTaskOnlyDb({
        findOne: () => ({
          exec: async () => {
            findOneCalls++;
            const lwt = findOneCalls === 1 ? cleanLwt : racedLwt;
            return makeLocalDocWithLwt('task_race', lwt);
          },
        }),
        find: () => ({ exec: async () => [] }),
        upsert: upsertSpy,
      })
    );
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId === 'tasks') {
          return {
            rows: [
              makeRemoteTaskRow('task_race', '2027-01-01T00:00:00.000Z'),
            ],
          };
        }
        return { rows: [] };
      }
    );
    await syncModule.initializeSync('user_A');
    expect(findOneCalls).toBeGreaterThanOrEqual(2);
    expect(upsertSpy).not.toHaveBeenCalled();
    const rawAfter = localStorageMock.getItem('lastSyncTimePerCollection');
    const stateAfter = JSON.parse(rawAfter!);
    expect(stateAfter.entries.tasks.pull).not.toBe('');
  });
  it('RxDB CONFLICT during pull upsert is not classified as a row failure', async () => {
    await syncModule.initializeSync('user_A');
    const rawPrimed = localStorageMock.getItem('lastSyncTimePerCollection');
    const dirtyMs = new Date(
      JSON.parse(rawPrimed!).entries.tasks.dirty
    ).getTime();
    const stableLwt = dirtyMs - 100;
    const conflictErr = Object.assign(new Error('conflict'), {
      code: 'CONFLICT',
    });
    const upsertSpy = vi.fn().mockRejectedValue(conflictErr);
    getDatabaseMock.mockReturnValue(
      makeTaskOnlyDb({
        findOne: () => ({
          exec: async () => makeLocalDocWithLwt('task_cf', stableLwt),
        }),
        find: () => ({ exec: async () => [] }),
        upsert: upsertSpy,
      })
    );
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId === 'tasks') {
          return {
            rows: [makeRemoteTaskRow('task_cf', '2027-01-01T00:00:00.000Z')],
          };
        }
        return { rows: [] };
      }
    );
    await syncModule.initializeSync('user_A');
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const rawAfter = localStorageMock.getItem('lastSyncTimePerCollection');
    const stateAfter = JSON.parse(rawAfter!);
    expect(stateAfter.entries.tasks.pull).not.toBe('');
  });
  it('RxDB CONFLICT during pull insert (local doc created mid-cycle) is not classified as a row failure', async () => {
    const conflictErr = Object.assign(new Error('conflict'), {
      code: 'CONFLICT',
    });
    const upsertSpy = vi.fn().mockRejectedValue(conflictErr);
    getDatabaseMock.mockReturnValue(
      makeTaskOnlyDb({
        findOne: () => ({ exec: async () => null }),
        find: () => ({ exec: async () => [] }),
        upsert: upsertSpy,
      })
    );
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId === 'tasks') {
          return {
            rows: [
              makeRemoteTaskRow(
                'task_insert_cf',
                '2027-01-01T00:00:00.000Z'
              ),
            ],
          };
        }
        return { rows: [] };
      }
    );
    await syncModule.initializeSync('user_A');
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const rawAfter = localStorageMock.getItem('lastSyncTimePerCollection');
    const stateAfter = JSON.parse(rawAfter!);
    expect(stateAfter.entries.tasks.pull).not.toBe('');
  });
  it('a normal pull upsert with no race still succeeds', async () => {
    await syncModule.initializeSync('user_A');
    const rawPrimed = localStorageMock.getItem('lastSyncTimePerCollection');
    const dirtyMs = new Date(
      JSON.parse(rawPrimed!).entries.tasks.dirty
    ).getTime();
    const stableLwt = dirtyMs - 100;
    const upsertSpy = vi.fn().mockResolvedValue(undefined);
    getDatabaseMock.mockReturnValue(
      makeTaskOnlyDb({
        findOne: () => ({
          exec: async () => makeLocalDocWithLwt('task_ok', stableLwt),
        }),
        find: () => ({ exec: async () => [] }),
        upsert: upsertSpy,
      })
    );
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId === 'tasks') {
          return {
            rows: [makeRemoteTaskRow('task_ok', '2027-01-01T00:00:00.000Z')],
          };
        }
        return { rows: [] };
      }
    );
    await syncModule.initializeSync('user_A');
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });
});
describe('sync — pull pagination', () => {
  it('a multi-page pull uses cursorAfter with the previous page last id', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) =>
      makeRemoteTaskRow(
        `task_${String(i).padStart(3, '0')}`,
        '2026-01-01T00:00:00.000Z'
      )
    );
    const page2 = [
      makeRemoteTaskRow('task_100', '2026-01-01T00:00:00.000Z'),
      makeRemoteTaskRow('task_101', '2026-01-01T00:00:00.000Z'),
      makeRemoteTaskRow('task_102', '2026-01-01T00:00:00.000Z'),
    ];
    let taskCallCount = 0;
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId !== 'tasks') return { rows: [] };
        taskCallCount++;
        if (taskCallCount === 1) return { rows: page1 };
        if (taskCallCount === 2) return { rows: page2 };
        return { rows: [] };
      }
    );
    const upsertSpy = vi.fn().mockResolvedValue(undefined);
    getDatabaseMock.mockReturnValue(
      makeTaskOnlyDb({
        findOne: () => ({ exec: async () => null }),
        find: () => ({ exec: async () => [] }),
        upsert: upsertSpy,
      })
    );
    await syncModule.initializeSync('user_A');
    const calls = taskListRowsCalls();
    expect(calls.length).toBe(2);
    const firstQueries = (
      calls[0][0] as { queries: { op?: string; id?: string }[] }
    ).queries;
    expect(firstQueries.some((q) => q.op === 'cursorAfter')).toBe(false);
    const secondQueries = (
      calls[1][0] as { queries: { op?: string; id?: string }[] }
    ).queries;
    const cursor = secondQueries.find((q) => q.op === 'cursorAfter');
    expect(cursor).toBeDefined();
    expect(cursor?.id).toBe('task_099');
    expect(upsertSpy).toHaveBeenCalledTimes(103);
  });
  it('a short page exits pagination without a second listRows call', async () => {
    const shortPage = [
      makeRemoteTaskRow('task_a', '2026-01-01T00:00:00.000Z'),
      makeRemoteTaskRow('task_b', '2026-01-01T00:00:00.000Z'),
    ];
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId !== 'tasks') return { rows: [] };
        return { rows: shortPage };
      }
    );
    const upsertSpy = vi.fn().mockResolvedValue(undefined);
    getDatabaseMock.mockReturnValue(
      makeTaskOnlyDb({
        findOne: () => ({ exec: async () => null }),
        find: () => ({ exec: async () => [] }),
        upsert: upsertSpy,
      })
    );
    await syncModule.initializeSync('user_A');
    expect(taskListRowsCalls().length).toBe(1);
    expect(upsertSpy).toHaveBeenCalledTimes(2);
  });
  it('a repeated page (last id equals cursor) breaks pagination', async () => {
    const repeated = Array.from({ length: 100 }, (_, i) =>
      makeRemoteTaskRow(
        `task_${String(i).padStart(3, '0')}`,
        '2026-01-01T00:00:00.000Z'
      )
    );
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId !== 'tasks') return { rows: [] };
        return { rows: repeated };
      }
    );
    const upsertSpy = vi.fn().mockResolvedValue(undefined);
    getDatabaseMock.mockReturnValue(
      makeTaskOnlyDb({
        findOne: () => ({ exec: async () => null }),
        find: () => ({ exec: async () => [] }),
        upsert: upsertSpy,
      })
    );
    await syncModule.initializeSync('user_A');
    const calls = taskListRowsCalls();
    expect(calls.length).toBe(2);
    const secondQueries = (
      calls[1][0] as { queries: { op?: string; id?: string }[] }
    ).queries;
    const cursor = secondQueries.find((q) => q.op === 'cursorAfter');
    expect(cursor?.id).toBe('task_099');
  });
  it('a runaway server hits the page cap', async () => {
    let counter = 0;
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId !== 'tasks') return { rows: [] };
        counter++;
        const base = counter * 1000;
        return {
          rows: Array.from({ length: 100 }, (_, i) =>
            makeRemoteTaskRow(
              `task_${String(base + i).padStart(7, '0')}`,
              '2026-01-01T00:00:00.000Z'
            )
          ),
        };
      }
    );
    const upsertSpy = vi.fn().mockResolvedValue(undefined);
    getDatabaseMock.mockReturnValue(
      makeTaskOnlyDb({
        findOne: () => ({ exec: async () => null }),
        find: () => ({ exec: async () => [] }),
        upsert: upsertSpy,
      })
    );
    await syncModule.initializeSync('user_A');
    expect(taskListRowsCalls().length).toBe(100);
    const messages = warnSpy.mock.calls.map((args) => String(args[0]));
    expect(
      messages.some((m) => m.includes('hit page cap (100)'))
    ).toBe(true);
  });
  it('the pull query uses pullBoundaryMs - 30s as the sinceIso boundary', async () => {
    await syncModule.initializeSync('user_A');
    const rawPrimed = localStorageMock.getItem('lastSyncTimePerCollection');
    const pullMs = new Date(
      JSON.parse(rawPrimed!).entries.tasks.pull
    ).getTime();
    const expectedSince = new Date(pullMs - 30_000).toISOString();
    listRowsMock.mockClear();
    listRowsMock.mockResolvedValue({ rows: [] });
    await syncModule.initializeSync('user_A');
    const calls = taskListRowsCalls();
    expect(calls.length).toBeGreaterThan(0);
    const queries = (
      calls[0][0] as { queries: { op?: string; k?: string; v?: string }[] }
    ).queries;
    const sinceClause = queries.find(
      (q) => q.op === 'greaterThan' && q.k === '$updatedAt'
    );
    expect(sinceClause).toBeDefined();
    expect(sinceClause?.v).toBe(expectedSince);
  });
  it('the pull query includes a user_id filter matching the current user', async () => {
    await syncModule.initializeSync('user_A');
    const calls = taskListRowsCalls();
    expect(calls.length).toBeGreaterThan(0);
    const queries = (
      calls[0][0] as { queries: { op?: string; k?: string; v?: unknown }[] }
    ).queries;
    const userFilter = queries.find(
      (q) => q.op === 'equal' && q.k === 'user_id'
    );
    expect(userFilter).toBeDefined();
    expect(userFilter?.v).toBe('user_A');
  });
});
describe('sync — tombstone retention cursor expiry', () => {
  it('performs a full pull when the incremental cursor is older than the retention window', async () => {
    const oldPull = new Date(
      Date.now() - syncModule.TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000 - 1
    ).toISOString();
    localStorageMock.setItem(
      'lastSyncTimePerCollection',
      JSON.stringify({
        version: 1,
        ownerId: 'user_A',
        entries: {
          tasks: { pull: oldPull, dirty: oldPull },
        },
      })
    );

    const upsertSpy = vi.fn().mockResolvedValue(undefined);
    getDatabaseMock.mockReturnValue(
      makeTaskOnlyDb({
        findOne: () => ({ exec: async () => null }),
        find: () => ({ exec: async () => [] }),
        upsert: upsertSpy,
      })
    );
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId === 'tasks') {
          return {
            rows: [makeRemoteTaskRow('task_tombstone', new Date().toISOString())],
          };
        }
        return { rows: [] };
      }
    );

    await syncModule.initializeSync('user_A');

    const calls = taskListRowsCalls();
    expect(calls.length).toBeGreaterThan(0);
    const queries = (
      calls[0][0] as { queries: { op?: string; k?: string }[] }
    ).queries;
    expect(
      queries.some((q) => q.op === 'greaterThan' && q.k === '$updatedAt')
    ).toBe(false);
  });
  it('soft-deletes clean local rows missing from a stale full pull without pushing them back', async () => {
    const oldPull = new Date(
      Date.now() - syncModule.TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000 - 1
    ).toISOString();
    const missingDoc = makeLocalDocWithLwt(
      'task_missing_after_gc',
      new Date(oldPull).getTime() - 1
    );
    const upsertSpy = vi.fn().mockResolvedValue(undefined);
    getDatabaseMock.mockReturnValue(
      makeTaskOnlyDb({
        findOne: () => ({ exec: async () => null }),
        find: () => ({ exec: async () => [missingDoc] }),
        upsert: upsertSpy,
      })
    );
    localStorageMock.setItem(
      'lastSyncTimePerCollection',
      JSON.stringify({
        version: 1,
        ownerId: 'user_A',
        entries: {
          tasks: { pull: oldPull, dirty: oldPull },
        },
      })
    );
    listRowsMock.mockResolvedValue({ rows: [] });

    await syncModule.initializeSync('user_A');

    expect(missingDoc.incrementalPatch).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: true })
    );
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(createRowMock).not.toHaveBeenCalled();
    const suppression = JSON.parse(
      localStorageMock.getItem('reconciledMissingRows')!
    );
    expect(suppression.entries['tasks::task_missing_after_gc']).toBeTruthy();
  });

});


describe('sync — bounded push concurrency', () => {
  it('pushes independent dirty rows in parallel without exceeding the concurrency cap', async () => {
    const docs = Array.from({ length: 12 }, (_, index) =>
      makeLocalDoc(`task_parallel_${index}`)
    );
    getDatabaseMock.mockReturnValue(
      makeTaskOnlyDb({
        findOne: () => ({ exec: async () => null }),
        find: () => ({ exec: async () => docs }),
        upsert: vi.fn(),
      })
    );

    let active = 0;
    let maxActive = 0;
    updateRowMock.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return {};
    });

    await syncModule.initializeSync('user_A');

    expect(updateRowMock).toHaveBeenCalledTimes(12);
    expect(maxActive).toBeGreaterThan(1);
    expect(maxActive).toBeLessThanOrEqual(4);
  });
});

// Regression: §24.18 (pending local image ids never reach Appwrite).
describe('sync — pending image reconciliation', () => {
  it('uploads and rewrites a pending task image before pushing the row', async () => {
    const patch = vi.fn().mockResolvedValue(undefined);
    const local = {
      id: 'task_pending_image',
      _meta: { lwt: Date.now() + 1_000_000 },
      toJSON: () => ({
        id: 'task_pending_image',
        userId: 'user_A',
        title: 'Offline photo',
        completed: false,
        categoryId: '',
        date: '2026-09-27',
        createdAt: '2026-09-27T00:00:00.000Z',
        updatedAt: '2026-09-27T00:00:00.000Z',
        image: 'localimg_0123456789abcdef0123456789',
        isDeleted: false,
        visibility: '',
      }),
      incrementalPatch: patch,
    };
    getDatabaseMock.mockReturnValue(
      makeTaskOnlyDb({
        findOne: () => ({ exec: async () => null }),
        find: () => ({ exec: async () => [local] }),
        upsert: vi.fn(),
      })
    );
    updateRowMock.mockResolvedValue({});

    await syncModule.initializeSync('user_A');

    expect(uploadPendingImageMock).toHaveBeenCalledWith(
      'localimg_0123456789abcdef0123456789',
      'user_A'
    );
    expect(patch).toHaveBeenCalledWith({ image: 'img_uploaded' });
    expect(deletePendingImageMock).toHaveBeenCalledWith(
      'localimg_0123456789abcdef0123456789',
      'user_A'
    );
    const pushed = updateRowMock.mock.calls.find(
      (call) => call[0].rowId === 'task_pending_image'
    )?.[0];
    expect(pushed?.data.image).toBe('img_uploaded');
    expect(JSON.stringify(pushed?.data)).not.toContain('localimg_');
  });
});

// Regression: §6 (update-404 fallback uses createRow, never upsertRow).
describe('sync — 404 fallback uses createRow', () => {
  it('a 404 on updateRow falls back to createRow, not upsertRow', async () => {
    const docs = [makeLocalDoc('task_new')];
    getDatabaseMock.mockReturnValue(
      makeTaskOnlyDb({
        findOne: () => ({ exec: async () => null }),
        find: () => ({ exec: async () => docs }),
        upsert: vi.fn(),
      })
    );
    const notFoundErr = Object.assign(new Error('not found'), { code: 404 });
    updateRowMock.mockRejectedValueOnce(notFoundErr);
    await syncModule.initializeSync('user_A');
    expect(updateRowMock).toHaveBeenCalledTimes(1);
    expect(createRowMock).toHaveBeenCalledTimes(1);
    expect(upsertRowMock).not.toHaveBeenCalled();
    const call = createRowMock.mock.calls[0][0] as {
      tableId: string;
      rowId: string;
      data: Record<string, unknown>;
    };
    expect(call.tableId).toBe('tasks');
    expect(call.rowId).toBe('task_new');
    expect(call.data.user_id).toBe('user_A');
  });
  it('a createRow failure on 404 counts as a push failure', async () => {
    const docs = [makeLocalDoc('task_new')];
    getDatabaseMock.mockReturnValue(
      makeTaskOnlyDb({
        findOne: () => ({ exec: async () => null }),
        find: () => ({ exec: async () => docs }),
        upsert: vi.fn(),
      })
    );
    await syncModule.initializeSync('user_A');
    const rawBefore = localStorageMock.getItem('lastSyncTimePerCollection');
    const dirtyBefore = JSON.parse(rawBefore!).entries.tasks.dirty;
    expect(dirtyBefore).not.toBe('');
    const notFoundErr = Object.assign(new Error('not found'), { code: 404 });
    const conflictErr = Object.assign(new Error('conflict'), { code: 409 });
    updateRowMock.mockRejectedValueOnce(notFoundErr);
    createRowMock.mockRejectedValueOnce(conflictErr);
    await syncModule.initializeSync('user_A');
    const rawAfter = localStorageMock.getItem('lastSyncTimePerCollection');
    const dirtyAfter = JSON.parse(rawAfter!).entries.tasks.dirty;
    expect(dirtyAfter).toBe(dirtyBefore);
  });
});
// Regression: §18 (cross-tab sync cycles serialize and reload shared state).
describe('sync — cross-tab mutex and state reload', () => {
  it('runs the cycle inside navigator.locks.request when available', async () => {
    const originalNavigator = (globalThis as { navigator?: unknown }).navigator;
    const requestMock = vi.fn(
      async (_name: string, cb: () => Promise<unknown>) => {
        await cb();
      }
    );
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: { locks: { request: requestMock } },
    });
    try {
      await syncModule.initializeSync('user_A');
      expect(requestMock).toHaveBeenCalledTimes(1);
      expect(requestMock.mock.calls[0][0]).toBe('mosaic-sync');
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: originalNavigator,
      });
    }
  });
  it('falls back to running the cycle when navigator.locks is unavailable', async () => {
    const originalNavigator = (globalThis as { navigator?: unknown }).navigator;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: { locks: undefined },
    });
    try {
      await syncModule.initializeSync('user_A');
      expect(syncModule.getSyncStatus().isSyncing).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: originalNavigator,
      });
    }
  });
  it('falls back to running the cycle when navigator.locks.request throws', async () => {
    const originalNavigator = (globalThis as { navigator?: unknown }).navigator;
    const requestMock = vi.fn().mockRejectedValue(new Error('lock denied'));
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: { locks: { request: requestMock } },
    });
    try {
      await syncModule.initializeSync('user_A');
      expect(requestMock).toHaveBeenCalledTimes(1);
      // The cycle still ran.
      expect(syncModule.getSyncStatus().isSyncing).toBe(false);
      // A warning was logged.
      const warnings = warnSpy.mock.calls.map((args) => String(args[0]));
      expect(
        warnings.some((m) => m.includes('Web Locks request failed'))
      ).toBe(true);
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: originalNavigator,
      });
    }
  });
  it('reloads per-collection state from localStorage at the start of every cycle', async () => {
    // Prime per-collection state.
    await syncModule.initializeSync('user_A');
    // Plant a future dirty boundary, simulating what another tab wrote.
    const raw = localStorageMock.getItem('lastSyncTimePerCollection');
    const state = JSON.parse(raw!);
    const future = '2099-01-01T00:00:00.000Z';
    state.entries.tasks.dirty = future;
    localStorageMock.setItem(
      'lastSyncTimePerCollection',
      JSON.stringify(state)
    );
    // Run another cycle. The cycle must observe the planted boundary
    // and preserve it (Math.max with a 2026 cycle-start keeps 2099).
    await syncModule.initializeSync('user_A');
    const afterRaw = localStorageMock.getItem('lastSyncTimePerCollection');
    const after = JSON.parse(afterRaw!);
    expect(after.entries.tasks.dirty).toBe(future);
  });
});
