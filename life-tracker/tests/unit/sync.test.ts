import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const localStorageMock = vi.hoisted(() => {
  const store = new Map<string, string>();
  const mock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  (globalThis as unknown as { localStorage: typeof mock }).localStorage = mock;
  return mock;
});

const listRowsMock = vi.hoisted(() => vi.fn());
const updateRowMock = vi.hoisted(() => vi.fn());
const createRowMock = vi.hoisted(() => vi.fn());
const getDatabaseMock = vi.hoisted(() => vi.fn());
const getReplicationFreshnessMock = vi.hoisted(() => vi.fn());
const syncFriendshipsMock = vi.hoisted(() => vi.fn());

const taskPilotActiveMock = vi.hoisted(() => vi.fn());
const taskPilotResyncMock = vi.hoisted(() => vi.fn());
const taskPilotStartMock = vi.hoisted(() => vi.fn());
const taskPilotRefreshMock = vi.hoisted(() => vi.fn());
const taskPilotStopMock = vi.hoisted(() => vi.fn());

const categoryPilotActiveMock = vi.hoisted(() => vi.fn());
const categoryPilotResyncMock = vi.hoisted(() => vi.fn());
const categoryPilotStartMock = vi.hoisted(() => vi.fn());
const categoryPilotRefreshMock = vi.hoisted(() => vi.fn());
const categoryPilotStopMock = vi.hoisted(() => vi.fn());

const diaryPilotActiveMock = vi.hoisted(() => vi.fn());
const diaryPilotResyncMock = vi.hoisted(() => vi.fn());
const diaryPilotStartMock = vi.hoisted(() => vi.fn());
const diaryPilotRefreshMock = vi.hoisted(() => vi.fn());
const diaryPilotStopMock = vi.hoisted(() => vi.fn());

const settingsPilotActiveMock = vi.hoisted(() => vi.fn());
const settingsPilotResyncMock = vi.hoisted(() => vi.fn());
const settingsPilotStartMock = vi.hoisted(() => vi.fn());
const settingsPilotRefreshMock = vi.hoisted(() => vi.fn());
const settingsPilotStopMock = vi.hoisted(() => vi.fn());

const friendshipPilotActiveMock = vi.hoisted(() => vi.fn());
const friendshipPilotResyncMock = vi.hoisted(() => vi.fn());
const friendshipPilotStartMock = vi.hoisted(() => vi.fn());
const friendshipPilotRefreshMock = vi.hoisted(() => vi.fn());
const friendshipPilotStopMock = vi.hoisted(() => vi.fn());

const messagePilotActiveMock = vi.hoisted(() => vi.fn());
const messagePilotResyncMock = vi.hoisted(() => vi.fn());
const messagePilotStartMock = vi.hoisted(() => vi.fn());
const messagePilotRefreshMock = vi.hoisted(() => vi.fn());
const messagePilotStopMock = vi.hoisted(() => vi.fn());

vi.mock('appwrite', () => ({
  Query: {
    equal: (key: string, value: unknown) => ({ op: 'equal', key, value }),
    limit: (value: number) => ({ op: 'limit', value }),
    orderAsc: (field: string) => ({ op: 'orderAsc', field }),
    greaterThan: (key: string, value: unknown) => ({
      op: 'greaterThan',
      key,
      value,
    }),
    cursorAfter: (id: string) => ({ op: 'cursorAfter', id }),
  },
}));

vi.mock('../../src/lib/sdk', () => ({
  guardedTablesDB: {
    listRows: listRowsMock,
    updateRow: updateRowMock,
    createRow: createRowMock,
  },
}));

vi.mock('../../src/db/database', () => ({
  getDatabase: getDatabaseMock,
}));

vi.mock('../../src/db/replicationLocalState', () => ({
  getReplicationFreshness: getReplicationFreshnessMock,
}));

vi.mock('../../src/lib/friendshipSync', () => ({
  syncFriendships: syncFriendshipsMock,
}));

