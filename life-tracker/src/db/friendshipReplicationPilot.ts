import { createReplicationPilotLifecycleQueue } from './replicationPilotLifecycle';
import { Query } from 'appwrite';
import {
  getChangedDocumentsSince,
  type RxCollection,
  type RxReplicationPullStreamItem,
  type RxReplicationWriteToMasterRow,
  type WithDeletedAndAttachments,
} from 'rxdb';
import {
  replicateRxCollection,
  type RxReplicationState,
} from 'rxdb/plugins/replication';
import { Subject, type Subscription } from 'rxjs';
import type { FriendshipDocument } from './schema';
import {
  guardedRealtime,
  guardedTablesDB,
  type RealtimeUnsubscribe,
} from '../lib/sdk';
import { fromAppwriteFormat } from '../lib/syncMapping';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLES,
} from '../lib/appwriteConfig';
import { clearCachedCalendar } from '../lib/friendCache';
import { awaitPilotReplicationFreshness } from './replicationFreshness';
import { getReplicationIdentifier } from './replicationIds';
import { trackReplicationFreshness } from './replicationLocalState';
import {
  assertRemoteRowOwnedBy,
  assertRemoteRowsOwnedBy,
} from './replicationOwnership';

const PULL_BATCH_SIZE = 100;
const PUSH_BATCH_SIZE = 20;
const LOCAL_CHECKPOINT_BATCH_SIZE = 200;
const RETRY_TIME_MS = 5_000;

export interface FriendshipReplicationCheckpoint {
  updatedAt: string;
  id: string;
}

export type FriendshipReplicationPushCheckpoint = {
  id: string;
  lwt: number;
};

type ReplicatedFriendship =
  WithDeletedAndAttachments<FriendshipDocument>;

let activeOwnerId: string | null = null;
let activeReplication:
  | RxReplicationState<
      FriendshipDocument,
      FriendshipReplicationCheckpoint
    >
  | null = null;
let activePullStream:
  | Subject<
      RxReplicationPullStreamItem<
        FriendshipDocument,
        FriendshipReplicationCheckpoint
      >
    >
  | null = null;
let realtimeUnsubscribe: RealtimeUnsubscribe | null = null;
let errorSubscription: Subscription | null = null;
let activeCollection: RxCollection<FriendshipDocument> | null = null;

function isNotFoundError(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 404;
}

function toReplicatedFriendship(
  row: Record<string, unknown>
): ReplicatedFriendship {
  return {
    ...(fromAppwriteFormat(
      row,
      'friendships'
    ) as unknown as FriendshipDocument),
    _deleted: false,
  };
}

function friendshipStateEquals(
  left: ReplicatedFriendship,
  right: ReplicatedFriendship
): boolean {
  return (
    left.id === right.id &&
    left.userId === right.userId &&
    left.friendId === right.friendId &&
    left.friendUsername === right.friendUsername &&
    left.friendDisplayName === right.friendDisplayName &&
    (left.friendAvatarFileId ?? '') ===
      (right.friendAvatarFileId ?? '') &&
    (left.friendBio ?? '') === (right.friendBio ?? '') &&
    left.status === right.status &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.isDeleted === right.isDeleted &&
    left._deleted === right._deleted
  );
}

function friendshipStateEqualsIgnoringBio(
  left: ReplicatedFriendship,
  right: ReplicatedFriendship
): boolean {
  return friendshipStateEquals(
    { ...left, friendBio: '' },
    { ...right, friendBio: '' }
  );
}

function isLocalBioEnrichment(
  local: ReplicatedFriendship,
  remote: ReplicatedFriendship
): boolean {
  return (
    !remote.friendBio &&
    !!local.friendBio &&
    friendshipStateEqualsIgnoringBio(local, remote)
  );
}

async function clearInactiveFriendCache(
  userId: string,
  document: ReplicatedFriendship
): Promise<void> {
  if (!document.isDeleted && document.status !== 'blocked') return;
  await clearCachedCalendar(userId, document.friendId);
}

async function readRemoteFriendship(
  rowId: string,
  userId: string
): Promise<ReplicatedFriendship | null> {
  try {
    const row = await guardedTablesDB.getRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLES.friendships,
      rowId,
    });
    const raw = row as unknown as Record<string, unknown>;
    assertRemoteRowOwnedBy(raw, userId, 'Friendship');
    return toReplicatedFriendship(raw);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

function missingRemoteTombstone(
  document: ReplicatedFriendship
): ReplicatedFriendship {
  return {
    ...document,
    isDeleted: true,
    _deleted: false,
  };
}

/**
 * Friendships are server-owned. Local writes are either confirmed Function
 * responses, realtime/cache applies, or local cache enrichment. The RxDB
 * upstream is therefore a validator, never a remote writer:
 * - equal server state is acknowledged;
 * - a local-only bio enrichment is acknowledged as cache-only metadata;
 * - divergent state resolves to the current server master;
 * - a missing master resolves to a soft tombstone.
 */
