import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { firstValueFrom, Subject } from 'rxjs';

const getChangedDocumentsSinceMock = vi.hoisted(() => vi.fn());
const replicateRxCollectionMock = vi.hoisted(() => vi.fn());
const listRowsMock = vi.hoisted(() => vi.fn());
const getRowMock = vi.hoisted(() => vi.fn());
const updateRowMock = vi.hoisted(() => vi.fn());
const createRowMock = vi.hoisted(() => vi.fn());
const realtimeSubscribeMock = vi.hoisted(() => vi.fn());
const reSyncMock = vi.hoisted(() => vi.fn());
const cancelMock = vi.hoisted(() => vi.fn());
const errorSubscribeMock = vi.hoisted(() => vi.fn());
const trackReplicationFreshnessMock = vi.hoisted(() => vi.fn());
const uploadPendingImageMock = vi.hoisted(() => vi.fn());
const deletePendingImageMock = vi.hoisted(() => vi.fn());
const awaitPilotReplicationFreshnessMock = vi.hoisted(() => vi.fn());
const sendAppActionMock = vi.hoisted(() => vi.fn());
let sentSubject: Subject<ReturnType<typeof localTask>>;

vi.mock('rxdb', () => ({
  getChangedDocumentsSince: getChangedDocumentsSinceMock,
}));

vi.mock('rxdb/plugins/replication', () => ({
  replicateRxCollection: replicateRxCollectionMock,
}));

vi.mock('appwrite', () => ({
  Query: {
    equal: (key: string, value: unknown) =>
      JSON.stringify({ op: 'equal', key, value }),
    greaterThan: (key: string, value: unknown) =>
      JSON.stringify({ op: 'greaterThan', key, value }),
    and: (queries: string[]) => JSON.stringify({ op: 'and', queries }),
    or: (queries: string[]) => JSON.stringify({ op: 'or', queries }),
    orderAsc: (field: string) =>
      JSON.stringify({ op: 'orderAsc', field }),
    limit: (value: number) =>
      JSON.stringify({ op: 'limit', value }),
    cursorAfter: (id: string) =>
      JSON.stringify({ op: 'cursorAfter', id }),
  },
  Permission: {
    read: (role: string) => `read(${role})`,
    update: (role: string) => `update(${role})`,
    delete: (role: string) => `delete(${role})`,
  },
  Role: {
    user: (id: string) => `user:${id}`,
  },
}));

vi.mock('../../src/lib/sdk', () => ({
  guardedTablesDB: {
    listRows: listRowsMock,
    getRow: getRowMock,
    updateRow: updateRowMock,
    createRow: createRowMock,
  },
  guardedRealtime: {
    subscribe: realtimeSubscribeMock,
  },
}));

vi.mock('../../src/lib/storage', () => ({
  uploadPendingImage: uploadPendingImageMock,
}));

vi.mock('../../src/lib/appAction', () => ({
  sendAppAction: sendAppActionMock,
}));

vi.mock('../../src/lib/pendingImages', () => ({
  isPendingImageId: (id: string) => id.startsWith('localimg_'),
  deletePendingImage: deletePendingImageMock,
}));

vi.mock('../../src/db/replicationLocalState', () => ({
  trackReplicationFreshness: trackReplicationFreshnessMock,
}));

vi.mock('../../src/db/replicationFreshness', () => ({
  awaitPilotReplicationFreshness: awaitPilotReplicationFreshnessMock,
}));

import {
  __taskReplicationPilotTestUtils,
  captureTaskReplicationPushCheckpoint,
  refreshTaskReplicationPilot,
  startTaskReplicationPilot,
  subscribeTaskPushProgress,
  stopTaskReplicationPilot,
} from '../../src/db/taskReplicationPilot';

function localTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task_one',
    userId: 'user_A',
    title: 'Local task',
    completed: false,
    categoryId: 'cat_one',
    order: 0,
    tags: '',
    date: '2026-10-02',
    memo: '',
    image: '',
    createdAt: '2026-10-01T00:00:00.000Z',
    completedAt: '',
    updatedAt: '2026-10-02T00:00:00.000Z',
    source: '',
    isDeleted: false,
    routineId: '',
    reminderTime: '',
    reactions: '',
    visibility: 'public',
    _deleted: false,
    ...overrides,
  };
}

