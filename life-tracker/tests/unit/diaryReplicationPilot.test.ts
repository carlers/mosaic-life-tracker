import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { firstValueFrom } from 'rxjs';

const getChangedDocumentsSinceMock = vi.hoisted(() => vi.fn());
const replicateRxCollectionMock = vi.hoisted(() => vi.fn());
const listRowsMock = vi.hoisted(() => vi.fn());
const getRowMock = vi.hoisted(() => vi.fn());
const updateRowMock = vi.hoisted(() => vi.fn());
const createRowMock = vi.hoisted(() => vi.fn());
const realtimeSubscribeMock = vi.hoisted(() => vi.fn());
const reSyncMock = vi.hoisted(() => vi.fn());
const awaitInSyncMock = vi.hoisted(() => vi.fn());
const cancelMock = vi.hoisted(() => vi.fn());
const errorSubscribeMock = vi.hoisted(() => vi.fn());
const trackReplicationFreshnessMock = vi.hoisted(() => vi.fn());

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
    and: (queries: string[]) =>
      JSON.stringify({ op: 'and', queries }),
    or: (queries: string[]) =>
      JSON.stringify({ op: 'or', queries }),
    orderAsc: (field: string) =>
      JSON.stringify({ op: 'orderAsc', field }),
    limit: (value: number) =>
      JSON.stringify({ op: 'limit', value }),
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

vi.mock('../../src/db/replicationLocalState', () => ({
  trackReplicationFreshness: trackReplicationFreshnessMock,
}));

import {
  __diaryReplicationPilotTestUtils,
  captureDiaryReplicationPushCheckpoint,
  refreshDiaryReplicationPilot,
  startDiaryReplicationPilot,
  stopDiaryReplicationPilot,
} from '../../src/db/diaryReplicationPilot';

function localDiary(overrides: Record<string, unknown> = {}) {
  return {
    id: 'diary_a',
    userId: 'user_A',
    date: '2026-10-02',
    content: 'Local entry',
    visibility: 'private',
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:01.000Z',
    isDeleted: false,
    _deleted: false,
    ...overrides,
  };
}

function remoteDiary(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'diary_a',
    $updatedAt: '2026-10-02T00:00:02.000Z',
    user_id: 'user_A',
    date: '2026-10-02',
    content: 'Remote entry',
    visibility: 'private',
    created_at: '2026-10-02T00:00:00.000Z',
    updated_at: '2026-10-02T00:00:01.000Z',
    deleted: false,
    ...overrides,
  };
}

function collectionFixture(isLeader = true) {
  return {
    storageInstance: {},
    database: {
      isLeader: () => isLeader,
      waitForLeadership: async () => isLeader,
    },
  } as never;
}

beforeEach(async () => {
  await stopDiaryReplicationPilot();
  vi.clearAllMocks();
  trackReplicationFreshnessMock.mockImplementation(() => undefined);
  getChangedDocumentsSinceMock.mockResolvedValue({
    documents: [],
    checkpoint: { id: 'diary_z', lwt: 123 },
  });
  listRowsMock.mockResolvedValue({ rows: [] });
  getRowMock.mockResolvedValue(remoteDiary());
  updateRowMock.mockResolvedValue({});
  createRowMock.mockResolvedValue({});
  cancelMock.mockResolvedValue(true);
  awaitInSyncMock.mockResolvedValue(true);
  errorSubscribeMock.mockReturnValue({ unsubscribe: vi.fn() });
  realtimeSubscribeMock.mockReturnValue(vi.fn());
  replicateRxCollectionMock.mockReturnValue({
    reSync: reSyncMock,
    awaitInSync: awaitInSyncMock,
    cancel: cancelMock,
    error$: { subscribe: errorSubscribeMock },
  });
});

afterEach(async () => {
  await stopDiaryReplicationPilot();
});

