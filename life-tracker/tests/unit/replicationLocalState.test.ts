import { BehaviorSubject } from 'rxjs';
import { checkSchema } from 'rxdb/plugins/dev-mode';
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
  trackReplicationFreshness,
} from '../../src/db/replicationLocalState';
import {
  getReplicationIdentifier,
  SYNCED_COLLECTION_NAMES,
} from '../../src/db/replicationIds';
import { syncMetaSchema } from '../../src/db/schema';
import { syncMetaMigrationStrategies } from '../../src/db/migrations';

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
  it('keeps the local metadata schema valid under RxDB Dev Mode', () => {
    expect(() => checkSchema(syncMetaSchema)).not.toThrow();
  });

  it('migrates the Preview v0 reserved field to collectionName', () => {
    expect(
      syncMetaMigrationStrategies[1]({
        id: 'replication:tasks:user_A',
        userId: 'user_A',
        collection: 'tasks',
        replicationIdentifier: 'mosaic-appwrite-tablesdb-tasks-v1:user_A',
        lastFreshAt: '2026-10-03T14:00:00.000Z',
      })
    ).toEqual({
      id: 'replication:tasks:user_A',
      userId: 'user_A',
      collectionName: 'tasks',
      replicationIdentifier: 'mosaic-appwrite-tablesdb-tasks-v1:user_A',
      lastFreshAt: '2026-10-03T14:00:00.000Z',
    });
  });

  it('upgrades persisted syncMeta v2 to v3 without losing offline freshness records (DB6 regression)', () => {
    expect(syncMetaSchema.version).toBe(3);
    expect(Object.keys(syncMetaMigrationStrategies).map(Number).sort()).toEqual([1, 2, 3]);
    const names = syncMetaSchema.properties.collectionName;
    expect(names).toHaveProperty('enum');
    expect((names as { enum: string[] }).enum).toContain('bucketTaskLinks');

    // These are the shape of records persisted by v0.18.0 before v0.19.0
    // expanded the enum without incrementing the RxDB schema version.
    const oldRows = ['tasks', 'bucketList', 'messages'].map(collectionName => ({
      id: `replication:${collectionName}:user_A`,
      userId: 'user_A',
      collectionName,
      replicationIdentifier: `mosaic-appwrite-tablesdb-${collectionName}-v1:user_A`,
      lastFreshAt: '2026-10-11T12:34:56.000Z',
    }));
    for (const oldRow of oldRows) {
      const migrated = syncMetaMigrationStrategies[3](oldRow);
      expect(migrated).toEqual(oldRow);
      expect(migrated).toBe(oldRow);
    }
    expect(syncMetaMigrationStrategies[2](oldRows[0])).toEqual(oldRows[0]);
  });

  it('keeps the full v0-to-v3 migration path for existing devices', () => {
    const legacy = {
      id: 'replication:tasks:user_B',
      userId: 'user_B',
      collection: 'tasks',
      replicationIdentifier: 'mosaic-appwrite-tablesdb-tasks-v1:user_B',
      lastFreshAt: '2026-10-10T06:00:00.000Z',
    };
    const current = syncMetaMigrationStrategies[3](
      syncMetaMigrationStrategies[2](syncMetaMigrationStrategies[1](legacy))
    );
    expect(current).toMatchObject({
      id: legacy.id,
      userId: legacy.userId,
      collectionName: 'tasks',
      replicationIdentifier: legacy.replicationIdentifier,
      lastFreshAt: legacy.lastFreshAt,
    });
    expect(current).not.toHaveProperty('collection');
  });

  beforeEach(() => {
    markOfflineDataReadyMock.mockReset();
    const syncMeta = makeSyncMetaCollection();
    dbRef.current = {
      syncMeta: syncMeta.collection,
    };
  });

  it('waits for RxDB initial replication to settle before recording freshness', async () => {
    let resolveInitial!: () => void;
    const initial = new Promise<void>((resolve) => {
      resolveInitial = resolve;
    });
    const active$ = new BehaviorSubject(false);
    const canceled$ = new BehaviorSubject(false);
    const upsert = dbRef.current.syncMeta.upsert as ReturnType<typeof vi.fn>;

    trackReplicationFreshness(
      {
        awaitInitialReplication: () => initial,
        awaitInSync: () => Promise.resolve(true as const),
        active$,
        canceled$,
      },
      'user_A',
      'tasks'
    );

    await Promise.resolve();
    expect(upsert).not.toHaveBeenCalled();

    resolveInitial();
    await vi.waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));

    active$.next(true);
    active$.next(false);
    await vi.waitFor(() => expect(upsert).toHaveBeenCalledTimes(2));

    canceled$.next(true);
    active$.next(true);
    active$.next(false);
    await Promise.resolve();
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('does not record a retrying active-to-idle cycle as fresh until RxDB is actually in sync', async () => {
    let resolveInSync!: (value: true) => void;
    const inSync = new Promise<true>((resolve) => {
      resolveInSync = resolve;
    });
    const active$ = new BehaviorSubject(false);
    const canceled$ = new BehaviorSubject(false);
    const upsert = dbRef.current.syncMeta.upsert as ReturnType<typeof vi.fn>;

    trackReplicationFreshness(
      {
        awaitInitialReplication: () => Promise.resolve(),
        awaitInSync: () => inSync,
        active$,
        canceled$,
      },
      'user_A',
      'tasks'
    );

    await vi.waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));

    active$.next(true);
    active$.next(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(upsert).toHaveBeenCalledTimes(1);

    resolveInSync(true);
    await vi.waitFor(() => expect(upsert).toHaveBeenCalledTimes(2));
  });

  it('does not record freshness when replication is canceled before initial sync', async () => {
    const active$ = new BehaviorSubject(false);
    const canceled$ = new BehaviorSubject(false);
    const upsert = dbRef.current.syncMeta.upsert as ReturnType<typeof vi.fn>;

    trackReplicationFreshness(
      {
        awaitInitialReplication: () => new Promise<void>(() => {}),
        awaitInSync: () => new Promise<true>(() => {}),
        active$,
        canceled$,
      },
      'user_A',
      'tasks'
    );

    canceled$.next(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(upsert).not.toHaveBeenCalled();
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
      collectionName: 'tasks',
      replicationIdentifier:
        'mosaic-appwrite-tablesdb-tasks-v0:user_A',
      lastFreshAt: at,
    });
    markOfflineDataReadyMock.mockClear();

    await markReplicationFresh('user_A', 'categories', at);

    expect(markOfflineDataReadyMock).not.toHaveBeenCalled();
  });
});
