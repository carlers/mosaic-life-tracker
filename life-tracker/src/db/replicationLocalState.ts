import {
  filter,
  firstValueFrom,
  type Observable,
  type Subscription,
} from 'rxjs';
import { getDatabase } from './database';
import {
  getReplicationIdentifier,
  SYNCED_COLLECTION_NAMES,
  type SyncedCollectionName,
} from './replicationIds';
import { markOfflineDataReady } from '../lib/offlineReadiness';

function syncMetaId(
  userId: string,
  collection: SyncedCollectionName
): string {
  return `replication:${collection}:${userId}`;
}

export interface ReplicationFreshnessRecord {
  lastFreshAt: string;
  replicationIdentifier: string;
}

interface TrackableReplication {
  awaitInitialReplication: () => Promise<void>;
  active$: Observable<boolean>;
  canceled$: Observable<boolean>;
}

export async function markReplicationFresh(
  userId: string,
  collection: SyncedCollectionName,
  lastFreshAt = new Date().toISOString()
): Promise<void> {
  const db = getDatabase();
  const replicationIdentifier = getReplicationIdentifier(
    collection,
    userId
  );
  await db.syncMeta.upsert({
    id: syncMetaId(userId, collection),
    userId,
    collection,
    replicationIdentifier,
    lastFreshAt,
  });

  const records = await Promise.all(
    SYNCED_COLLECTION_NAMES.map(async (name) => {
      const doc = await db.syncMeta
        .findOne(syncMetaId(userId, name))
        .exec();
      if (!doc || doc.userId !== userId) return null;
      if (
        doc.replicationIdentifier !==
        getReplicationIdentifier(name, userId)
      ) {
        return null;
      }
      return doc.lastFreshAt || null;
    })
  );

  if (records.every((value): value is string => !!value)) {
    markOfflineDataReady(userId, lastFreshAt);
  }
}

async function waitForInitialReplicationOrCancel(
  replication: TrackableReplication
): Promise<boolean> {
  return Promise.race([
    replication.awaitInitialReplication().then(() => true),
    firstValueFrom(
      replication.canceled$.pipe(filter((value) => value))
    ).then(() => false),
  ]);
}

/**
 * Persist freshness only after RxDB has actually settled a replication
 * cycle. Pull handlers run before their returned documents/checkpoints are
 * written, so they are too early to prove tombstone-safe local freshness.
 */
export function trackReplicationFreshness(
  replication: TrackableReplication,
  userId: string,
  collection: SyncedCollectionName
): void {
  void (async () => {
    const initialCompleted =
      await waitForInitialReplicationOrCancel(replication);
    if (!initialCompleted) return;

    await markReplicationFresh(userId, collection);

    let sawActive = false;
    let activeSubscription: Subscription | null = null;
    let canceledSubscription: Subscription | null = null;

    activeSubscription = replication.active$.subscribe((active) => {
      if (active) {
        sawActive = true;
        return;
      }
      if (!sawActive) return;
      sawActive = false;
      void markReplicationFresh(userId, collection).catch((error) => {
        console.warn(
          '[ReplicationLocalState] Failed to persist replication freshness:',
          error
        );
      });
    });

    canceledSubscription = replication.canceled$
      .pipe(filter((value) => value))
      .subscribe(() => {
        activeSubscription?.unsubscribe();
        canceledSubscription?.unsubscribe();
      });
  })().catch((error) => {
    console.warn(
      '[ReplicationLocalState] Failed to track replication freshness:',
      error
    );
  });
}

export async function getReplicationFreshness(
  userId: string,
  collection: SyncedCollectionName
): Promise<ReplicationFreshnessRecord | null> {
  const doc = await getDatabase().syncMeta
    .findOne(syncMetaId(userId, collection))
    .exec();
  if (!doc || doc.userId !== userId) return null;
  return {
    lastFreshAt: doc.lastFreshAt,
    replicationIdentifier: doc.replicationIdentifier,
  };
}