vi.mock('../../src/db/taskReplicationPilot', () => ({
  isTaskReplicationPilotActive: taskPilotActiveMock,
  refreshTaskReplicationPilot: taskPilotRefreshMock,
  resyncTaskReplicationPilot: taskPilotResyncMock,
  startTaskReplicationPilot: taskPilotStartMock,
  stopTaskReplicationPilot: taskPilotStopMock,
}));
vi.mock('../../src/db/categoryReplicationPilot', () => ({
  isCategoryReplicationPilotActive: categoryPilotActiveMock,
  refreshCategoryReplicationPilot: categoryPilotRefreshMock,
  resyncCategoryReplicationPilot: categoryPilotResyncMock,
  startCategoryReplicationPilot: categoryPilotStartMock,
  stopCategoryReplicationPilot: categoryPilotStopMock,
}));
vi.mock('../../src/db/diaryReplicationPilot', () => ({
  isDiaryReplicationPilotActive: diaryPilotActiveMock,
  refreshDiaryReplicationPilot: diaryPilotRefreshMock,
  resyncDiaryReplicationPilot: diaryPilotResyncMock,
  startDiaryReplicationPilot: diaryPilotStartMock,
  stopDiaryReplicationPilot: diaryPilotStopMock,
}));
vi.mock('../../src/db/settingsReplicationPilot', () => ({
  isSettingsReplicationPilotActive: settingsPilotActiveMock,
  refreshSettingsReplicationPilot: settingsPilotRefreshMock,
  resyncSettingsReplicationPilot: settingsPilotResyncMock,
  startSettingsReplicationPilot: settingsPilotStartMock,
  stopSettingsReplicationPilot: settingsPilotStopMock,
}));
vi.mock('../../src/db/friendshipReplicationPilot', () => ({
  isFriendshipReplicationPilotActive: friendshipPilotActiveMock,
  refreshFriendshipReplicationPilot: friendshipPilotRefreshMock,
  resyncFriendshipReplicationPilot: friendshipPilotResyncMock,
  startFriendshipReplicationPilot: friendshipPilotStartMock,
  stopFriendshipReplicationPilot: friendshipPilotStopMock,
}));
vi.mock('../../src/db/messageReplicationPilot', () => ({
  isMessageReplicationPilotActive: messagePilotActiveMock,
  refreshMessageReplicationPilot: messagePilotRefreshMock,
  resyncMessageReplicationPilot: messagePilotResyncMock,
  startMessageReplicationPilot: messagePilotStartMock,
  stopMessageReplicationPilot: messagePilotStopMock,
}));

vi.mock('../../src/lib/connectivity', () => ({
  getConnectivitySnapshot: () => ({
    status: 'online',
    reason: 'sync-unit-test',
    lastConfirmedAt: '2026-10-03T00:00:00.000Z',
  }),
}));

type SyncModule = typeof import('../../src/db/sync');
let syncModule!: SyncModule;

const pilotState = {
  tasks: false,
  categories: false,
  diary: false,
  settings: false,
  friendships: false,
  messages: false,
};

function setAllPilots(value: boolean) {
  for (const key of Object.keys(pilotState) as Array<keyof typeof pilotState>) {
    pilotState[key] = value;
  }
}

function makeDoc({
  id,
  updatedAt = '2026-01-01T00:00:00.000Z',
  lwt = Date.parse('2026-01-01T00:00:00.000Z'),
  extra = {},
}: {
  id: string;
  updatedAt?: string;
  lwt?: number;
  extra?: Record<string, unknown>;
}) {
  const incrementalPatch = vi.fn().mockResolvedValue(undefined);
  return {
    id,
    _meta: { lwt },
    toJSON: () => ({
      id,
      userId: 'user_A',
      title: id,
      completed: false,
      categoryId: '',
      order: 0,
      date: '2026-01-01',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt,
      isDeleted: false,
      visibility: '',
      ...extra,
    }),
    incrementalPatch,
  };
}