describe('diary RxDB replication pilot', () => {
  it('captures the current local checkpoint for the pre-bootstrap seed', async () => {
    const checkpoint = await captureDiaryReplicationPushCheckpoint(
      collectionFixture()
    );

    expect(getChangedDocumentsSinceMock).toHaveBeenCalledWith(
      {},
      200,
      undefined
    );
    expect(checkpoint).toEqual({
      id: 'diary_z',
      lwt: 123,
    });
  });

  it('starts from the caller-supplied checkpoint without rescanning local history', async () => {
    const checkpoint = { id: 'diary_seed', lwt: 77 };

    await startDiaryReplicationPilot(
      'user_A',
      collectionFixture(),
      checkpoint
    );

    expect(getChangedDocumentsSinceMock).not.toHaveBeenCalled();
    const options = replicateRxCollectionMock.mock.calls[0][0];
    expect(options.push.initialCheckpoint).toEqual(checkpoint);
    expect(options.waitForLeadership).toBe(true);
    expect(options.live).toBe(true);
  });

  it('awaits a real fresh cycle when this tab owns RxDB leadership', async () => {
    await startDiaryReplicationPilot(
      'user_A',
      collectionFixture(true),
      { id: 'diary_seed', lwt: 77 }
    );

    await expect(
      refreshDiaryReplicationPilot('user_A', 1_000)
    ).resolves.toBe(true);

    expect(reSyncMock).toHaveBeenCalled();
    expect(awaitInSyncMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed when another tab owns RxDB leadership', async () => {
    await startDiaryReplicationPilot(
      'user_A',
      collectionFixture(false),
      { id: 'diary_seed', lwt: 77 }
    );

    await expect(
      refreshDiaryReplicationPilot('user_A', 1_000)
    ).rejects.toThrow('another Mosaic tab');
  });

  it('pulls with an owner-scoped updatedAt+id tuple checkpoint', async () => {
    listRowsMock.mockResolvedValue({
      rows: [
        remoteDiary({
          $id: 'diary_b',
          $updatedAt: '2026-10-02T00:00:03.000Z',
          deleted: true,
        }),
      ],
    });

    const result =
      await __diaryReplicationPilotTestUtils.pullDiary(
        'user_A',
        {
          id: 'diary_a',
          updatedAt: '2026-10-02T00:00:02.000Z',
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
    expect(result.checkpoint).toEqual({
      id: 'diary_b',
      updatedAt: '2026-10-02T00:00:03.000Z',
    });
    expect(result.documents[0]).toEqual(
      expect.objectContaining({
        id: 'diary_b',
        userId: 'user_A',
        isDeleted: true,
        _deleted: false,
      })
    );
  });

  it('creates a missing remote row with createRow', async () => {
    getRowMock.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 404 })
    );

    await __diaryReplicationPilotTestUtils.pushDiary(
      [{ newDocumentState: localDiary() }],
      'user_A'
    );

    expect(createRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rowId: 'diary_a',
        data: expect.objectContaining({
          user_id: 'user_A',
          content: 'Local entry',
          deleted: false,
        }),
      })
    );
    expect(updateRowMock).not.toHaveBeenCalled();
  });

  it('acknowledges identical first-sync diary state without rewriting Appwrite', async () => {
    getRowMock.mockResolvedValue(
      remoteDiary({ content: 'Local entry' })
    );

    const conflicts =
      await __diaryReplicationPilotTestUtils.pushDiary(
        [{ newDocumentState: localDiary() }],
        'user_A'
      );

    expect(conflicts).toEqual([]);
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(createRowMock).not.toHaveBeenCalled();
  });

  it('writes a genuinely newer first-sync diary edit once', async () => {
    const conflicts =
      await __diaryReplicationPilotTestUtils.pushDiary(
        [
          {
            newDocumentState: localDiary({
              content: 'Offline edit',
              updatedAt: '2026-10-02T00:00:03.000Z',
            }),
          },
        ],
        'user_A'
      );

    expect(conflicts).toEqual([]);
    expect(updateRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rowId: 'diary_a',
        data: expect.objectContaining({ content: 'Offline edit' }),
      })
    );
    expect(createRowMock).not.toHaveBeenCalled();
  });

  it('returns the current master as a conflict instead of overwriting it', async () => {
    getRowMock.mockResolvedValue(
      remoteDiary({ content: 'Server version' })
    );

    const conflicts =
      await __diaryReplicationPilotTestUtils.pushDiary(
        [
          {
            assumedMasterState: localDiary({ content: 'Old version' }),
            newDocumentState: localDiary({ content: 'Local version' }),
          },
        ],
        'user_A'
      );

    expect(updateRowMock).not.toHaveBeenCalled();
    expect(conflicts).toEqual([
      expect.objectContaining({
        id: 'diary_a',
        content: 'Server version',
        _deleted: false,
      }),
    ]);
  });

  it('falls back from update 404 to strict createRow', async () => {
    getRowMock.mockResolvedValue(
      remoteDiary({ content: 'Local entry' })
    );
    updateRowMock.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 404 })
    );
    const state = localDiary();

    const conflicts =
      await __diaryReplicationPilotTestUtils.pushDiary(
        [{ assumedMasterState: state, newDocumentState: state }],
        'user_A'
      );

    expect(conflicts).toEqual([]);
    expect(updateRowMock).toHaveBeenCalledTimes(1);
    expect(createRowMock).toHaveBeenCalledTimes(1);
  });

  it('streams owner-scoped realtime updates into replication', async () => {
    await startDiaryReplicationPilot(
      'user_A',
      collectionFixture(),
      { id: 'diary_seed', lwt: 77 }
    );
    const options = replicateRxCollectionMock.mock.calls[0][0];
    const next = firstValueFrom(options.pull.stream$);
    const callback = realtimeSubscribeMock.mock.calls[0][1];

    callback({
      events: [
        'databases.life_tracker.tables.diary.rows.diary_a.update',
      ],
      channels: [],
      timestamp: '',
      payload: remoteDiary(),
    });

    await expect(next).resolves.toEqual({
      checkpoint: {
        id: 'diary_a',
        updatedAt: '2026-10-02T00:00:02.000Z',
      },
      documents: [
        expect.objectContaining({
          id: 'diary_a',
          userId: 'user_A',
          _deleted: false,
        }),
      ],
    });
  });
});
