import { createReplicationPilotLifecycleQueue } from './replicationPilotLifecycle';
import {
  captureReplicationPushCheckpoint,
  subscribeToOwnerRealtime,
} from './replicationPilotPrimitives';
import { Permission, Query, Role } from 'appwrite';
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
import type { DiaryDocument } from './schema';
import { guardedTablesDB, type RealtimeUnsubscribe } from '../lib/sdk';
import { fromAppwriteFormat, toAppwriteFormat } from '../lib/syncMapping';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLES,
} from '../lib/appwriteConfig';
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

export interface DiaryReplicationCheckpoint {
  updatedAt: string;
  id: string;
}

export type DiaryReplicationPushCheckpoint = {
  id: string;
  lwt: number;
};

type ReplicatedDiary = WithDeletedAndAttachments<DiaryDocument>;

let activeOwnerId: string | null = null;
let activeReplication:
  | RxReplicationState<DiaryDocument, DiaryReplicationCheckpoint>
  | null = null;
let activePullStream:
  | Subject<
      RxReplicationPullStreamItem<
        DiaryDocument,
        DiaryReplicationCheckpoint
      >
    >
  | null = null;
let realtimeUnsubscribe: RealtimeUnsubscribe | null = null;
let errorSubscription: Subscription | null = null;
let activeCollection: RxCollection<DiaryDocument> | null = null;

function isNotFoundError(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 404;
}

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

function toReplicatedDiary(
  row: Record<string, unknown>
): ReplicatedDiary {
  return {
    ...(fromAppwriteFormat(row, 'diary') as unknown as DiaryDocument),
    _deleted: false,
  };
}

function diaryStateEquals(
  left: ReplicatedDiary,
  right: ReplicatedDiary
): boolean {
  return (
    left.id === right.id &&
    left.userId === right.userId &&
    left.date === right.date &&
    (left.content ?? '') === (right.content ?? '') &&
    left.visibility === right.visibility &&
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

async function readRemoteDiary(
  rowId: string,
  userId: string
): Promise<ReplicatedDiary | null> {
  try {
    const row = await guardedTablesDB.getRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLES.diary,
      rowId,
    });
    const raw = row as unknown as Record<string, unknown>;
    assertRemoteRowOwnedBy(raw, userId, 'Diary');
    return toReplicatedDiary(raw);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

async function createRemoteDiary(
  document: ReplicatedDiary,
  userId: string
): Promise<ReplicatedDiary | null> {
  try {
    await guardedTablesDB.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLES.diary,
      rowId: document.id,
      data: toAppwriteFormat(
        document as unknown as Record<string, unknown>,
        'diary',
        userId
      ),
      permissions: buildRowPermissions(userId),
    });
    return null;
  } catch (error) {
    if (!isConflictError(error)) throw error;
    const current = await readRemoteDiary(document.id, userId);
    if (current) return current;
    throw error;
  }
}

async function pushDiary(
  rows: RxReplicationWriteToMasterRow<DiaryDocument>[],
  userId: string
): Promise<ReplicatedDiary[]> {
  const conflicts: ReplicatedDiary[] = [];

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
        `Diary replication cannot physically delete ${next.id}; use isDeleted tombstones`
      );
    }

    const current = await readRemoteDiary(next.id, userId);
    const assumed = row.assumedMasterState;

    if (!assumed) {
      if (!current) {
        const createConflict = await createRemoteDiary(next, userId);
        if (createConflict) conflicts.push(createConflict);
        continue;
      }

      // No assumed master means this row predates RxDB's persisted
      // replication metadata (first sync / metadata recovery). A local LWT
      // alone is not evidence of a local edit because downstream replication
      // also writes the local document. Identical state is acknowledged
      // without a remote write; otherwise only a genuinely newer
      // application-level edit is allowed to win this one-time bootstrap.
      if (diaryStateEquals(current, next)) {
        continue;
      }
      if (!isBootstrapLocalNewer(next.updatedAt, current.updatedAt)) {
        conflicts.push(current);
        continue;
      }
    } else if (current && !diaryStateEquals(current, assumed)) {
      conflicts.push(current);
      continue;
    }

    if (!current) {
      const createConflict = await createRemoteDiary(next, userId);
      if (createConflict) conflicts.push(createConflict);
      continue;
    }

    try {
      await guardedTablesDB.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLES.diary,
        rowId: next.id,
        data: toAppwriteFormat(
          next as unknown as Record<string, unknown>,
          'diary',
          userId
        ),
      });
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      const createConflict = await createRemoteDiary(next, userId);
      if (createConflict) conflicts.push(createConflict);
    }
  }

  return conflicts;
}