function makeEmptyCollection() {
  return {
    findOne: vi.fn(() => ({ exec: async () => null })),
    find: vi.fn(() => ({ exec: async () => [] })),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
}

function makeCollection(docs: ReturnType<typeof makeDoc>[] = []) {
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  return {
    findOne: vi.fn((id: string) => ({
      exec: async () => byId.get(id) ?? null,
    })),
    find: vi.fn(() => ({ exec: async () => [...byId.values()] })),
    upsert: vi.fn().mockImplementation(async (incoming) => {
      const current = byId.get(incoming.id);
      if (current) {
        byId.set(
          incoming.id,
          makeDoc({
            id: incoming.id,
            updatedAt: incoming.updatedAt,
            lwt: Date.now(),
            extra: incoming,
          })
        );
      }
    }),
  };
}

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    tasks: makeEmptyCollection(),
    categories: makeEmptyCollection(),
    diary: makeEmptyCollection(),
    settings: makeEmptyCollection(),
    friendships: makeEmptyCollection(),
    messages: makeEmptyCollection(),
    ...overrides,
  };
}

function makeTaskRow(
  id: string,
  updatedAt = '2026-01-01T00:00:00.000Z'
) {
  return {
    $id: id,
    user_id: 'user_A',
    $updatedAt: updatedAt,
    title: id,
    is_completed: false,
    category_id: '',
    order: 0,
    tags: '',
    date: '2026-01-01',
    memo: '',
    image: '',
    created_at: '2026-01-01T00:00:00.000Z',
    completed_at: '',
    updated_at: updatedAt,
    deleted: false,
    visibility: '',
    source: '',
    routine_id: '',
    reminder_time: '',
    reactions: '',
  };
}

function makeMessageRow(id: string) {
  return {
    $id: id,
    user_id: 'user_A',
    $updatedAt: '2026-01-01T00:00:00.000Z',
    thread_id: 'th_x',
    sender_id: 'user_A',
    recipient_id: 'user_B',
    direction: 'outgoing',
    content: 'hello',
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
    read_at: '2026-01-02T00:00:00.000Z',
    delivery_status: 'delivered',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted: false,
  };
}

function oldFreshness(
  collection:
    | 'tasks'
    | 'categories'
    | 'diary'
    | 'settings'
    | 'friendships'
    | 'messages' = 'tasks'
) {
  return {
    lastFreshAt: new Date(
      Date.now() -
        (syncModule.TOMBSTONE_RETENTION_DAYS + 1) *
          24 *
          60 *
          60 *
          1000
    ).toISOString(),
    replicationIdentifier:
      `mosaic-appwrite-tablesdb-${collection}-v1:user_A`,
  };
}

function configurePilotMocks() {
  taskPilotActiveMock.mockImplementation(() => pilotState.tasks);
  categoryPilotActiveMock.mockImplementation(() => pilotState.categories);
  diaryPilotActiveMock.mockImplementation(() => pilotState.diary);
  settingsPilotActiveMock.mockImplementation(() => pilotState.settings);
  friendshipPilotActiveMock.mockImplementation(() => pilotState.friendships);
  messagePilotActiveMock.mockImplementation(() => pilotState.messages);

  taskPilotStartMock.mockImplementation(async () => {
    pilotState.tasks = true;
  });
  categoryPilotStartMock.mockImplementation(async () => {
    pilotState.categories = true;
  });
  diaryPilotStartMock.mockImplementation(async () => {
    pilotState.diary = true;
  });
  settingsPilotStartMock.mockImplementation(async () => {
    pilotState.settings = true;
  });
  friendshipPilotStartMock.mockImplementation(async () => {
    pilotState.friendships = true;
  });
  messagePilotStartMock.mockImplementation(async () => {
    pilotState.messages = true;
  });

  taskPilotStopMock.mockImplementation(async () => {
    pilotState.tasks = false;
  });
  categoryPilotStopMock.mockImplementation(async () => {
    pilotState.categories = false;
  });
  diaryPilotStopMock.mockImplementation(async () => {
    pilotState.diary = false;
  });
  settingsPilotStopMock.mockImplementation(async () => {
    pilotState.settings = false;
  });
  friendshipPilotStopMock.mockImplementation(async () => {
    pilotState.friendships = false;
  });
  messagePilotStopMock.mockImplementation(async () => {
    pilotState.messages = false;
  });

  for (const refresh of [
    taskPilotRefreshMock,
    categoryPilotRefreshMock,
    diaryPilotRefreshMock,
    settingsPilotRefreshMock,
    friendshipPilotRefreshMock,
    messagePilotRefreshMock,
  ]) {
    refresh.mockResolvedValue(true);
  }
}

