import { createReplicationPilotLifecycleQueue } from './replicationPilotLifecycle';
import {
  captureReplicationPushCheckpoint,
  pullOwnerRowsByUpdatedAtId,
  subscribeToOwnerRealtime,
} from './replicationPilotPrimitives';
import { Permission, Role } from 'appwrite';
import {
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
import type { BucketListDocument } from './schema';
import { guardedTablesDB, type RealtimeUnsubscribe } from '../lib/sdk';
import { fromAppwriteFormat, toAppwriteFormat } from '../lib/syncMapping';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLES,
} from '../lib/appwriteConfig';
import { awaitPilotReplicationFreshness } from './replicationFreshness';
import { getReplicationIdentifier } from './replicationIds';
import { trackReplicationFreshness } from './replicationLocalState';
import { readOwnerMaster, updateOwnerRowWithCas } from './ownerWriteCas';

const PULL_BATCH_SIZE = 100;
const PUSH_BATCH_SIZE = 20;
const LOCAL_CHECKPOINT_BATCH_SIZE = 200;
const RETRY_TIME_MS = 5_000;

export interface BucketListReplicationCheckpoint {
  updatedAt: string;
  id: string;
}

export type BucketListReplicationPushCheckpoint = {
  id: string;
  lwt: number;
};

type ReplicatedBucketList = WithDeletedAndAttachments<BucketListDocument>;

let activeOwnerId: string | null = null;
let activeReplication:
  | RxReplicationState<BucketListDocument, BucketListReplicationCheckpoint>
  | null = null;
let activePullStream:
  | Subject<
      RxReplicationPullStreamItem<
        BucketListDocument,
        BucketListReplicationCheckpoint
      >
    >
  | null = null;
let realtimeUnsubscribe: RealtimeUnsubscribe | null = null;
let errorSubscription: Subscription | null = null;
let activeCollection: RxCollection<BucketListDocument> | null = null;

function isConflictError(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 409;
}

function buildRowPermissions(userId: string): string[] {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

function toReplicatedBucketList(
  row: Record<string, unknown>
): ReplicatedBucketList {
  return {
    ...(fromAppwriteFormat(row, 'bucketList') as unknown as BucketListDocument),
    _deleted: false,
  };
}

function bucketListStateEquals(
  left: ReplicatedBucketList,
  right: ReplicatedBucketList
): boolean {
  return (
    left.id === right.id &&
    left.userId === right.userId &&
    left.title === right.title &&
    left.description === right.description &&
    left.achieved === right.achieved &&
    left.achievedAt === right.achievedAt &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.isDeleted === right.isDeleted &&
    left._deleted === right._deleted
  );
}

function isBootstrapLocalNewer(
  localUpdatedAt: string,
  remoteUpdatedAt: string
): boolean {
  const localMs = Date.parse(localUpdatedAt);
  const remoteMs = Date.parse(remoteUpdatedAt);
  return (
    Number.isFinite(localMs) &&
    Number.isFinite(remoteMs) &&
    localMs > remoteMs
  );
}

async function readRemoteBucketListMaster(
  rowId: string,
  userId: string
) {
  return readOwnerMaster(
    APPWRITE_TABLES.bucketList,
    rowId,
    userId,
    toReplicatedBucketList
  );
}

async function readRemoteBucketList(
  rowId: string,
  userId: string
): Promise<ReplicatedBucketList | null> {
  const master = await readRemoteBucketListMaster(rowId, userId);
  return master?.document ?? null;
}

async function createRemoteBucketList(
  document: ReplicatedBucketList,
  userId: string
): Promise<ReplicatedBucketList | null> {
  try {
    await guardedTablesDB.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLES.bucketList,
      rowId: document.id,
      data: toAppwriteFormat(
        document as unknown as Record<string, unknown>,
        'bucketList',
        userId
      ),
      permissions: buildRowPermissions(userId),
    });
    return null;
  } catch (error) {
    if (!isConflictError(error)) throw error;
    const current = await readRemoteBucketList(document.id, userId);
    if (current) return current;
    throw error;
  }
}

async function pushBucketList(
  rows: RxReplicationWriteToMasterRow<BucketListDocument>[],
  userId: string
): Promise<ReplicatedBucketList[]> {
  const conflicts: ReplicatedBucketList[] = [];

  for (const row of rows) {
    const next = row.newDocumentState;
    if (next.userId !== userId) {
      // Mosaic intentionally keeps multiple owners in one local RxDB. A
      // per-user replication identifier will encounter those cached foreign
      // rows on first upstream scan; acknowledge them as outside this
      // replication scope instead of poisoning the active owner's queue.
      continue;
    }
    if (next._deleted) {
      throw new Error(
        `BucketList replication cannot physically delete ${next.id}; use isDeleted tombstones`
      );
    }

    const master = await readRemoteBucketListMaster(next.id, userId);
    const current = master?.document ?? null;
    const assumed = row.assumedMasterState;

    if (!assumed) {
      if (!current) {
        const createConflict = await createRemoteBucketList(next, userId);
        if (createConflict) conflicts.push(createConflict);
        continue;
      }

      // No assumed master means this row predates RxDB's persisted
      // replication metadata (first sync / metadata recovery). A local LWT
      // alone is not evidence of a local edit because downstream replication
      // also writes the local document. Identical state is acknowledged
      // without a remote write; otherwise only a genuinely newer
      // application-level edit is allowed to win this one-time bootstrap.
      if (bucketListStateEquals(current, next)) {
        continue;
      }
      if (!isBootstrapLocalNewer(next.updatedAt, current.updatedAt)) {
        conflicts.push(current);
        continue;
      }
    } else if (current && !bucketListStateEquals(current, assumed)) {
      conflicts.push(current);
      continue;
    }

    if (!current) {
      const createConflict = await createRemoteBucketList(next, userId);
      if (createConflict) conflicts.push(createConflict);
      continue;
    }
    if (!master) {
      throw new Error(
        `BucketList replication master token missing for ${next.id}`
      );
    }

    const writeResult = await updateOwnerRowWithCas(
      'bucket_list_items',
      next.id,
      userId,
      master.serverUpdatedAt,
      toAppwriteFormat(
        next as unknown as Record<string, unknown>,
        'bucketList',
        userId
      )
    );
    if (writeResult.status === 'conflict') {
      conflicts.push(toReplicatedBucketList(writeResult.row));
      continue;
    }
    if (writeResult.status === 'missing') {
      const createConflict = await createRemoteBucketList(next, userId);
      if (createConflict) conflicts.push(createConflict);
    }
  }

  return conflicts;
}

