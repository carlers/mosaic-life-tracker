import { clearCachedCalendar } from './friendCache';
import { Query } from 'appwrite';
import { getDatabase } from '../db/database';
import { guardedTablesDB } from './sdk';
import { APPWRITE_DATABASE_ID, APPWRITE_TABLES } from './appwriteConfig';
import { fromAppwriteFormat } from './syncMapping';
import type { FriendshipDocument } from '../db/schema';
import { assertRemoteRowsOwnedBy } from '../db/replicationOwnership';

const lwt = (doc: unknown): number => (doc as { _meta?: { lwt?: number } })._meta?.lwt ?? 0;

// Relationships are a server-owned cache, not an editable sync collection.
// A full, bounded pull also removes legacy optimistic orphans and GC'd rows.
export async function syncFriendships(userId: string): Promise<void> {
  const collection = getDatabase().friendships;
  const started = Date.now();
  const key = `mosaic_friendship_cache_v1:${userId}`;
  const upgrading = localStorage.getItem(key) !== 'ready';
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const result = await guardedTablesDB.listRows({ databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLES.friendships, queries: [Query.equal('user_id', userId),
        Query.orderAsc('$id'), Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])], total: false });
    assertRemoteRowsOwnedBy(
      result.rows as unknown as Record<string, unknown>[],
      userId,
      'Friendship stale recovery'
    );
    for (const row of result.rows) {
      seen.add(row.$id);
      const incoming = fromAppwriteFormat(row, 'friendships') as unknown as FriendshipDocument;
      const current = await collection.findOne(row.$id).exec();
      // A newer Function response/realtime event may have arrived during the pull.
      if (current && current.updatedAt > incoming.updatedAt && (!upgrading || lwt(current) > started)) continue;
      if (current) await current.incrementalModify(doc => {
        if (doc.updatedAt > incoming.updatedAt && (!upgrading || lwt(doc) > started)) return doc;
        return { ...doc, ...incoming };
      });
      else await collection.upsert(incoming);
      if (incoming.isDeleted || incoming.status === 'blocked') await clearCachedCalendar(userId, incoming.friendId);
    }
    if (result.rows.length < 100) {
      const locals = await collection.find({ selector: { userId } }).exec();
      for (const local of locals) {
        if (seen.has(local.id) || lwt(local) > started || local.isDeleted) continue;
        await local.incrementalModify(doc => lwt(doc) > started ? doc : { ...doc, isDeleted: true });
        await clearCachedCalendar(userId, local.friendId);
      }
      localStorage.setItem(key, 'ready');
      return;
    }
    const next = result.rows.at(-1)?.$id;
    if (!next || next === cursor) throw new Error('Incomplete friendship pull');
    cursor = next;
  }
  throw new Error('Friendship pull exceeded page limit');
}