beforeEach(async () => {
  vi.resetModules();
  localStorageMock.clear();
  setAllPilots(false);

  for (const mock of [
    listRowsMock,
    updateRowMock,
    createRowMock,
    getDatabaseMock,
    getReplicationFreshnessMock,
    syncFriendshipsMock,
    taskPilotActiveMock,
    taskPilotResyncMock,
    taskPilotStartMock,
    taskPilotRefreshMock,
    taskPilotStopMock,
    categoryPilotActiveMock,
    categoryPilotResyncMock,
    categoryPilotStartMock,
    categoryPilotRefreshMock,
    categoryPilotStopMock,
    diaryPilotActiveMock,
    diaryPilotResyncMock,
    diaryPilotStartMock,
    diaryPilotRefreshMock,
    diaryPilotStopMock,
    settingsPilotActiveMock,
    settingsPilotResyncMock,
    settingsPilotStartMock,
    settingsPilotRefreshMock,
    settingsPilotStopMock,
    friendshipPilotActiveMock,
    friendshipPilotResyncMock,
    friendshipPilotStartMock,
    friendshipPilotRefreshMock,
    friendshipPilotStopMock,
    messagePilotActiveMock,
    messagePilotResyncMock,
    messagePilotStartMock,
    messagePilotRefreshMock,
    messagePilotStopMock,
  ]) {
    mock.mockReset();
  }

  configurePilotMocks();
  getDatabaseMock.mockReturnValue(makeDb());
  getReplicationFreshnessMock.mockResolvedValue(null);
  listRowsMock.mockResolvedValue({ rows: [] });
  syncFriendshipsMock.mockResolvedValue(undefined);
  updateRowMock.mockResolvedValue({});
  createRowMock.mockResolvedValue({});

  const accountWork = await import('../../src/lib/accountWorkScope');
  accountWork.__resetAccountWorkScopeForTests();
  accountWork.scopeAccountWork('user_A');
  syncModule = await import('../../src/db/sync');

  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  syncModule.__resetSyncRuntimeForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('sync — RxDB-first startup', () => {
  it('starts all six pilots directly without running compatibility reads or writes', async () => {
    const db = makeDb();
    getDatabaseMock.mockReturnValue(db);

    await syncModule.initializeSync('user_A');

    expect(listRowsMock).not.toHaveBeenCalled();
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(createRowMock).not.toHaveBeenCalled();

    expect(taskPilotStartMock).toHaveBeenCalledWith(
      'user_A',
      db.tasks,
      undefined
    );
    expect(categoryPilotStartMock).toHaveBeenCalledWith(
      'user_A',
      db.categories,
      undefined
    );
    expect(diaryPilotStartMock).toHaveBeenCalledWith(
      'user_A',
      db.diary,
      undefined
    );
    expect(settingsPilotStartMock).toHaveBeenCalledWith(
      'user_A',
      db.settings,
      undefined
    );
    expect(friendshipPilotStartMock).toHaveBeenCalledWith(
      'user_A',
      db.friendships,
      undefined
    );
    expect(messagePilotStartMock).toHaveBeenCalledWith(
      'user_A',
      db.messages,
      undefined,
      undefined
    );
  });

  it('does not turn remote-applied local LWT revisions into compatibility pushes after restart', async () => {
    const remoteApplied = Array.from({ length: 320 }, (_, index) =>
      makeDoc({
        id: `task_${index}`,
        updatedAt: '2026-01-01T00:00:00.000Z',
        lwt: Date.now() + index + 1,
      })
    );
    getDatabaseMock.mockReturnValue(
      makeDb({ tasks: makeCollection(remoteApplied) })
    );

    localStorageMock.setItem(
      'lastSyncTimePerCollection_user_A',
      JSON.stringify({
        version: 1,
        ownerId: 'user_A',
        entries: {
          tasks: {
            pull: new Date().toISOString(),
            dirty: '2026-01-01T00:00:00.000Z',
          },
        },
      })
    );

    await syncModule.initializeSync('user_A');

    expect(listRowsMock).not.toHaveBeenCalled();
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(createRowMock).not.toHaveBeenCalled();
    expect(taskPilotStartMock).toHaveBeenCalledOnce();
  });

  it('resyncs active pilots without entering recovery code', async () => {
    setAllPilots(true);

    await syncModule.forceSync('user_A');

    expect(taskPilotResyncMock).toHaveBeenCalledWith('user_A');
    expect(categoryPilotResyncMock).toHaveBeenCalledWith('user_A');
    expect(diaryPilotResyncMock).toHaveBeenCalledWith('user_A');
    expect(settingsPilotResyncMock).toHaveBeenCalledWith('user_A');
    expect(friendshipPilotResyncMock).toHaveBeenCalledWith('user_A');
    expect(messagePilotResyncMock).toHaveBeenCalledWith('user_A');
    expect(listRowsMock).not.toHaveBeenCalled();
  });

  it('resyncs only messages for the chat heartbeat once active', async () => {
    pilotState.messages = true;

    await syncModule.forceMessageSync('user_A');

    expect(messagePilotResyncMock).toHaveBeenCalledWith('user_A');
    expect(taskPilotResyncMock).not.toHaveBeenCalled();
  });
});

describe('sync — freshness barriers', () => {
  it('manual refresh starts missing pilots and awaits all six freshness barriers', async () => {
    const result = await syncModule.refreshSync('user_A', 5_000);

    expect(taskPilotRefreshMock).toHaveBeenCalled();
    expect(categoryPilotRefreshMock).toHaveBeenCalled();
    expect(diaryPilotRefreshMock).toHaveBeenCalled();
    expect(settingsPilotRefreshMock).toHaveBeenCalled();
    expect(friendshipPilotRefreshMock).toHaveBeenCalled();
    expect(messagePilotRefreshMock).toHaveBeenCalled();
    expect(result.status.errors).toEqual([]);
    expect(result.status.lastSync).toBeTruthy();
    expect(localStorageMock.getItem('lastSyncTime_user_A')).toBeTruthy();
  });

  it('starts all pilot freshness checks together so a slow collection cannot starve later deadlines', async () => {
    setAllPilots(true);
    let releaseCategory!: (value: boolean) => void;
    categoryPilotRefreshMock.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          releaseCategory = resolve;
        })
    );
    const progress: Array<{
      completed: number;
      percent: number;
      label: string;
      pendingGroups?: string[];
    }> = [];

    const pending = syncModule.refreshSync('user_A', 5_000, {
      onProgress: (value) => progress.push(value),
    });

    await vi.waitFor(() => {
      expect(categoryPilotRefreshMock).toHaveBeenCalled();
      expect(diaryPilotRefreshMock).toHaveBeenCalled();
      expect(settingsPilotRefreshMock).toHaveBeenCalled();
      expect(friendshipPilotRefreshMock).toHaveBeenCalled();
      expect(taskPilotRefreshMock).toHaveBeenCalled();
      expect(messagePilotRefreshMock).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(
        progress.some(
          (value) =>
            value.completed === 5 &&
            value.label === 'Waiting for Categories · 5 of 6 synced' &&
            value.pendingGroups?.join(',') === 'Categories'
        )
      ).toBe(true);
    });

    releaseCategory(true);
    const result = await pending;

    expect(result.status.lastSync).toBeTruthy();
    expect(progress[0]).toMatchObject({
      percent: 0,
      label: 'Checking all 6 data groups…',
    });
    expect(progress.at(-1)).toMatchObject({
      percent: 100,
      label: 'All data groups synced',
      pendingGroups: [],
    });
  });

  it('treats a freshness timeout as pending background sync instead of a persistent red error', async () => {
    setAllPilots(true);
    diaryPilotRefreshMock.mockRejectedValueOnce(
      new Error('Fresh diary sync timed out. Check your connection and retry.')
    );

    await expect(
      syncModule.refreshSync('user_A', 5_000)
    ).rejects.toThrow(/Fresh diary sync timed out/i);

    expect(syncModule.getSyncStatus()).toMatchObject({
      isSyncing: false,
      errors: [],
      notice: expect.stringMatching(/still waiting for Diary/i),
      progress: null,
    });
  });

  it('Sync Now is also a freshness barrier when pilots were initially inactive', async () => {
    const result = await syncModule.syncNow('user_A', 5_000);

    expect(taskPilotStartMock).toHaveBeenCalled();
    expect(taskPilotRefreshMock).toHaveBeenCalled();
    expect(messagePilotRefreshMock).toHaveBeenCalled();
    expect(result.status.lastSync).toBeTruthy();
  });

  it('fails closed when any pilot cannot prove freshness', async () => {
    categoryPilotRefreshMock.mockResolvedValue(false);

    await expect(
      syncModule.refreshSync('user_A', 5_000)
    ).rejects.toThrow('categories sync is not active');

    expect(syncModule.getSyncStatus().lastSync).toBeNull();
  });
});