function remoteTask(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'task_one',
    $updatedAt: '2026-10-02T00:00:01.000Z',
    user_id: 'user_A',
    title: 'Local task',
    is_completed: false,
    category_id: 'cat_one',
    order: 0,
    tags: '',
    date: '2026-10-02',
    memo: '',
    image: '',
    created_at: '2026-10-01T00:00:00.000Z',
    completed_at: '',
    updated_at: '2026-10-02T00:00:00.000Z',
    source: '',
    deleted: false,
    routine_id: '',
    reminder_time: '',
    reactions: '',
    visibility: 'public',
    ...overrides,
  };
}

function collectionFixture() {
  return {
    storageInstance: {},
    database: {
      isLeader: () => true,
      waitForLeadership: async () => true,
    },
  } as never;
}

beforeEach(async () => {
  await stopTaskReplicationPilot();
  vi.clearAllMocks();
  __taskReplicationPilotTestUtils.resetTodoMateCreatePacing();
  sentSubject = new Subject();
  trackReplicationFreshnessMock.mockImplementation(() => undefined);

  getChangedDocumentsSinceMock.mockResolvedValue({
    documents: [],
    checkpoint: { id: 'task_seed', lwt: 123 },
  });
  listRowsMock.mockResolvedValue({ rows: [] });
  getRowMock.mockResolvedValue(remoteTask());
  updateRowMock.mockResolvedValue({});
  createRowMock.mockResolvedValue({});
  uploadPendingImageMock.mockResolvedValue('img_uploaded');
  deletePendingImageMock.mockResolvedValue(undefined);
  cancelMock.mockResolvedValue(true);
  errorSubscribeMock.mockReturnValue({ unsubscribe: vi.fn() });
  realtimeSubscribeMock.mockReturnValue(vi.fn());
  awaitPilotReplicationFreshnessMock.mockResolvedValue(undefined);
  sendAppActionMock.mockRejectedValue(
    Object.assign(new Error('Unknown action'), {
      code: 400,
      result: { error: 'Unknown action: bulk_create_todomate_tasks' },
    })
  );
  replicateRxCollectionMock.mockReturnValue({
    reSync: reSyncMock,
    cancel: cancelMock,
    error$: { subscribe: errorSubscribeMock },
    sent$: sentSubject.asObservable(),
  });
});

afterEach(async () => {
  await stopTaskReplicationPilot();
});

