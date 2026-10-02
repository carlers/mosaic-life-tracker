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
const cancelMock = vi.hoisted(() => vi.fn());
const errorSubscribeMock = vi.hoisted(() => vi.fn());

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

import {
  __categoryReplicationPilotTestUtils,
  startCategoryReplicationPilot,
  stopCategoryReplicationPilot,
} from '../../src/db/categoryReplicationPilot';

function localCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cat_a',
    userId: 'user_A',
    name: 'Work',
    color: '#3B82F6',
    order: 0,
    visibility: 'private',
    isDeleted: false,
    icon: '',
    updatedAt: '2026-10-02T00:00:00.000Z',
    _deleted: false,
    ...overrides,
  };
}

function remoteCategory(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'cat_a',
    $updatedAt: '2026-10-02T00:00:01.000Z',
    user_id: 'user_A',
    name: 'Work',
    color: '#3B82F6',
    order: 0,
    visibility: 'private',
    deleted: false,
    icon: '',
    updated_at: '2026-10-02T00:00:00.000Z',
    ...overrides,
  };
}

function collectionFixture() {
  return { storageInstance: {} } as never;
}

beforeEach(async () => {
  await stopCategoryReplicationPilot();
  vi.clearAllMocks();
  getChangedDocumentsSinceMock.mockResolvedValue({
    documents: [],
    checkpoint: { id: 'cat_z', lwt: 123 },
  });
  listRowsMock.mockResolvedValue({ rows: [] });
  getRowMock.mockResolvedValue(remoteCategory());
  updateRowMock.mockResolvedValue({});
  createRowMock.mockResolvedValue({});
  cancelMock.mockResolvedValue(true);
  errorSubscribeMock.mockReturnValue({ unsubscribe: vi.fn() });
  realtimeSubscribeMock.mockReturnValue(vi.fn());
  replicateRxCollectionMock.mockReturnValue({
    reSync: reSyncMock,
    cancel: cancelMock,
    error$: { subscribe: errorSubscribeMock },
  });
});

afterEach(async () => {
  await stopCategoryReplicationPilot();
});

describe('category RxDB replication pilot', () => {
  it('seeds upstream from the post-bootstrap local checkpoint', async () => {
    await startCategoryReplicationPilot('user_A', collectionFixture());

    expect(getChangedDocumentsSinceMock).toHaveBeenCalledWith(
      {},
      200,
      undefined
    );
    const options = replicateRxCollectionMock.mock.calls[0][0];
    expect(options.push.initialCheckpoint).toEqual({
      id: 'cat_z',
      lwt: 123,
    });
    expect(options.waitForLeadership).toBe(true);
    expect(options.live).toBe(true);
  });

  it('pulls with an owner-scoped updatedAt+id tuple checkpoint', async () => {
    listRowsMock.mockResolvedValue({
      rows: [
        remoteCategory({
          $id: 'cat_b',
          $updatedAt: '2026-10-02T00:00:02.000Z',
          deleted: true,
        }),
      ],
    });

    const result =
      await __categoryReplicationPilotTestUtils.pullCategories(
        'user_A',
        {
          id: 'cat_a',
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
    expect(result.checkpoint).toEqual({
      id: 'cat_b',
      updatedAt: '2026-10-02T00:00:02.000Z',
    });
    expect(result.documents[0]).toEqual(
      expect.objectContaining({
        id: 'cat_b',
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

    await __categoryReplicationPilotTestUtils.pushCategories(
      [{ newDocumentState: localCategory() }],
      'user_A'
    );

    expect(createRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rowId: 'cat_a',
        data: expect.objectContaining({
          user_id: 'user_A',
          deleted: false,
        }),
      })
    );
    expect(updateRowMock).not.toHaveBeenCalled();
  });

  it('returns the current master as a conflict instead of overwriting it', async () => {
    getRowMock.mockResolvedValue(
      remoteCategory({ name: 'Server version' })
    );

    const conflicts =
      await __categoryReplicationPilotTestUtils.pushCategories(
        [
          {
            assumedMasterState: localCategory({ name: 'Old version' }),
            newDocumentState: localCategory({ name: 'Local version' }),
          },
        ],
        'user_A'
      );

    expect(updateRowMock).not.toHaveBeenCalled();
    expect(conflicts).toEqual([
      expect.objectContaining({
        id: 'cat_a',
        name: 'Server version',
        _deleted: false,
      }),
    ]);
  });

  it('falls back from update 404 to strict createRow', async () => {
    updateRowMock.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 404 })
    );
    const state = localCategory();

    const conflicts =
      await __categoryReplicationPilotTestUtils.pushCategories(
        [{ assumedMasterState: state, newDocumentState: state }],
        'user_A'
      );

    expect(conflicts).toEqual([]);
    expect(updateRowMock).toHaveBeenCalledTimes(1);
    expect(createRowMock).toHaveBeenCalledTimes(1);
  });

  it('streams owner-scoped Appwrite realtime updates into replication', async () => {
    await startCategoryReplicationPilot('user_A', collectionFixture());
    const options = replicateRxCollectionMock.mock.calls[0][0];
    const next = firstValueFrom(options.pull.stream$);
    const callback = realtimeSubscribeMock.mock.calls[0][1];

    callback({
      events: [
        'databases.life_tracker.tables.categories.rows.cat_a.update',
      ],
      channels: [],
      timestamp: '',
      payload: remoteCategory(),
    });

    await expect(next).resolves.toEqual({
      checkpoint: {
        id: 'cat_a',
        updatedAt: '2026-10-02T00:00:01.000Z',
      },
      documents: [
        expect.objectContaining({
          id: 'cat_a',
          userId: 'user_A',
          _deleted: false,
        }),
      ],
    });
  });
});