describe('sync — stale-client recovery', () => {
  it('runs a full read-only pull only for a collection older than retention', async () => {
    getReplicationFreshnessMock.mockImplementation(
      async (_userId: string, collection: string) =>
        collection === 'tasks'
          ? oldFreshness()
          : {
              lastFreshAt: new Date().toISOString(),
              replicationIdentifier: 'current',
            }
    );
    const local = makeDoc({
      id: 'task_remote',
      updatedAt: '2025-01-01T00:00:00.000Z',
      lwt: Date.now(),
    });
    const tasks = makeCollection([local]);
    getDatabaseMock.mockReturnValue(makeDb({ tasks }));
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) =>
        tableId === 'tasks'
          ? {
              rows: [
                makeTaskRow(
                  'task_remote',
                  '2026-01-01T00:00:00.000Z'
                ),
              ],
            }
          : { rows: [] }
    );

    await syncModule.initializeSync('user_A');

    const taskCall = listRowsMock.mock.calls.find(
      ([arg]) => (arg as { tableId: string }).tableId === 'tasks'
    );
    expect(taskCall).toBeTruthy();
    const queries = (taskCall![0] as { queries: Array<{ op: string }> }).queries;
    expect(queries.some((query) => query.op === 'greaterThan')).toBe(false);
    expect(tasks.upsert).toHaveBeenCalled();
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(createRowMock).not.toHaveBeenCalled();
    expect(taskPilotStartMock).toHaveBeenCalled();
  });

  it('uses the legacy pull cursor only as a one-time stale migration fallback', async () => {
    const old = oldFreshness().lastFreshAt;
    localStorageMock.setItem(
      'lastSyncTimePerCollection_user_A',
      JSON.stringify({
        version: 1,
        ownerId: 'user_A',
        entries: {
          tasks: { pull: old, dirty: old },
        },
      })
    );

    await syncModule.initializeSync('user_A');

    expect(
      listRowsMock.mock.calls.some(
        ([arg]) => (arg as { tableId: string }).tableId === 'tasks'
      )
    ).toBe(true);
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(createRowMock).not.toHaveBeenCalled();
  });

  it('does not trust freshness from a different replication identifier', async () => {
    getReplicationFreshnessMock.mockResolvedValue({
      lastFreshAt: new Date(
        Date.now() -
          (syncModule.TOMBSTONE_RETENTION_DAYS + 1) *
            24 *
            60 *
            60 *
            1000
      ).toISOString(),
      replicationIdentifier: 'mosaic-appwrite-tablesdb-tasks-v0:user_A',
    });

    await syncModule.initializeSync('user_A');

    expect(listRowsMock).not.toHaveBeenCalled();
    expect(taskPilotStartMock).toHaveBeenCalled();
  });

  it('does not run legacy recovery for a recent legacy cursor', async () => {
    const recent = new Date().toISOString();
    localStorageMock.setItem(
      'lastSyncTimePerCollection_user_A',
      JSON.stringify({
        version: 1,
        ownerId: 'user_A',
        entries: {
          tasks: { pull: recent, dirty: recent },
        },
      })
    );

    await syncModule.initializeSync('user_A');

    expect(listRowsMock).not.toHaveBeenCalled();
  });

  it('soft-deletes an old local row missing from a stale full pull without writing Appwrite', async () => {
    getReplicationFreshnessMock.mockImplementation(
      async (_userId: string, collection: string) =>
        collection === 'tasks' ? oldFreshness() : null
    );
    const missing = makeDoc({
      id: 'task_gc_missing',
      updatedAt: '2025-01-01T00:00:00.000Z',
      lwt: Date.parse('2025-01-01T00:00:00.000Z'),
    });
    getDatabaseMock.mockReturnValue(
      makeDb({ tasks: makeCollection([missing]) })
    );

    await syncModule.initializeSync('user_A');

    expect(missing.incrementalPatch).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: true })
    );
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(createRowMock).not.toHaveBeenCalled();
  });

  it('preserves a genuine offline edit newer than the last fresh replication', async () => {
    const freshness = oldFreshness();
    getReplicationFreshnessMock.mockImplementation(
      async (_userId: string, collection: string) =>
        collection === 'tasks' ? freshness : null
    );
    const offlineEdit = makeDoc({
      id: 'task_offline_edit',
      updatedAt: new Date(
        Date.parse(freshness.lastFreshAt) + 60_000
      ).toISOString(),
      lwt: Date.parse(freshness.lastFreshAt) + 60_000,
    });
    getDatabaseMock.mockReturnValue(
      makeDb({ tasks: makeCollection([offlineEdit]) })
    );

    await syncModule.initializeSync('user_A');

    expect(offlineEdit.incrementalPatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: true })
    );
    expect(taskPilotStartMock).toHaveBeenCalled();
  });

  it('preserves a pending outgoing message missing after stale recovery', async () => {
    const freshness = oldFreshness('messages');
    getReplicationFreshnessMock.mockImplementation(
      async (_userId: string, collection: string) =>
        collection === 'messages' ? freshness : null
    );
    const pending = makeDoc({
      id: 'msg_pending',
      updatedAt: '2025-01-01T00:00:00.000Z',
      extra: {
        direction: 'outgoing',
        deliveryStatus: 'pending',
        content: 'pending',
      },
    });
    getDatabaseMock.mockReturnValue(
      makeDb({ messages: makeCollection([pending]) })
    );

    await syncModule.initializeSync('user_A');

    expect(pending.incrementalPatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: true })
    );
  });

  it('does not start a stale collection pilot when full recovery fails', async () => {
    getReplicationFreshnessMock.mockImplementation(
      async (_userId: string, collection: string) =>
        collection === 'tasks' ? oldFreshness() : null
    );
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) => {
        if (tableId === 'tasks') {
          throw Object.assign(new Error('rate limited'), { code: 429 });
        }
        return { rows: [] };
      }
    );

    await syncModule.initializeSync('user_A');

    expect(taskPilotStartMock).not.toHaveBeenCalled();
    expect(syncModule.getSyncStatus().errors).toEqual(
      expect.arrayContaining([expect.stringContaining('tasks: rate limited')])
    );
  });

  it('applies outgoing read_at during stale recovery without remote writes', async () => {
    const freshness = oldFreshness('messages');
    getReplicationFreshnessMock.mockImplementation(
      async (_userId: string, collection: string) =>
        collection === 'messages' ? freshness : null
    );
    const outgoing = makeDoc({
      id: 'msg_read',
      updatedAt: '2025-01-01T00:00:00.000Z',
      extra: {
        direction: 'outgoing',
        deliveryStatus: 'delivered',
        readAt: '',
      },
    });
    getDatabaseMock.mockReturnValue(
      makeDb({ messages: makeCollection([outgoing]) })
    );
    listRowsMock.mockImplementation(
      async ({ tableId }: { tableId: string }) =>
        tableId === 'messages' ? { rows: [makeMessageRow('msg_read')] } : { rows: [] }
    );

    await syncModule.initializeSync('user_A');

    expect(outgoing.incrementalPatch).toHaveBeenCalledWith({
      readAt: '2026-01-02T00:00:00.000Z',
    });
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(createRowMock).not.toHaveBeenCalled();
  });
});

