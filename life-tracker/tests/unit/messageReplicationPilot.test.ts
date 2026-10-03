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
const realtimeSubscribeMock = vi.hoisted(() => vi.fn());
const reSyncMock = vi.hoisted(() => vi.fn());
const cancelMock = vi.hoisted(() => vi.fn());
const errorSubscribeMock = vi.hoisted(() => vi.fn());
const trackReplicationFreshnessMock = vi.hoisted(() => vi.fn());
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
    orderDesc: (field: string) =>
      JSON.stringify({ op: 'orderDesc', field }),
    limit: (value: number) =>
      JSON.stringify({ op: 'limit', value }),
  },
}));

vi.mock('../../src/lib/sdk', () => ({
  guardedTablesDB: {
    listRows: listRowsMock,
  },
  guardedRealtime: {
    subscribe: realtimeSubscribeMock,
  },
}));

vi.mock('../../src/db/replicationLocalState', () => ({
  trackReplicationFreshness: trackReplicationFreshnessMock,
}));

vi.mock('../../src/db/replicationFreshness', () => ({
  awaitPilotReplicationFreshness: awaitPilotReplicationFreshnessMock,
}));

import {
  __messageReplicationPilotTestUtils,
  captureMessageReplicationPullCheckpoint,
  captureMessageReplicationPushCheckpoint,
  refreshMessageReplicationPilot,
  startMessageReplicationPilot,
  stopMessageReplicationPilot,
} from '../../src/db/messageReplicationPilot';

function localMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg_one',
    userId: 'user_A',
    threadId: 'th_one',
    senderId: 'user_A',
    recipientId: 'user_B',
    direction: 'outgoing',
    content: 'hello',
    taskRefId: '',
    taskRefTitle: '',
    taskRefDate: '',
    taskRefColor: '',
    replyToId: '',
    replyToContent: '',
    replyToSenderId: '',
    isUnsent: false,
    originalMessageId: 'msg_one',
    reactions: '',
    readAt: '',
    deliveryStatus: 'delivered',
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:01.000Z',
    isDeleted: false,
    _deleted: false,
    ...overrides,
  };
}

function remoteMessage(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'msg_one',
    $updatedAt: '2026-10-02T00:00:02.000Z',
    user_id: 'user_A',
    thread_id: 'th_one',
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
    original_message_id: 'msg_one',
    reactions: '',
    read_at: '',
    delivery_status: 'delivered',
    created_at: '2026-10-02T00:00:00.000Z',
    updated_at: '2026-10-02T00:00:01.000Z',
    deleted: false,
    ...overrides,
  };
}

function collectionFixture(
  localDoc?: Record<string, unknown>
): {
  collection: never;
  doc: (Record<string, unknown> & {
    toJSON: () => Record<string, unknown>;
    incrementalModify: ReturnType<typeof vi.fn>;
  }) | null;
} {
  const doc = localDoc
    ? ({
        ...localDoc,
        toJSON: () => ({ ...doc }),
        incrementalModify: vi.fn(async (modifier) => {
          const next = modifier({ ...doc });
          Object.assign(doc, next);
          return doc;
        }),
      } as Record<string, unknown> & {
        toJSON: () => Record<string, unknown>;
        incrementalModify: ReturnType<typeof vi.fn>;
      })
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
  await stopMessageReplicationPilot();
  vi.clearAllMocks();
  trackReplicationFreshnessMock.mockImplementation(() => undefined);

  getChangedDocumentsSinceMock.mockResolvedValue({
    documents: [],
    checkpoint: { id: 'msg_seed', lwt: 123 },
  });
  listRowsMock.mockResolvedValue({ rows: [] });
  realtimeSubscribeMock.mockReturnValue(vi.fn());
  cancelMock.mockResolvedValue(true);
  errorSubscribeMock.mockReturnValue({ unsubscribe: vi.fn() });
  awaitPilotReplicationFreshnessMock.mockResolvedValue(undefined);
  replicateRxCollectionMock.mockReturnValue({
    reSync: reSyncMock,
    cancel: cancelMock,
    error$: { subscribe: errorSubscribeMock },
  });
});

afterEach(async () => {
  await stopMessageReplicationPilot();
});

