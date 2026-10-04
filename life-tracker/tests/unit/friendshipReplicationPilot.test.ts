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
const trackReplicationFreshnessMock = vi.hoisted(() => vi.fn());
const clearCachedCalendarMock = vi.hoisted(() => vi.fn());
const awaitPilotReplicationFreshnessMock = vi.hoisted(() => vi.fn());

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

vi.mock('../../src/lib/friendCache', () => ({
  clearCachedCalendar: clearCachedCalendarMock,
}));

vi.mock('../../src/db/replicationLocalState', () => ({
  trackReplicationFreshness: trackReplicationFreshnessMock,
}));

vi.mock('../../src/db/replicationFreshness', () => ({
  awaitPilotReplicationFreshness: awaitPilotReplicationFreshnessMock,
}));

import {
  __friendshipReplicationPilotTestUtils,
  captureFriendshipReplicationPushCheckpoint,
  refreshFriendshipReplicationPilot,
  startFriendshipReplicationPilot,
  stopFriendshipReplicationPilot,
} from '../../src/db/friendshipReplicationPilot';

function localFriendship(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fr_one',
    userId: 'user_A',
    friendId: 'user_B',
    friendUsername: 'friend',
    friendDisplayName: 'Friend',
    friendAvatarFileId: 'avatar_1',
    friendBio: 'bio',
    status: 'accepted',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    isDeleted: false,
    _deleted: false,
    ...overrides,
  };
}

function remoteFriendship(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'fr_one',
    $updatedAt: '2026-10-02T00:00:01.000Z',
    user_id: 'user_A',
    friend_id: 'user_B',
    friend_username: 'friend',
    friend_display_name: 'Friend',
    friend_avatar_file_id: 'avatar_1',
    friend_bio: 'bio',
    status: 'accepted',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-02T00:00:00.000Z',
    deleted: false,
    ...overrides,
  };
}

function collectionFixture(localDoc?: Record<string, unknown>) {
  const doc = localDoc
    ? {
        ...localDoc,
        incrementalModify: vi.fn(async (fn) => {
          const next = fn(doc);
          Object.assign(doc, next);
          return doc;
        }),
      }
    : null;

  return {
    collection: {
      storageInstance: {},
      database: {
        isLeader: () => true,
        waitForLeadership: async () => true,
      },
      findOne: () => ({ exec: async () => doc }),
    } as never,
    doc,
  };
}

beforeEach(async () => {
  await stopFriendshipReplicationPilot();
  vi.clearAllMocks();
  trackReplicationFreshnessMock.mockImplementation(() => undefined);

  getChangedDocumentsSinceMock.mockResolvedValue({
    documents: [],
    checkpoint: { id: 'fr_seed', lwt: 123 },
  });
  listRowsMock.mockResolvedValue({ rows: [] });
  getRowMock.mockResolvedValue(remoteFriendship());
  updateRowMock.mockResolvedValue({});
  createRowMock.mockResolvedValue({});
  clearCachedCalendarMock.mockResolvedValue(undefined);
  cancelMock.mockResolvedValue(true);
  errorSubscribeMock.mockReturnValue({ unsubscribe: vi.fn() });
  realtimeSubscribeMock.mockReturnValue(vi.fn());
  awaitPilotReplicationFreshnessMock.mockResolvedValue(undefined);
  replicateRxCollectionMock.mockReturnValue({
    reSync: reSyncMock,
    cancel: cancelMock,
    error$: { subscribe: errorSubscribeMock },
  });
});

afterEach(async () => {
  await stopFriendshipReplicationPilot();
});