async function pullDiary(
  userId: string,
  checkpoint: DiaryReplicationCheckpoint | undefined,
  batchSize: number
): Promise<{
  documents: ReplicatedDiary[];
  checkpoint: DiaryReplicationCheckpoint | undefined;
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
    tableId: APPWRITE_TABLES.diary,
    queries,
    total: false,
  });
  const responseRows =
    (response as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
  assertRemoteRowsOwnedBy(responseRows, userId, 'Diary');
  const rows = responseRows.filter(
    (row) =>
      typeof row.$id === 'string' &&
      row.$id.length > 0 &&
      typeof row.$updatedAt === 'string' &&
      row.$updatedAt.length > 0
  );

  const last = rows.at(-1);
  return {
    documents: rows.map(toReplicatedDiary),
    checkpoint: last
      ? {
          id: last.$id as string,
          updatedAt: last.$updatedAt as string,
        }
      : checkpoint,
  };
}

export function captureDiaryReplicationPushCheckpoint(
  collection: RxCollection<DiaryDocument>
): Promise<DiaryReplicationPushCheckpoint | undefined> {
  return captureReplicationPushCheckpoint<DiaryDocument, DiaryReplicationPushCheckpoint>(
    collection,
    LOCAL_CHECKPOINT_BATCH_SIZE
  );
}

function subscribeToDiaryRealtime(
  userId: string,
  pullStream: Subject<
    RxReplicationPullStreamItem<
      DiaryDocument,
      DiaryReplicationCheckpoint
    >
  >
): RealtimeUnsubscribe {
  return subscribeToOwnerRealtime({
    channel:
      `databases.${APPWRITE_DATABASE_ID}.tables.${APPWRITE_TABLES.diary}.rows`,
    userId,
    isActiveOwner: () => activeOwnerId === userId,
    pullStream,
  });
}

export function isDiaryReplicationPilotActive(userId: string): boolean {
  return activeOwnerId === userId && activeReplication !== null;
}

export function resyncDiaryReplicationPilot(userId: string): boolean {
  if (!isDiaryReplicationPilotActive(userId)) return false;
  activeReplication?.reSync();
  return true;
}

export async function refreshDiaryReplicationPilot(
  userId: string,
  timeoutMs: number
): Promise<boolean> {
  if (
    !isDiaryReplicationPilotActive(userId) ||
    !activeReplication ||
    !activeCollection
  ) {
    return false;
  }
  await awaitPilotReplicationFreshness(
    'diary',
    activeReplication,
    activeCollection,
    timeoutMs
  );
  return true;
}

async function stopDiaryReplicationPilotNow(
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

async function startDiaryReplicationPilotNow(
  userId: string,
  collection: RxCollection<DiaryDocument>,
  initialPushCheckpoint: DiaryReplicationPushCheckpoint | undefined
): Promise<void> {
  if (!userId) return;
  if (isDiaryReplicationPilotActive(userId)) return;

  if (activeReplication) {
    await stopDiaryReplicationPilotNow();
  }

  const pullStream = new Subject<
    RxReplicationPullStreamItem<
      DiaryDocument,
      DiaryReplicationCheckpoint
    >
  >();

  const replication = replicateRxCollection<
    DiaryDocument,
    DiaryReplicationCheckpoint
  >({
    replicationIdentifier:
      getReplicationIdentifier('diary', userId),
    collection,
    live: true,
    retryTime: RETRY_TIME_MS,
    waitForLeadership: true,
    toggleOnDocumentVisible: true,
    pull: {
      batchSize: PULL_BATCH_SIZE,
      stream$: pullStream.asObservable(),
      handler: (checkpoint, batchSize) =>
        pullDiary(userId, checkpoint, batchSize),
    },
    push: {
      batchSize: PUSH_BATCH_SIZE,
      initialCheckpoint: initialPushCheckpoint,
      handler: (rows) => pushDiary(rows, userId),
    },
  });

  activeOwnerId = userId;
  activeReplication = replication;
  trackReplicationFreshness(replication, userId, 'diary');
  activeCollection = collection;
  activePullStream = pullStream;
  realtimeUnsubscribe = subscribeToDiaryRealtime(userId, pullStream);
  errorSubscription = replication.error$.subscribe((error) => {
    console.error('[DiaryReplicationPilot] replication error:', error);
  });
}

const runReplicationPilotLifecycle = createReplicationPilotLifecycleQueue();

export function stopDiaryReplicationPilot(
  ...args: Parameters<typeof stopDiaryReplicationPilotNow>
): ReturnType<typeof stopDiaryReplicationPilotNow> {
  return runReplicationPilotLifecycle(() => stopDiaryReplicationPilotNow(...args));
}

export function startDiaryReplicationPilot(
  ...args: Parameters<typeof startDiaryReplicationPilotNow>
): ReturnType<typeof startDiaryReplicationPilotNow> {
  return runReplicationPilotLifecycle(() => startDiaryReplicationPilotNow(...args));
}

export const __diaryReplicationPilotTestUtils = {
  pullDiary,
  pushDiary,
};