async function pullBucketList(
  userId: string,
  checkpoint: BucketListReplicationCheckpoint | undefined,
  batchSize: number
): Promise<{
  documents: ReplicatedBucketList[];
  checkpoint: BucketListReplicationCheckpoint | undefined;
}> {
  return pullOwnerRowsByUpdatedAtId<ReplicatedBucketList, BucketListReplicationCheckpoint>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLES.bucketList,
    userId,
    ownerLabel: 'BucketList',
    checkpoint,
    batchSize,
    mapRow: toReplicatedBucketList,
  });
}

export function captureBucketListReplicationPushCheckpoint(
  collection: RxCollection<BucketListDocument>
): Promise<BucketListReplicationPushCheckpoint | undefined> {
  return captureReplicationPushCheckpoint<BucketListDocument, BucketListReplicationPushCheckpoint>(
    collection,
    LOCAL_CHECKPOINT_BATCH_SIZE
  );
}

function subscribeToBucketListRealtime(
  userId: string,
  pullStream: Subject<
    RxReplicationPullStreamItem<
      BucketListDocument,
      BucketListReplicationCheckpoint
    >
  >
): RealtimeUnsubscribe {
  return subscribeToOwnerRealtime({
    channel:
      `databases.${APPWRITE_DATABASE_ID}.tables.${APPWRITE_TABLES.bucketList}.rows`,
    userId,
    isActiveOwner: () => activeOwnerId === userId,
    pullStream,
  });
}

export function isBucketListReplicationPilotActive(userId: string): boolean {
  return activeOwnerId === userId && activeReplication !== null;
}

export function resyncBucketListReplicationPilot(userId: string): boolean {
  if (!isBucketListReplicationPilotActive(userId)) return false;
  activeReplication?.reSync();
  return true;
}

export async function refreshBucketListReplicationPilot(
  userId: string,
  timeoutMs: number
): Promise<boolean> {
  if (
    !isBucketListReplicationPilotActive(userId) ||
    !activeReplication ||
    !activeCollection
  ) {
    return false;
  }
  await awaitPilotReplicationFreshness(
    'bucketList',
    activeReplication,
    activeCollection,
    timeoutMs
  );
  return true;
}

async function stopBucketListReplicationPilotNow(
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

async function startBucketListReplicationPilotNow(
  userId: string,
  collection: RxCollection<BucketListDocument>,
  initialPushCheckpoint: BucketListReplicationPushCheckpoint | undefined
): Promise<void> {
  if (!userId) return;
  if (isBucketListReplicationPilotActive(userId)) return;

  if (activeReplication) {
    await stopBucketListReplicationPilotNow();
  }

  const pullStream = new Subject<
    RxReplicationPullStreamItem<
      BucketListDocument,
      BucketListReplicationCheckpoint
    >
  >();

  const replication = replicateRxCollection<
    BucketListDocument,
    BucketListReplicationCheckpoint
  >({
    replicationIdentifier:
      getReplicationIdentifier('bucketList', userId),
    collection,
    live: true,
    retryTime: RETRY_TIME_MS,
    waitForLeadership: true,
    toggleOnDocumentVisible: true,
    pull: {
      batchSize: PULL_BATCH_SIZE,
      stream$: pullStream.asObservable(),
      handler: (checkpoint, batchSize) =>
        pullBucketList(userId, checkpoint, batchSize),
    },
    push: {
      batchSize: PUSH_BATCH_SIZE,
      initialCheckpoint: initialPushCheckpoint,
      handler: (rows) => pushBucketList(rows, userId),
    },
  });

  activeOwnerId = userId;
  activeReplication = replication;
  trackReplicationFreshness(replication, userId, 'bucketList');
  activeCollection = collection;
  activePullStream = pullStream;
  realtimeUnsubscribe = subscribeToBucketListRealtime(userId, pullStream);
  errorSubscription = replication.error$.subscribe((error) => {
    console.error('[BucketListReplicationPilot] replication error:', error);
  });
}

const runReplicationPilotLifecycle = createReplicationPilotLifecycleQueue();

export function stopBucketListReplicationPilot(
  ...args: Parameters<typeof stopBucketListReplicationPilotNow>
): ReturnType<typeof stopBucketListReplicationPilotNow> {
  return runReplicationPilotLifecycle(() => stopBucketListReplicationPilotNow(...args));
}

export function startBucketListReplicationPilot(
  ...args: Parameters<typeof startBucketListReplicationPilotNow>
): ReturnType<typeof startBucketListReplicationPilotNow> {
  return runReplicationPilotLifecycle(() => startBucketListReplicationPilotNow(...args));
}

export const __bucketListReplicationPilotTestUtils = {
  pullBucketList,
  pushBucketList,
};