async function validateFriendshipChanges(
  rows: RxReplicationWriteToMasterRow<FriendshipDocument>[],
  userId: string
): Promise<ReplicatedFriendship[]> {
  const conflicts: ReplicatedFriendship[] = [];

  for (const row of rows) {
    const next = row.newDocumentState;
    if (next.userId !== userId) {
      // Mosaic intentionally keeps multiple owners in one local RxDB. A
      // per-user replication identifier will encounter those cached foreign
      // rows on first upstream scan; acknowledge them as outside this
      // replication scope instead of poisoning the active owner's queue.
      continue;
    }

    // FriendsProvider removes pre-migration invalid local rows physically.
    // They cannot be valid current Appwrite row IDs and are intentionally
    // local-only cleanup, so acknowledge them without touching the server.
    if (
      next._deleted &&
      next.id.length > 36 &&
      next.id.includes('_')
    ) {
      await clearCachedCalendar(userId, next.friendId);
      continue;
    }

    const current = await readRemoteFriendship(next.id, userId);
    if (current && current.userId !== userId) {
      throw new Error(
        `Friendship replication master owner mismatch for ${next.id}`
      );
    }

    // Friendships are server-owned. A physical local deletion of a valid
    // row must never delete the master: restore it as a conflict when the
    // master still exists, otherwise acknowledge the already-absent row.
    if (next._deleted) {
      if (current) {
        conflicts.push(current);
      } else {
        await clearCachedCalendar(userId, next.friendId);
      }
      continue;
    }

    if (!current) {
      if (next.isDeleted) {
        await clearCachedCalendar(userId, next.friendId);
        continue;
      }
      const tombstone = missingRemoteTombstone(next);
      await clearCachedCalendar(userId, next.friendId);
      conflicts.push(tombstone);
      continue;
    }

    await clearInactiveFriendCache(userId, current);

    if (
      friendshipStateEquals(current, next) ||
      isLocalBioEnrichment(next, current)
    ) {
      continue;
    }

    conflicts.push(current);
  }

  return conflicts;
}

async function pullFriendships(
  userId: string,
  checkpoint: FriendshipReplicationCheckpoint | undefined,
  batchSize: number
): Promise<{
  documents: ReplicatedFriendship[];
  checkpoint: FriendshipReplicationCheckpoint | undefined;
}> {
  const queries: string[] = [Query.equal('user_id', userId)];

  if (checkpoint) {
    queries.push(
      Query.or([
        Query.greaterThan('$updatedAt', checkpoint.updatedAt),
        Query.and([
          Query.equal('$updatedAt', checkpoint.updatedAt),
          Query.greaterThan('$id', checkpoint.id),
        ]),
      ])
    );
  }

  queries.push(
    Query.orderAsc('$updatedAt'),
    Query.orderAsc('$id'),
    Query.limit(batchSize)
  );

  const response = await guardedTablesDB.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLES.friendships,
    queries,
    total: false,
  });

  const responseRows =
    (response as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
  assertRemoteRowsOwnedBy(responseRows, userId, 'Friendship');
  const rows = responseRows.filter(
    (row) =>
      typeof row.$id === 'string' &&
      row.$id.length > 0 &&
      typeof row.$updatedAt === 'string' &&
      row.$updatedAt.length > 0
  );

  const documents = rows.map(toReplicatedFriendship);
  for (const document of documents) {
    await clearInactiveFriendCache(userId, document);
  }

  const last = rows.at(-1);
  return {
    documents,
    checkpoint: last
      ? {
          id: last.$id as string,
          updatedAt: last.$updatedAt as string,
        }
      : checkpoint,
  };
}

export async function captureFriendshipReplicationPushCheckpoint(
  collection: RxCollection<FriendshipDocument>
): Promise<FriendshipReplicationPushCheckpoint | undefined> {
  let checkpoint: FriendshipReplicationPushCheckpoint | undefined;

  for (;;) {
    const result = await getChangedDocumentsSince<
      FriendshipDocument,
      FriendshipReplicationPushCheckpoint
    >(
      collection.storageInstance,
      LOCAL_CHECKPOINT_BATCH_SIZE,
      checkpoint
    );
    checkpoint = result.checkpoint;
    if (result.documents.length < LOCAL_CHECKPOINT_BATCH_SIZE) {
      return checkpoint;
    }
  }
}

async function applyRealtimeDelete(
  userId: string,
  rowId: string
): Promise<void> {
  const collection = activeCollection;
  if (!collection || activeOwnerId !== userId) return;

  const current = await collection.findOne(rowId).exec();
  if (
    !current ||
    activeOwnerId !== userId ||
    current.userId !== userId
  ) {
    return;
  }

  const friendId = current.friendId;
  await current.incrementalModify((document) => {
    if (
      activeOwnerId !== userId ||
      document.userId !== userId ||
      document.isDeleted
    ) {
      return document;
    }
    return { ...document, isDeleted: true };
  });
  await clearCachedCalendar(userId, friendId);
}

