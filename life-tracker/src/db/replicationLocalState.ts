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
