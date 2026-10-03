import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbRef = vi.hoisted(() => ({
  current: null as unknown as {
    syncMeta: {
      upsert: (doc: Record<string, unknown>) => Promise<void>;
      findOne: (id: string) => {
        exec: () => Promise<Record<string, unknown> | null>;
      };
    };
  },
}));
const markOfflineDataReadyMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/db/database', () => ({
  getDatabase: () => dbRef.current,
}));

vi.mock('../../src/lib/offlineReadiness', () => ({
  markOfflineDataReady: markOfflineDataReadyMock,
}));

import {
  getReplicationFreshness,
  markReplicationFresh,
} from '../../src/db/replicationLocalState';
import {
  getReplicationIdentifier,
  SYNCED_COLLECTION_NAMES,
} from '../../src/db/replicationIds';

function makeSyncMetaCollection() {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    rows,
    collection: {
      upsert: vi.fn(async (doc: Record<string, unknown>) => {
        rows.set(doc.id as string, { ...doc });
      }),
      findOne: vi.fn((id: string) => ({
        exec: async () => rows.get(id) ?? null,
      })),
    },
  };
}

describe('replication local freshness state', () => {
  beforeEach(() => {
    markOfflineDataReadyMock.mockReset();
    const syncMeta = makeSyncMetaCollection();
    dbRef.current = {
      syncMeta: syncMeta.collection,
    };
  });

  it('stores freshness under the current account-scoped replication identifier', async () => {
    const at = '2026-10-03T14:00:00.000Z';

    await markReplicationFresh('user_A', 'tasks', at);

    await expect(
      getReplicationFreshness('user_A', 'tasks')
    ).resolves.toEqual({
      lastFreshAt: at,
      replicationIdentifier: getReplicationIdentifier(
        'tasks',
        'user_A'
      ),
    });
    await expect(
      getReplicationFreshness('user_B', 'tasks')
    ).resolves.toBeNull();
  });

  it('does not mark the account offline-ready until all six replications have caught up', async () => {
    const at = '2026-10-03T14:00:00.000Z';

    for (const collection of SYNCED_COLLECTION_NAMES.slice(0, -1)) {
      await markReplicationFresh('user_A', collection, at);
    }
    expect(markOfflineDataReadyMock).not.toHaveBeenCalled();

    await markReplicationFresh(
      'user_A',
      SYNCED_COLLECTION_NAMES.at(-1)!,
      at
    );

    expect(markOfflineDataReadyMock).toHaveBeenCalledTimes(1);
    expect(markOfflineDataReadyMock).toHaveBeenCalledWith('user_A', at);
  });

  it('requires every stored collection marker to match the current replication version', async () => {
    const at = '2026-10-03T14:00:00.000Z';

    for (const collection of SYNCED_COLLECTION_NAMES) {
      await markReplicationFresh('user_A', collection, at);
    }
    expect(markOfflineDataReadyMock).toHaveBeenCalledTimes(1);

    const staleId = 'replication:tasks:user_A';
    await dbRef.current.syncMeta.upsert({
      id: staleId,
      userId: 'user_A',
      collection: 'tasks',
      replicationIdentifier:
        'mosaic-appwrite-tablesdb-tasks-v0:user_A',
      lastFreshAt: at,
    });
    markOfflineDataReadyMock.mockClear();

    await markReplicationFresh('user_A', 'categories', at);

    expect(markOfflineDataReadyMock).not.toHaveBeenCalled();
  });
});
