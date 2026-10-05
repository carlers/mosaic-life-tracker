import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';

const {
  getChangedDocumentsSinceMock,
  listRowsMock,
  realtimeSubscribeMock,
} = vi.hoisted(() => ({
  getChangedDocumentsSinceMock: vi.fn(),
  listRowsMock: vi.fn(),
  realtimeSubscribeMock: vi.fn(),
}));

vi.mock('rxdb', () => ({
  getChangedDocumentsSince: getChangedDocumentsSinceMock,
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
}));

let realtimeCallback:
  | ((message: {
      events?: string[];
      payload?: Record<string, unknown>;
    }) => void)
  | null = null;

vi.mock('../../src/lib/sdk', () => ({
  guardedTablesDB: {
    listRows: listRowsMock,
  },
  guardedRealtime: {
    subscribe: realtimeSubscribeMock,
  },
}));

import {
  captureReplicationPushCheckpoint,
  pullOwnerRowsByUpdatedAtId,
  subscribeToOwnerRealtime,
} from '../../src/db/replicationPilotPrimitives';

beforeEach(() => {
  getChangedDocumentsSinceMock.mockReset();
  listRowsMock.mockReset();
  realtimeSubscribeMock.mockReset();
  realtimeCallback = null;
  realtimeSubscribeMock.mockImplementation(
    (
      _channel: string,
      callback: (message: {
        events?: string[];
        payload?: Record<string, unknown>;
      }) => void
    ) => {
      realtimeCallback = callback;
      return vi.fn();
    }
  );
});

describe('replicationPilotPrimitives', () => {
  it('scans local changes until the checkpoint page is exhausted', async () => {
    const storageInstance = {};
    const firstCheckpoint = { id: 'row_a', lwt: 1 };
    const finalCheckpoint = { id: 'row_b', lwt: 2 };
    getChangedDocumentsSinceMock
      .mockResolvedValueOnce({
        documents: [{ id: 'a' }, { id: 'b' }],
        checkpoint: firstCheckpoint,
      })
      .mockResolvedValueOnce({
        documents: [{ id: 'c' }],
        checkpoint: finalCheckpoint,
      });

    await expect(
      captureReplicationPushCheckpoint<
        { id: string },
        { id: string; lwt: number }
      >({ storageInstance } as never, 2)
    ).resolves.toEqual(finalCheckpoint);

    expect(getChangedDocumentsSinceMock).toHaveBeenNthCalledWith(
      1,
      storageInstance,
      2,
      undefined
    );
    expect(getChangedDocumentsSinceMock).toHaveBeenNthCalledWith(
      2,
      storageInstance,
      2,
      firstCheckpoint
    );
  });

  it('builds the owner-scoped tuple query and checkpoints only valid rows', async () => {
    listRowsMock.mockResolvedValue({
      rows: [
        {
          $id: 'row_b',
          $updatedAt: '2026-10-05T00:00:02.000Z',
          user_id: 'user_A',
          value: 'valid',
        },
        {
          $id: 'row_missing_timestamp',
          user_id: 'user_A',
          value: 'malformed',
        },
      ],
    });
    const mapRow = vi.fn((row: Record<string, unknown>) => ({
      id: row.$id as string,
    }));

    const result = await pullOwnerRowsByUpdatedAtId<
      { id: string },
      { updatedAt: string; id: string }
    >({
      databaseId: 'life_tracker',
      tableId: 'tasks',
      userId: 'user_A',
      ownerLabel: 'Task',
      checkpoint: {
        id: 'row_a',
        updatedAt: '2026-10-05T00:00:01.000Z',
      },
      batchSize: 100,
      mapRow,
    });

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
        expect.objectContaining({ op: 'orderAsc', field: '$id' }),
        expect.objectContaining({ op: 'limit', value: 100 }),
      ])
    );
    expect(result).toEqual({
      documents: [{ id: 'row_b' }],
      checkpoint: {
        id: 'row_b',
        updatedAt: '2026-10-05T00:00:02.000Z',
      },
    });
    expect(mapRow).toHaveBeenCalledTimes(1);
  });

  it('fails closed when an owner-scoped pull returns another account', async () => {
    listRowsMock.mockResolvedValue({
      rows: [
        {
          $id: 'row_foreign',
          $updatedAt: '2026-10-05T00:00:02.000Z',
          user_id: 'mallory',
        },
      ],
    });

    await expect(
      pullOwnerRowsByUpdatedAtId({
        databaseId: 'life_tracker',
        tableId: 'tasks',
        userId: 'user_A',
        ownerLabel: 'Task',
        checkpoint: undefined,
        batchSize: 100,
        mapRow: (row) => row,
      })
    ).rejects.toThrow('remote owner mismatch');
  });

  it('uses realtime as an active-owner RESYNC wakeup only', () => {
    const pullStream = new Subject<
      'RESYNC' | { documents: never[]; checkpoint: undefined }
    >();
    const values: unknown[] = [];
    pullStream.subscribe((value) => values.push(value));
    let active = true;

    const unsubscribe = subscribeToOwnerRealtime({
      channel: 'databases.life_tracker.tables.tasks.rows',
      userId: 'user_A',
      isActiveOwner: () => active,
      pullStream: pullStream as never,
    });

    expect(realtimeSubscribeMock).toHaveBeenCalledWith(
      'databases.life_tracker.tables.tasks.rows',
      expect.any(Function)
    );

    realtimeCallback?.({
      events: ['databases.life_tracker.tables.tasks.rows.row.update'],
      payload: { user_id: 'mallory' },
    });
    expect(values).toEqual([]);

    realtimeCallback?.({
      events: ['databases.life_tracker.tables.tasks.rows.row.update'],
      payload: { user_id: 'user_A' },
    });
    expect(values).toEqual(['RESYNC']);

    realtimeCallback?.({
      events: ['databases.life_tracker.tables.tasks.rows.row.delete'],
    });
    expect(values).toEqual(['RESYNC', 'RESYNC']);

    active = false;
    realtimeCallback?.({
      events: ['databases.life_tracker.tables.tasks.rows.row.update'],
      payload: { user_id: 'user_A' },
    });
    expect(values).toEqual(['RESYNC', 'RESYNC']);

    expect(unsubscribe).toEqual(expect.any(Function));
  });
});