describe('friendship RxDB replication pilot', () => {
  it('captures the current local checkpoint for the pre-bootstrap seed', async () => {
    const { collection } = collectionFixture();

    const checkpoint =
      await captureFriendshipReplicationPushCheckpoint(collection);

    expect(getChangedDocumentsSinceMock).toHaveBeenCalledWith(
      {},
      200,
      undefined
    );
    expect(checkpoint).toEqual({ id: 'fr_seed', lwt: 123 });
  });

  it('starts with the caller-supplied checkpoint and a validation-only upstream', async () => {
    const { collection } = collectionFixture();
    const checkpoint = { id: 'fr_seed', lwt: 77 };

    await startFriendshipReplicationPilot(
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

  it('uses the shared leader-owned freshness barrier when active', async () => {
    const { collection } = collectionFixture();
    await startFriendshipReplicationPilot(
      'user_A',
      collection,
      { id: 'fr_seed', lwt: 77 }
    );

    await expect(
      refreshFriendshipReplicationPilot('user_A', 5_000)
    ).resolves.toBe(true);

    expect(awaitPilotReplicationFreshnessMock).toHaveBeenCalledWith(
      'friendship',
      replicateRxCollectionMock.mock.results[0].value,
      collection,
      5_000
    );
  });

  it('pulls with an owner-scoped updatedAt+id tuple checkpoint', async () => {
    listRowsMock.mockResolvedValue({
      rows: [
        remoteFriendship({
          $id: 'fr_two',
          $updatedAt: '2026-10-02T00:00:03.000Z',
          status: 'blocked',
        }),
      ],
    });

    const result =
      await __friendshipReplicationPilotTestUtils.pullFriendships(
        'user_A',
        {
          id: 'fr_one',
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
        id: 'fr_two',
        userId: 'user_A',
        status: 'blocked',
        _deleted: false,
      })
    );
    expect(result.checkpoint).toEqual({
      id: 'fr_two',
      updatedAt: '2026-10-02T00:00:03.000Z',
    });
    expect(clearCachedCalendarMock).toHaveBeenCalledWith(
      'user_A',
      'user_B'
    );
  });

  it('fails closed if an owner-scoped friendship pull returns another account', async () => {
    listRowsMock.mockResolvedValue({
      rows: [remoteFriendship({ user_id: 'mallory' })],
    });

    await expect(
      __friendshipReplicationPilotTestUtils.pullFriendships(
        'user_A',
        undefined,
        100
      )
    ).rejects.toThrow('remote owner mismatch');
  });

  it('acknowledges a confirmed local state without writing the server', async () => {
    const conflicts =
      await __friendshipReplicationPilotTestUtils.validateFriendshipChanges(
        [{ newDocumentState: localFriendship() }],
        'user_A'
      );

    expect(conflicts).toEqual([]);
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(createRowMock).not.toHaveBeenCalled();
  });

  it('resolves divergent local friendship state back to the server master', async () => {
    getRowMock.mockResolvedValue(
      remoteFriendship({ status: 'blocked' })
    );

    const conflicts =
      await __friendshipReplicationPilotTestUtils.validateFriendshipChanges(
        [
          {
            assumedMasterState: localFriendship(),
            newDocumentState: localFriendship({
              status: 'pending_outgoing',
            }),
          },
        ],
        'user_A'
      );

    expect(conflicts).toEqual([
      expect.objectContaining({
        status: 'blocked',
        userId: 'user_A',
      }),
    ]);
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(createRowMock).not.toHaveBeenCalled();
    expect(clearCachedCalendarMock).toHaveBeenCalledWith(
      'user_A',
      'user_B'
    );
  });

  it('allows local friend-bio cache enrichment without writing the master', async () => {
    getRowMock.mockResolvedValue(remoteFriendship({ friend_bio: '' }));

    const conflicts =
      await __friendshipReplicationPilotTestUtils.validateFriendshipChanges(
        [
          {
            newDocumentState: localFriendship({
              friendBio: 'profile bio',
            }),
          },
        ],
        'user_A'
      );

    expect(conflicts).toEqual([]);
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(createRowMock).not.toHaveBeenCalled();
  });

  it('restores a valid server friendship after an accidental physical local delete', async () => {
    const conflicts =
      await __friendshipReplicationPilotTestUtils.validateFriendshipChanges(
        [
          {
            newDocumentState: localFriendship({
              _deleted: true,
            }),
          },
        ],
        'user_A'
      );

    expect(conflicts).toEqual([
      expect.objectContaining({
        id: 'fr_one',
        userId: 'user_A',
        _deleted: false,
      }),
    ]);
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(createRowMock).not.toHaveBeenCalled();
  });

  it('acknowledges physical cleanup of an invalid legacy friendship id without a server lookup', async () => {
    const legacyId =
      'legacy_friendship_row_that_is_far_too_long_for_appwrite';
    const conflicts =
      await __friendshipReplicationPilotTestUtils.validateFriendshipChanges(
        [
          {
            newDocumentState: localFriendship({
              id: legacyId,
              _deleted: true,
            }),
          },
        ],
        'user_A'
      );

    expect(conflicts).toEqual([]);
    expect(getRowMock).not.toHaveBeenCalled();
    expect(clearCachedCalendarMock).toHaveBeenCalledWith(
      'user_A',
      'user_B'
    );
  });

  it('turns an active local orphan into a soft tombstone when the master is absent', async () => {
    getRowMock.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 404 })
    );

    const conflicts =
      await __friendshipReplicationPilotTestUtils.validateFriendshipChanges(
        [{ newDocumentState: localFriendship() }],
        'user_A'
      );

    expect(conflicts).toEqual([
      expect.objectContaining({
        id: 'fr_one',
        isDeleted: true,
        _deleted: false,
      }),
    ]);
    expect(clearCachedCalendarMock).toHaveBeenCalledWith(
      'user_A',
      'user_B'
    );
  });

  it('acknowledges a local tombstone when the master row is already absent', async () => {
    getRowMock.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 404 })
    );

    const conflicts =
      await __friendshipReplicationPilotTestUtils.validateFriendshipChanges(
        [
          {
            newDocumentState: localFriendship({
              isDeleted: true,
            }),
          },
        ],
        'user_A'
      );

    expect(conflicts).toEqual([]);
  });

  it('uses realtime writes only as an ordered pull catch-up signal', async () => {
    const { collection } = collectionFixture();
    await startFriendshipReplicationPilot(
      'user_A',
      collection,
      { id: 'fr_seed', lwt: 77 }
    );

    const options = replicateRxCollectionMock.mock.calls[0][0];
    const next = firstValueFrom(options.pull.stream$);
    const callback = realtimeSubscribeMock.mock.calls[0][1];

    callback({
      events: [
        'databases.life_tracker.tables.friendships.rows.fr_one.update',
      ],
      channels: [],
      timestamp: '',
      payload: remoteFriendship({
        $updatedAt: '2026-10-02T00:00:05.000Z',
      }),
    });

    await expect(next).resolves.toBe('RESYNC');
  });

  it('soft-deletes the local cache on a hard-delete realtime event', async () => {
    const { collection, doc } = collectionFixture(localFriendship());
    await startFriendshipReplicationPilot(
      'user_A',
      collection,
      { id: 'fr_seed', lwt: 77 }
    );

    const options = replicateRxCollectionMock.mock.calls[0][0];
    const next = firstValueFrom(options.pull.stream$);
    const callback = realtimeSubscribeMock.mock.calls[0][1];

    callback({
      events: [
        'databases.life_tracker.tables.friendships.rows.fr_one.delete',
      ],
      channels: [],
      timestamp: '',
      payload: { $id: 'fr_one', user_id: 'user_A' },
    });

    await expect(next).resolves.toBe('RESYNC');
    await vi.waitFor(() =>
      expect(doc?.incrementalModify).toHaveBeenCalledTimes(1)
    );
    expect(doc?.isDeleted).toBe(true);
    expect(clearCachedCalendarMock).toHaveBeenCalledWith(
      'user_A',
      'user_B'
    );
  });

  it('rejects a master row that belongs to another account', async () => {
    getRowMock.mockResolvedValue(
      remoteFriendship({ user_id: 'mallory' })
    );

    await expect(
      __friendshipReplicationPilotTestUtils.validateFriendshipChanges(
        [{ newDocumentState: localFriendship() }],
        'user_A'
      )
    ).rejects.toThrow('remote owner mismatch');
  });

  it('ignores cached friendship rows scoped to another local account', async () => {
    await expect(
      __friendshipReplicationPilotTestUtils.validateFriendshipChanges(
        [
          {
            newDocumentState: localFriendship({
              userId: 'mallory',
            }),
          },
        ],
        'user_A'
      )
    ).resolves.toEqual([]);

    expect(getRowMock).not.toHaveBeenCalled();
  });
});