describe('message RxDB replication pilot', () => {
  it('captures the local push seed before bootstrap', async () => {
    const { collection } = collectionFixture();

    await expect(
      captureMessageReplicationPushCheckpoint(collection)
    ).resolves.toEqual({ id: 'msg_seed', lwt: 123 });

    expect(getChangedDocumentsSinceMock).toHaveBeenCalledWith(
      {},
      200,
      undefined
    );
  });

  it('captures the current remote tail as the initial pull checkpoint', async () => {
    listRowsMock.mockResolvedValue({
      rows: [
        remoteMessage({
          $id: 'msg_tail',
          $updatedAt: '2026-10-02T00:00:09.000Z',
        }),
      ],
    });

    await expect(
      captureMessageReplicationPullCheckpoint('user_A')
    ).resolves.toEqual({
      id: 'msg_tail',
      updatedAt: '2026-10-02T00:00:09.000Z',
    });

    const queries = listRowsMock.mock.calls[0][0].queries.map(
      (query: string) => JSON.parse(query)
    );
    expect(queries).toEqual([
      { op: 'equal', key: 'user_id', value: 'user_A' },
      { op: 'orderDesc', field: '$updatedAt' },
      { op: 'orderDesc', field: '$id' },
      { op: 'limit', value: 1 },
    ]);
  });

  it('starts from both pre-bootstrap checkpoints', async () => {
    const { collection } = collectionFixture();
    const pushCheckpoint = { id: 'msg_seed', lwt: 77 };
    const pullCheckpoint = {
      id: 'msg_tail',
      updatedAt: '2026-10-02T00:00:09.000Z',
    };

    await startMessageReplicationPilot(
      'user_A',
      collection,
      pushCheckpoint,
      pullCheckpoint
    );

    const options = replicateRxCollectionMock.mock.calls[0][0];
    expect(options.push.initialCheckpoint).toEqual(pushCheckpoint);
    expect(options.pull.initialCheckpoint).toEqual(pullCheckpoint);
    expect(options.waitForLeadership).toBe(true);
    expect(options.live).toBe(true);
  });

  it('participates in the shared leader-owned freshness barrier', async () => {
    const { collection } = collectionFixture();
    await startMessageReplicationPilot(
      'user_A',
      collection,
      { id: 'msg_seed', lwt: 77 },
      undefined
    );

    await expect(
      refreshMessageReplicationPilot('user_A', 5_000)
    ).resolves.toBe(true);

    expect(awaitPilotReplicationFreshnessMock).toHaveBeenCalledWith(
      'message',
      replicateRxCollectionMock.mock.results[0].value,
      collection,
      5_000
    );
  });

  it('pulls changes after the tuple checkpoint and filters wrong-owner rows', async () => {
    const { collection } = collectionFixture();
    listRowsMock.mockResolvedValue({
      rows: [
        remoteMessage({
          $id: 'msg_two',
          $updatedAt: '2026-10-02T00:00:03.000Z',
        }),
        remoteMessage({
          $id: 'msg_wrong',
          user_id: 'mallory',
          $updatedAt: '2026-10-02T00:00:04.000Z',
        }),
      ],
    });

    const result = await __messageReplicationPilotTestUtils.pullMessages(
      collection,
      'user_A',
      {
        id: 'msg_one',
        updatedAt: '2026-10-02T00:00:02.000Z',
      },
      100
    );

    const queries = listRowsMock.mock.calls[0][0].queries.map(
      (query: string) => JSON.parse(query)
    );
    expect(queries).toEqual(
      expect.arrayContaining([
        { op: 'equal', key: 'user_id', value: 'user_A' },
        expect.objectContaining({ op: 'or' }),
        { op: 'orderAsc', field: '$updatedAt' },
        { op: 'orderAsc', field: '$id' },
      ])
    );
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]).toEqual(
      expect.objectContaining({
        id: 'msg_two',
        userId: 'user_A',
        _deleted: false,
      })
    );
    expect(result.checkpoint).toEqual({
      id: 'msg_two',
      updatedAt: '2026-10-02T00:00:03.000Z',
    });
  });

  it('acknowledges owner-scoped message intent without writing Appwrite', async () => {
    await expect(
      __messageReplicationPilotTestUtils.acknowledgeMessageChanges(
        [
          {
            newDocumentState: localMessage({
              deliveryStatus: 'pending',
            }),
          },
          {
            newDocumentState: localMessage({
              direction: 'incoming',
              senderId: 'user_B',
              recipientId: 'user_A',
              readAt: '2026-10-02T00:00:08.000Z',
            }),
          },
        ] as never,
        'user_A'
      )
    ).resolves.toEqual([]);
  });

  it('rejects physical deletion and cross-account rows', async () => {
    await expect(
      __messageReplicationPilotTestUtils.acknowledgeMessageChanges(
        [
          {
            newDocumentState: localMessage({ _deleted: true }),
          },
        ] as never,
        'user_A'
      )
    ).rejects.toThrow('cannot physically delete');

    await expect(
      __messageReplicationPilotTestUtils.acknowledgeMessageChanges(
        [
          {
            newDocumentState: localMessage({ userId: 'mallory' }),
          },
        ] as never,
        'user_A'
      )
    ).rejects.toThrow('owner mismatch');
  });

  it('preserves an optimistic incoming read while the server receipt is pending', async () => {
    const local = localMessage({
      direction: 'incoming',
      senderId: 'user_B',
      recipientId: 'user_A',
      readAt: '2026-10-02T00:00:08.000Z',
      updatedAt: '2026-10-02T00:00:08.000Z',
    });
    const { collection } = collectionFixture(local);

    await startMessageReplicationPilot(
      'user_A',
      collection,
      { id: 'msg_seed', lwt: 77 },
      undefined
    );

    const merged =
      await __messageReplicationPilotTestUtils.mergeRemoteWithLocalIntent(
        collection,
        'user_A',
        {
          ...localMessage({
            direction: 'incoming',
            senderId: 'user_B',
            recipientId: 'user_A',
            readAt: '',
            updatedAt: '2026-10-02T00:00:01.000Z',
          }),
        } as never
      );

    expect(merged.readAt).toBe('2026-10-02T00:00:08.000Z');
    expect(merged.updatedAt).toBe('2026-10-02T00:00:08.000Z');
  });

  it('keeps outgoing readAt server-owned while preserving a newer local reaction', async () => {
    const local = localMessage({
      reactions: '[{"emoji":"❤️","userIds":["user_A"]}]',
      readAt: '',
      updatedAt: '2026-10-02T00:00:08.000Z',
    });
    const { collection } = collectionFixture(local);

    await startMessageReplicationPilot(
      'user_A',
      collection,
      { id: 'msg_seed', lwt: 77 },
      undefined
    );

    const merged =
      await __messageReplicationPilotTestUtils.mergeRemoteWithLocalIntent(
        collection,
        'user_A',
        {
          ...localMessage({
            reactions: '',
            readAt: '2026-10-02T00:00:07.000Z',
            updatedAt: '2026-10-02T00:00:01.000Z',
          }),
        } as never
      );

    expect(merged.reactions).toBe(
      '[{"emoji":"❤️","userIds":["user_A"]}]'
    );
    expect(merged.readAt).toBe('2026-10-02T00:00:07.000Z');
  });

  it('lets a newer server reaction replace an older optimistic reaction', async () => {
    const local = localMessage({
      reactions: '[{"emoji":"❤️","userIds":["user_A"]}]',
      updatedAt: '2026-10-02T00:00:03.000Z',
    });
    const { collection } = collectionFixture(local);

    await startMessageReplicationPilot(
      'user_A',
      collection,
      { id: 'msg_seed', lwt: 77 },
      undefined
    );

    const merged =
      await __messageReplicationPilotTestUtils.mergeRemoteWithLocalIntent(
        collection,
        'user_A',
        {
          ...localMessage({
            reactions: '[{"emoji":"👍","userIds":["user_B"]}]',
            updatedAt: '2026-10-02T00:00:09.000Z',
          }),
        } as never
      );

    expect(merged.reactions).toBe(
      '[{"emoji":"👍","userIds":["user_B"]}]'
    );
    expect(merged.updatedAt).toBe('2026-10-02T00:00:09.000Z');
  });

  it('preserves a newer local unsend over an older remote snapshot', async () => {
    const local = localMessage({
      content: '',
      isUnsent: true,
      reactions: '',
      updatedAt: '2026-10-02T00:00:08.000Z',
    });
    const { collection } = collectionFixture(local);

    await startMessageReplicationPilot(
      'user_A',
      collection,
      { id: 'msg_seed', lwt: 77 },
      undefined
    );

    const merged =
      await __messageReplicationPilotTestUtils.mergeRemoteWithLocalIntent(
        collection,
        'user_A',
        {
          ...localMessage({
            content: 'hello',
            isUnsent: false,
            reactions: '[{"emoji":"👍","userIds":["user_B"]}]',
            readAt: '2026-10-02T00:00:07.000Z',
            updatedAt: '2026-10-02T00:00:02.000Z',
          }),
        } as never
      );

    expect(merged).toEqual(
      expect.objectContaining({
        content: '',
        isUnsent: true,
        reactions: '',
        readAt: '2026-10-02T00:00:07.000Z',
        updatedAt: '2026-10-02T00:00:08.000Z',
      })
    );
  });

  it('preserves legacy originalMessageId cache enrichment', async () => {
    const local = localMessage({
      direction: 'incoming',
      senderId: 'user_B',
      recipientId: 'user_A',
      originalMessageId: 'msg_sender',
    });
    const { collection } = collectionFixture(local);

    await startMessageReplicationPilot(
      'user_A',
      collection,
      { id: 'msg_seed', lwt: 77 },
      undefined
    );

    const merged =
      await __messageReplicationPilotTestUtils.mergeRemoteWithLocalIntent(
        collection,
        'user_A',
        {
          ...localMessage({
            direction: 'incoming',
            senderId: 'user_B',
            recipientId: 'user_A',
            originalMessageId: '',
          }),
        } as never
      );

    expect(merged.originalMessageId).toBe('msg_sender');
  });

  it('streams merged realtime updates through RxDB', async () => {
    const local = localMessage({
      reactions: '[{"emoji":"❤️","userIds":["user_A"]}]',
      updatedAt: '2026-10-02T00:00:08.000Z',
    });
    const { collection } = collectionFixture(local);

    await startMessageReplicationPilot(
      'user_A',
      collection,
      { id: 'msg_seed', lwt: 77 },
      undefined
    );

    const options = replicateRxCollectionMock.mock.calls[0][0];
    const next = firstValueFrom(options.pull.stream$);
    const callback = realtimeSubscribeMock.mock.calls[0][1];

    callback({
      events: [
        'databases.life_tracker.tables.messages.rows.msg_one.update',
      ],
      channels: [],
      timestamp: '',
      payload: remoteMessage({
        $updatedAt: '2026-10-02T00:00:07.000Z',
        read_at: '2026-10-02T00:00:07.000Z',
        updated_at: '2026-10-02T00:00:01.000Z',
      }),
    });

    await expect(next).resolves.toEqual({
      checkpoint: {
        id: 'msg_one',
        updatedAt: '2026-10-02T00:00:07.000Z',
      },
      documents: [
        expect.objectContaining({
          reactions: '[{"emoji":"❤️","userIds":["user_A"]}]',
          readAt: '2026-10-02T00:00:07.000Z',
        }),
      ],
    });
  });

  it('soft-deletes the local cache on a hard-delete realtime event', async () => {
    const { collection, doc } = collectionFixture(localMessage());
    await startMessageReplicationPilot(
      'user_A',
      collection,
      { id: 'msg_seed', lwt: 77 },
      undefined
    );

    const options = replicateRxCollectionMock.mock.calls[0][0];
    const next = firstValueFrom(options.pull.stream$);
    const callback = realtimeSubscribeMock.mock.calls[0][1];

    callback({
      events: [
        'databases.life_tracker.tables.messages.rows.msg_one.delete',
      ],
      channels: [],
      timestamp: '',
      payload: { $id: 'msg_one', user_id: 'user_A' },
    });

    await expect(next).resolves.toBe('RESYNC');
    await vi.waitFor(() =>
      expect(doc?.incrementalModify).toHaveBeenCalledTimes(1)
    );
    expect(doc?.isDeleted).toBe(true);
  });
});