function subscribeToFriendshipRealtime(
  userId: string,
  pullStream: Subject<
    RxReplicationPullStreamItem<
      FriendshipDocument,
      FriendshipReplicationCheckpoint
    >
  >
): RealtimeUnsubscribe {
  const channel =
    `databases.${APPWRITE_DATABASE_ID}.tables.${APPWRITE_TABLES.friendships}.rows`;

  return guardedRealtime.subscribe(channel, (message) => {
    if (activeOwnerId !== userId) return;

    const payload = message.payload;
    const events = Array.isArray(message.events) ? message.events : [];
    const isDelete = events.some((event) => event.endsWith('.delete'));

    if (isDelete) {
      const rowId =
        payload && typeof payload.$id === 'string'
          ? payload.$id
          : '';
      if (rowId) {
        void applyRealtimeDelete(userId, rowId).catch((error) => {
          console.error(
            '[FriendshipReplicationPilot] realtime delete apply failed:',
            error
          );
        });
      }
      pullStream.next('RESYNC');
      return;
    }

    if (!payload || payload.user_id !== userId) return;
    if (
      events.some(
        (event) => event.endsWith('.create') || event.endsWith('.update')
      )
    ) {
      pullStream.next('RESYNC');
    }
  });
}

export function isFriendshipReplicationPilotActive(
  userId: string
): boolean {
  return activeOwnerId === userId && activeReplication !== null;
}

export function resyncFriendshipReplicationPilot(
  userId: string
): boolean {
  if (!isFriendshipReplicationPilotActive(userId)) return false;
  activeReplication?.reSync();
  return true;
}

export async function refreshFriendshipReplicationPilot(
  userId: string,
  timeoutMs: number
): Promise<boolean> {
  if (
    !isFriendshipReplicationPilotActive(userId) ||
    !activeReplication ||
    !activeCollection
  ) {
    return false;
  }

  await awaitPilotReplicationFreshness(
    'friendship',
    activeReplication,
    activeCollection,
    timeoutMs
  );
  return true;
}

async function stopFriendshipReplicationPilotNow(
  userId?: string
): Promise<void> {
  if (userId && activeOwnerId !== userId) return;

  const replication = activeReplication;
  activeOwnerId = null;
  activeReplication = null;
  activeCollection = null;

  realtimeUnsubscribe?.();
  realtimeUnsubscribe = null;
  errorSubscription?.unsubscribe();
  errorSubscription = null;
  activePullStream?.complete();
  activePullStream = null;

  if (replication) {
    await replication.cancel();
  }
}

async function startFriendshipReplicationPilotNow(
  userId: string,
  collection: RxCollection<FriendshipDocument>,
  initialPushCheckpoint:
    | FriendshipReplicationPushCheckpoint
    | undefined
): Promise<void> {
  if (!userId) return;
  if (isFriendshipReplicationPilotActive(userId)) return;

  if (activeReplication) {
    await stopFriendshipReplicationPilotNow();
  }

  const pullStream = new Subject<
    RxReplicationPullStreamItem<
      FriendshipDocument,
      FriendshipReplicationCheckpoint
    >
  >();

  const replication = replicateRxCollection<
    FriendshipDocument,
    FriendshipReplicationCheckpoint
  >({
    replicationIdentifier:
      getReplicationIdentifier('friendships', userId),
    collection,
    live: true,
    retryTime: RETRY_TIME_MS,
    waitForLeadership: true,
    toggleOnDocumentVisible: true,
    pull: {
      batchSize: PULL_BATCH_SIZE,
      stream$: pullStream.asObservable(),
      handler: (checkpoint, batchSize) =>
        pullFriendships(userId, checkpoint, batchSize),
    },
    push: {
      batchSize: PUSH_BATCH_SIZE,
      initialCheckpoint: initialPushCheckpoint,
      handler: (rows) => validateFriendshipChanges(rows, userId),
    },
  });

  activeOwnerId = userId;
  activeReplication = replication;
  trackReplicationFreshness(replication, userId, 'friendships');
  activeCollection = collection;
  activePullStream = pullStream;
  realtimeUnsubscribe = subscribeToFriendshipRealtime(
    userId,
    pullStream
  );
  errorSubscription = replication.error$.subscribe((error) => {
    console.error(
      '[FriendshipReplicationPilot] replication error:',
      error
    );
  });
}

const runReplicationPilotLifecycle = createReplicationPilotLifecycleQueue();

export function stopFriendshipReplicationPilot(
  ...args: Parameters<typeof stopFriendshipReplicationPilotNow>
): ReturnType<typeof stopFriendshipReplicationPilotNow> {
  return runReplicationPilotLifecycle(() => stopFriendshipReplicationPilotNow(...args));
}

export function startFriendshipReplicationPilot(
  ...args: Parameters<typeof startFriendshipReplicationPilotNow>
): ReturnType<typeof startFriendshipReplicationPilotNow> {
  return runReplicationPilotLifecycle(() => startFriendshipReplicationPilotNow(...args));
}

export const __friendshipReplicationPilotTestUtils = {
  pullFriendships,
  validateFriendshipChanges,
};