describe('task RxDB replication pilot', () => {
  it('captures the current local checkpoint for the pre-bootstrap seed', async () => {
    const collection = collectionFixture();

    await expect(
      captureTaskReplicationPushCheckpoint(collection)
    ).resolves.toEqual({ id: 'task_seed', lwt: 123 });

    expect(getChangedDocumentsSinceMock).toHaveBeenCalledWith(
      {},
      200,
      undefined
    );
  });

  it('starts from the caller-supplied push checkpoint', async () => {
    const collection = collectionFixture();
    const checkpoint = { id: 'task_seed', lwt: 77 };

    await startTaskReplicationPilot(
      'user_A',
      collection,
      checkpoint
    );

    expect(getChangedDocumentsSinceMock).not.toHaveBeenCalled();
    const options = replicateRxCollectionMock.mock.calls[0][0];
    expect(options.push.initialCheckpoint).toEqual(checkpoint);
    expect(options.waitForLeadership).toBe(true);
    expect(options.live).toBe(true);
  });

  it('participates in the shared leader-owned freshness barrier', async () => {
    const collection = collectionFixture();
    await startTaskReplicationPilot(
      'user_A',
      collection,
      { id: 'task_seed', lwt: 77 }
    );

    await expect(
      refreshTaskReplicationPilot('user_A', 5_000)
    ).resolves.toBe(true);

    expect(awaitPilotReplicationFreshnessMock).toHaveBeenCalledWith(
      'task',
      replicateRxCollectionMock.mock.results[0].value,
      collection,
      5_000
    );
  });

  it('pulls with an owner-scoped updatedAt+id tuple checkpoint', async () => {
    listRowsMock.mockResolvedValue({
      rows: [
        remoteTask({
          $id: 'task_two',
          $updatedAt: '2026-10-02T00:00:03.000Z',
        }),
      ],
    });

    const result = await __taskReplicationPilotTestUtils.pullTasks(
      'user_A',
      {
        id: 'task_one',
        updatedAt: '2026-10-02T00:00:01.000Z',
      },
      100
    );

    const queries = listRowsMock.mock.calls[0][0].queries.map(
      (query: string) => JSON.parse(query)
    );
    expect(queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'equal',
          key: 'user_id',
          value: 'user_A',
        }),
        expect.objectContaining({ op: 'or' }),
        expect.objectContaining({
          op: 'orderAsc',
          field: '$updatedAt',
        }),
        expect.objectContaining({
          op: 'orderAsc',
          field: '$id',
        }),
      ])
    );
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]).toEqual(
      expect.objectContaining({
        id: 'task_two',
        userId: 'user_A',
        _deleted: false,
      })
    );
    expect(result.checkpoint).toEqual({
      id: 'task_two',
      updatedAt: '2026-10-02T00:00:03.000Z',
    });
  });

  it('fails closed if an owner-scoped task pull returns another account', async () => {
    listRowsMock.mockResolvedValue({
      rows: [remoteTask({ user_id: 'mallory' })],
    });

    await expect(
      __taskReplicationPilotTestUtils.pullTasks('user_A', undefined, 100)
    ).rejects.toThrow('remote owner mismatch');
  });

  it('creates a new task with owner-only row permissions', async () => {
    getRowMock.mockRejectedValue(
      Object.assign(new Error('missing'), { code: 404 })
    );

    const conflicts = await __taskReplicationPilotTestUtils.pushTasks(
      [{ newDocumentState: localTask() }] as never,
      'user_A'
    );

    expect(conflicts).toEqual([]);
    expect(createRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'tasks',
        rowId: 'task_one',
        permissions: [
          'read(user:user_A)',
          'update(user:user_A)',
          'delete(user:user_A)',
        ],
      })
    );
  });

  it('reports unique successful task sends from the active RxDB replication', async () => {
    await startTaskReplicationPilot(
      'user_A',
      collectionFixture(),
      undefined
    );

    const progress: Array<{ completed: number; total: number }> = [];
    const stop = subscribeTaskPushProgress(
      'user_A',
      ['todo_one', 'todo_two'],
      (value) => progress.push(value)
    );

    expect(stop).not.toBeNull();
    sentSubject.next(localTask({ id: 'todo_one', source: 'todomate' }));
    sentSubject.next(localTask({ id: 'todo_one', source: 'todomate' }));
    sentSubject.next(localTask({ id: 'other', source: 'todomate' }));
    sentSubject.next(localTask({ id: 'todo_two', source: 'todomate' }));

    expect(progress).toEqual([
      { completed: 0, total: 2 },
      { completed: 1, total: 2 },
      { completed: 2, total: 2 },
    ]);
    stop?.();
  });

  it('sends a pristine TodoMate push batch through one trusted Function execution', async () => {
    const rows = Array.from({ length: 4 }, (_, index) => ({
      newDocumentState: localTask({
        id: 'todo_' + index,
        source: 'todomate',
      }),
    })) as never;
    sendAppActionMock.mockResolvedValueOnce({
      ok: true,
      results: Array.from({ length: 4 }, (_, index) => ({
        id: 'todo_' + index,
        status: 'created',
      })),
    });

    await expect(
      __taskReplicationPilotTestUtils.pushTasks(rows, 'user_A')
    ).resolves.toEqual([]);

    expect(sendAppActionMock).toHaveBeenCalledTimes(1);
    expect(sendAppActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'bulk_create_todomate_tasks',
        tasks: expect.arrayContaining([
          expect.objectContaining({
            id: 'todo_0',
            data: expect.objectContaining({
              user_id: 'user_A',
              source: 'todomate',
              deleted: false,
            }),
          }),
        ]),
      }),
      25_000
    );
    expect(createRowMock).not.toHaveBeenCalled();
    expect(getRowMock).not.toHaveBeenCalled();
  });

  it('falls back to the paced browser lane when the deployed Function lacks the batch action', async () => {
    vi.useFakeTimers();
    try {
      const starts: number[] = [];
      createRowMock.mockImplementation(async () => {
        starts.push(Date.now());
        return {};
      });
      const rows = Array.from({ length: 4 }, (_, index) => ({
        newDocumentState: localTask({
          id: 'todo_' + index,
          source: 'todomate',
        }),
      })) as never;

      const push = __taskReplicationPilotTestUtils.pushTasks(rows, 'user_A');
      await vi.advanceTimersByTimeAsync(3_000);
      await expect(push).resolves.toEqual([]);

      expect(sendAppActionMock).toHaveBeenCalledTimes(1);
      expect(createRowMock).toHaveBeenCalledTimes(4);
      for (let index = 1; index < starts.length; index += 1) {
        expect(starts[index] - starts[index - 1]).toBeGreaterThanOrEqual(510);
      }
    } finally {
      vi.useRealTimers();
      __taskReplicationPilotTestUtils.resetTodoMateCreatePacing();
    }
  });

  it('uses returned existing server state for TodoMate batch conflicts', async () => {
    const rows = [
      {
        newDocumentState: localTask({
          id: 'todo_existing',
          source: 'todomate',
          updatedAt: '2026-10-02T00:00:00.000Z',
        }),
      },
      {
        newDocumentState: localTask({
          id: 'todo_created',
          source: 'todomate',
        }),
      },
    ] as never;
    sendAppActionMock.mockResolvedValueOnce({
      ok: true,
      results: [
        {
          id: 'todo_existing',
          status: 'existing',
          row: remoteTask({
            $id: 'todo_existing',
            source: 'todomate',
            title: 'Remote wins',
            updated_at: '2026-10-02T00:00:05.000Z',
          }),
        },
        { id: 'todo_created', status: 'created' },
      ],
    });

    const conflicts =
      await __taskReplicationPilotTestUtils.pushTasks(rows, 'user_A');

    expect(conflicts).toEqual([
      expect.objectContaining({
        id: 'todo_existing',
        title: 'Remote wins',
      }),
    ]);
    expect(createRowMock).not.toHaveBeenCalled();
    expect(updateRowMock).not.toHaveBeenCalled();
  });

  it('creates a fresh TodoMate task without a preliminary remote read', async () => {
    const conflicts = await __taskReplicationPilotTestUtils.pushTasks(
      [
        {
          newDocumentState: localTask({ source: 'todomate' }),
        },
      ] as never,
      'user_A'
    );

    expect(conflicts).toEqual([]);
    expect(createRowMock).toHaveBeenCalledTimes(1);
    expect(getRowMock).not.toHaveBeenCalled();
  });

  it('falls back to the existing bootstrap conflict path when TodoMate create-first races with an existing row', async () => {
    createRowMock.mockRejectedValueOnce(
      Object.assign(new Error('Already exists'), { code: 409 })
    );
    getRowMock.mockResolvedValueOnce(
      remoteTask({ source: 'todomate' })
    );

    const conflicts = await __taskReplicationPilotTestUtils.pushTasks(
      [
        {
          newDocumentState: localTask({ source: 'todomate' }),
        },
      ] as never,
      'user_A'
    );

    expect(conflicts).toEqual([]);
    expect(createRowMock).toHaveBeenCalledTimes(1);
    expect(getRowMock).toHaveBeenCalledTimes(1);
    expect(updateRowMock).not.toHaveBeenCalled();
  });

  it('acknowledges identical first-sync task state without rewriting Appwrite', async () => {
    const conflicts = await __taskReplicationPilotTestUtils.pushTasks(
      [{ newDocumentState: localTask() }] as never,
      'user_A'
    );

    expect(conflicts).toEqual([]);
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(createRowMock).not.toHaveBeenCalled();
  });

  it('writes a genuinely newer first-sync task edit once', async () => {
    const conflicts = await __taskReplicationPilotTestUtils.pushTasks(
      [
        {
          newDocumentState: localTask({
            title: 'Offline edit',
            updatedAt: '2026-10-02T00:00:02.000Z',
          }),
        },
      ] as never,
      'user_A'
    );

    expect(conflicts).toEqual([]);
    expect(updateRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rowId: 'task_one',
        data: expect.objectContaining({
          title: 'Offline edit',
        }),
      })
    );
    expect(createRowMock).not.toHaveBeenCalled();
  });

  it('turns a post-read concurrent owner write into an RxDB conflict', async () => {
    sendAppActionMock.mockResolvedValueOnce({
      status: 'conflict',
      row: remoteTask({
        $updatedAt: '2026-10-02T00:00:02.000Z',
        title: 'Other device',
        updated_at: '2026-10-02T00:00:02.000Z',
      }),
    });

    const conflicts = await __taskReplicationPilotTestUtils.pushTasks(
      [
        {
          assumedMasterState: localTask(),
          newDocumentState: localTask({
            title: 'This device',
            updatedAt: '2026-10-02T00:00:02.000Z',
          }),
        },
      ],
      'user_A'
    );

    expect(sendAppActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'compare_and_set_owner_row',
        tableId: 'tasks',
        rowId: 'task_one',
        expectedUpdatedAt: '2026-10-02T00:00:01.000Z',
      }),
      15_000
    );
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(conflicts).toEqual([
      expect.objectContaining({ title: 'Other device' }),
    ]);
  });

  it('falls back from update 404 to strict createRow', async () => {
    updateRowMock.mockRejectedValue(
      Object.assign(new Error('missing'), { code: 404 })
    );

    const state = localTask();
    const conflicts = await __taskReplicationPilotTestUtils.pushTasks(
      [
        {
          assumedMasterState: state,
          newDocumentState: {
            ...state,
            title: 'Edited',
            updatedAt: '2026-10-02T00:00:02.000Z',
          },
        },
      ] as never,
      'user_A'
    );

    expect(conflicts).toEqual([]);
    expect(updateRowMock).toHaveBeenCalledTimes(1);
    expect(createRowMock).toHaveBeenCalledTimes(1);
  });

  it('uploads a pending task image before the row write and returns the resolved local state', async () => {
    const pending = 'localimg_0123456789abcdef0123456789';
    const state = localTask();

    const conflicts = await __taskReplicationPilotTestUtils.pushTasks(
      [
        {
          assumedMasterState: state,
          newDocumentState: {
            ...state,
            image: pending,
            updatedAt: '2026-10-02T00:00:02.000Z',
          },
        },
      ] as never,
      'user_A'
    );

    expect(uploadPendingImageMock).toHaveBeenCalledWith(
      pending,
      'user_A'
    );
    expect(updateRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ image: 'img_uploaded' }),
      })
    );
    expect(deletePendingImageMock).toHaveBeenCalledWith(
      pending,
      'user_A'
    );
    expect(conflicts).toEqual([
      expect.objectContaining({ image: 'img_uploaded' }),
    ]);
  });

  it('keeps a pending image available when the row write fails', async () => {
    const pending = 'localimg_0123456789abcdef0123456789';
    const state = localTask();
    updateRowMock.mockRejectedValue(new Error('offline'));

    await expect(
      __taskReplicationPilotTestUtils.pushTasks(
        [
          {
            assumedMasterState: state,
            newDocumentState: {
              ...state,
              image: pending,
              updatedAt: '2026-10-02T00:00:02.000Z',
            },
          },
        ] as never,
        'user_A'
      )
    ).rejects.toThrow('offline');

    expect(deletePendingImageMock).not.toHaveBeenCalled();
  });

  it('drops a pending image from a soft-deleted task after the tombstone is stored', async () => {
    const pending = 'localimg_0123456789abcdef0123456789';
    const state = localTask();

    const conflicts = await __taskReplicationPilotTestUtils.pushTasks(
      [
        {
          assumedMasterState: state,
          newDocumentState: {
            ...state,
            image: pending,
            isDeleted: true,
            updatedAt: '2026-10-02T00:00:02.000Z',
          },
        },
      ] as never,
      'user_A'
    );

    expect(uploadPendingImageMock).not.toHaveBeenCalled();
    expect(updateRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          image: '',
          deleted: true,
        }),
      })
    );
    expect(deletePendingImageMock).toHaveBeenCalledWith(
      pending,
      'user_A'
    );
    expect(conflicts).toEqual([
      expect.objectContaining({ image: '', isDeleted: true }),
    ]);
  });

  it('drops reactions from users who are no longer accepted friends before push', async () => {
    const assumed = localTask({
      reactions:
        '[{"emoji":"👍","userIds":["friend_live","friend_old"]}]',
      updatedAt: '2026-10-02T00:00:00.000Z',
    });
    getRowMock.mockResolvedValue(
      remoteTask({
        reactions:
          '[{"emoji":"👍","userIds":["friend_live","friend_old"]}]',
      })
    );
    listRowsMock.mockImplementation(async ({ tableId }: any) => {
      if (tableId === 'friendships') {
        return {
          rows: [{
            $id: 'fr_live',
            user_id: 'user_A',
            friend_id: 'friend_live',
            status: 'accepted',
            deleted: false,
          }],
        };
      }
      return { rows: [] };
    });

    const conflicts = await __taskReplicationPilotTestUtils.pushTasks(
      [{
        assumedMasterState: assumed,
        newDocumentState: {
          ...assumed,
          memo: 'owner edit',
          updatedAt: '2026-10-02T00:00:03.000Z',
        },
      }] as never,
      'user_A'
    );

    expect(updateRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reactions: '[{"emoji":"👍","userIds":["friend_live"]}]',
        }),
      })
    );
    expect(conflicts).toEqual([
      expect.objectContaining({
        reactions: '[{"emoji":"👍","userIds":["friend_live"]}]',
      }),
    ]);
  });

  it('preserves a server-side friend reaction while pushing an owner edit', async () => {
    listRowsMock.mockImplementation(async ({ tableId }: any) => {
      if (tableId === 'friendships') {
        return {
          rows: [{
            $id: 'fr_friend',
            user_id: 'user_A',
            friend_id: 'friend',
            status: 'accepted',
            deleted: false,
          }],
        };
      }
      return { rows: [] };
    });
    const assumed = localTask({
      reactions: '',
      updatedAt: '2026-10-02T00:00:00.000Z',
    });
    getRowMock.mockResolvedValue(
      remoteTask({
        reactions: '[{"emoji":"👍","userIds":["friend"]}]',
        updated_at: '2026-10-02T00:00:05.000Z',
      })
    );

    const conflicts = await __taskReplicationPilotTestUtils.pushTasks(
      [
        {
          assumedMasterState: assumed,
          newDocumentState: {
            ...assumed,
            title: 'Edited locally',
            updatedAt: '2026-10-02T00:00:03.000Z',
          },
        },
      ] as never,
      'user_A'
    );

    expect(updateRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Edited locally',
          reactions: '[{"emoji":"👍","userIds":["friend"]}]',
          updated_at: '2026-10-02T00:00:05.000Z',
        }),
      })
    );
    expect(conflicts).toEqual([
      expect.objectContaining({
        title: 'Edited locally',
        reactions: '[{"emoji":"👍","userIds":["friend"]}]',
        updatedAt: '2026-10-02T00:00:05.000Z',
      }),
    ]);
  });


  it('preserves remote shared completion while pushing an offline owner title edit', async () => {
    const assumed = localTask();
    getRowMock.mockResolvedValue(remoteTask({
      is_completed: true, completed_at: '2026-10-02T00:00:05.000Z',
      updated_at: '2026-10-02T00:00:05.000Z',
    }));
    const conflicts = await __taskReplicationPilotTestUtils.pushTasks([{
      assumedMasterState: assumed,
      newDocumentState: { ...assumed, title: 'Owner offline edit',
        updatedAt: '2026-10-02T00:00:04.000Z' },
    }] as never, 'user_A');

    expect(updateRowMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: 'Owner offline edit',
        is_completed: true,
        completed_at: '2026-10-02T00:00:05.000Z',
      }),
    }));
    expect(conflicts).toEqual([expect.objectContaining({
      title: 'Owner offline edit', completed: true,
    })]);
  });

  it('rejects conflicting owner/participant offline completion and displays warning', async () => {
    const assumed = localTask();
    getRowMock.mockResolvedValue(remoteTask({
      is_completed: true, completed_at: '2026-10-02T00:00:05.000Z',
      updated_at: '2026-10-02T00:00:05.000Z',
    }));
    const conflicts = await __taskReplicationPilotTestUtils.pushTasks([{
      assumedMasterState: assumed,
      newDocumentState: { ...assumed, completed: true,
        completedAt: '2026-10-02T00:00:03.000Z',
        updatedAt: '2026-10-02T00:00:03.000Z' },
    }] as never, 'user_A');
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(conflicts).toEqual([expect.objectContaining({
      completed: true, completedAt: '2026-10-02T00:00:05.000Z',
    })]);
  });
  it('returns the remote master when an owner-controlled field changed remotely', async () => {
    const assumed = localTask();
    getRowMock.mockResolvedValue(
      remoteTask({
        title: 'Edited elsewhere',
        updated_at: '2026-10-02T00:00:05.000Z',
      })
    );

    const conflicts = await __taskReplicationPilotTestUtils.pushTasks(
      [
        {
          assumedMasterState: assumed,
          newDocumentState: {
            ...assumed,
            memo: 'local memo',
            updatedAt: '2026-10-02T00:00:03.000Z',
          },
        },
      ] as never,
      'user_A'
    );

    expect(updateRowMock).not.toHaveBeenCalled();
    expect(conflicts).toEqual([
      expect.objectContaining({
        title: 'Edited elsewhere',
        memo: '',
      }),
    ]);
  });

  it('cleans an obsolete pending image when the server master wins', async () => {
    const pending = 'localimg_0123456789abcdef0123456789';
    const assumed = localTask();
    getRowMock.mockResolvedValue(
      remoteTask({
        title: 'Edited elsewhere',
        updated_at: '2026-10-02T00:00:05.000Z',
      })
    );

    await __taskReplicationPilotTestUtils.pushTasks(
      [
        {
          assumedMasterState: assumed,
          newDocumentState: {
            ...assumed,
            image: pending,
            updatedAt: '2026-10-02T00:00:03.000Z',
          },
        },
      ] as never,
      'user_A'
    );

    expect(uploadPendingImageMock).not.toHaveBeenCalled();
    expect(deletePendingImageMock).toHaveBeenCalledWith(
      pending,
      'user_A'
    );
  });

  it('uses realtime writes only as an ordered pull catch-up signal', async () => {
    const collection = collectionFixture();
    await startTaskReplicationPilot(
      'user_A',
      collection,
      { id: 'task_seed', lwt: 77 }
    );

    const options = replicateRxCollectionMock.mock.calls[0][0];
    const next = firstValueFrom(options.pull.stream$);
    const callback = realtimeSubscribeMock.mock.calls[0][1];

    callback({
      events: [
        'databases.life_tracker.tables.tasks.rows.task_one.update',
      ],
      channels: [],
      timestamp: '',
      payload: remoteTask({
        $updatedAt: '2026-10-02T00:00:05.000Z',
        reactions: '[{"emoji":"👍","userIds":["friend"]}]',
      }),
    });

    await expect(next).resolves.toBe('RESYNC');
  });

  it('rejects physical deletion for the active owner but ignores cached foreign-account rows', async () => {
    await expect(
      __taskReplicationPilotTestUtils.pushTasks(
        [
          {
            newDocumentState: localTask({ _deleted: true }),
          },
        ] as never,
        'user_A'
      )
    ).rejects.toThrow('cannot physically delete');

    getRowMock.mockClear();
    await expect(
      __taskReplicationPilotTestUtils.pushTasks(
        [
          {
            newDocumentState: localTask({ userId: 'mallory' }),
          },
        ] as never,
        'user_A'
      )
    ).resolves.toEqual([]);
    expect(getRowMock).not.toHaveBeenCalled();
  });
});