describe('sync — coordinator and account safety', () => {
  it('runs startup inside the cross-tab Web Lock when available', async () => {
    const originalNavigator = (globalThis as { navigator?: unknown }).navigator;
    const requestMock = vi.fn(
      async (_name: string, callback: () => Promise<void>) => callback()
    );
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { locks: { request: requestMock } },
    });

    try {
      await syncModule.initializeSync('user_A');
      expect(requestMock).toHaveBeenCalledWith(
        'mosaic-sync',
        expect.any(Function)
      );
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNavigator,
      });
    }
  });

  it('fails closed when the Web Locks API exists but request fails', async () => {
    const originalNavigator = (globalThis as { navigator?: unknown }).navigator;
    const requestMock = vi.fn().mockRejectedValue(new Error('lock denied'));
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { locks: { request: requestMock } },
    });

    try {
      await expect(syncModule.initializeSync('user_A')).rejects.toThrow(
        'lock denied'
      );
      expect(taskPilotStartMock).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNavigator,
      });
    }
  });

  it('bounds fresh-sync lock waiting by the caller timeout', async () => {
    const originalNavigator = (globalThis as { navigator?: unknown }).navigator;
    const requestMock = vi.fn(
      async (
        _name: string,
        options: { signal?: AbortSignal },
        _callback: () => Promise<void>
      ) =>
        new Promise<void>((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        })
    );
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { locks: { request: requestMock } },
    });

    try {
      await expect(syncModule.refreshSync('user_A', 20)).rejects.toThrow(
        'timed out while waiting for another Mosaic tab'
      );
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNavigator,
      });
    }
  });

  it('does not let delayed old-owner suspension cancel the current owner retry timer', async () => {
    vi.useFakeTimers();
    const accountWork = await import('../../src/lib/accountWorkScope');
    accountWork.scopeAccountWork('user_B');

    const rateLimitError = Object.assign(new Error('rate limited'), {
      code: 429,
    });
    taskPilotStartMock
      .mockRejectedValueOnce(rateLimitError)
      .mockImplementationOnce(async () => {
        pilotState.tasks = true;
      });

    await syncModule.initializeSync('user_B');
    expect(taskPilotStartMock).toHaveBeenCalledTimes(1);

    await syncModule.suspendSyncOwner('user_A');
    await vi.advanceTimersByTimeAsync(5_020);

    expect(taskPilotStartMock).toHaveBeenCalledTimes(2);
  });

  it('stops old-owner pilots when account generation changes mid-startup', async () => {
    let release!: () => void;
    taskPilotStartMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = () => {
            pilotState.tasks = true;
            resolve();
          };
        })
    );

    const first = syncModule.initializeSync('user_A');
    await vi.waitFor(() => expect(taskPilotStartMock).toHaveBeenCalled());

    const accountWork = await import('../../src/lib/accountWorkScope');
    accountWork.scopeAccountWork('user_B');
    release();
    await first;

    expect(taskPilotStopMock).toHaveBeenCalledWith('user_A');
  });
});
