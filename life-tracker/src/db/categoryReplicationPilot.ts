import { createReplicationPilotLifecycleQueue } from './replicationPilotLifecycle';
import { Permission, Query, Role } from 'appwrite';
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
import type { CategoryDocument } from './schema';
import {
  guardedRealtime,
  guardedTablesDB,
  type RealtimeUnsubscribe,
} from '../lib/sdk';
import { fromAppwriteFormat, toAppwriteFormat } from '../lib/syncMapping';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLES,
} from '../lib/appwriteConfig';
import { awaitPilotReplicationFreshness } from './replicationFreshness';
import { getReplicationIdentifier } from './replicationIds';
import { trackReplicationFreshness } from './replicationLocalState';

const PULL_BATCH_SIZE = 100;
const PUSH_BATCH_SIZE = 20;
const LOCAL_CHECKPOINT_BATCH_SIZE = 200;
const RETRY_TIME_MS = 5_000;

export interface CategoryReplicationCheckpoint {
  updatedAt: string;
  id: string;
}

export type CategoryReplicationPushCheckpoint = {
  id: string;
  lwt: number;
};

type ReplicatedCategory = WithDeletedAndAttachments<CategoryDocument>;

let activeOwnerId: string | null = null;
let activeReplication:
  | RxReplicationState<CategoryDocument, CategoryReplicationCheckpoint>
  | null = null;
let activePullStream:
  | Subject<
      RxReplicationPullStreamItem<
        CategoryDocument,
        CategoryReplicationCheckpoint
      >
    >
  | null = null;
let realtimeUnsubscribe: RealtimeUnsubscribe | null = null;
let errorSubscription: Subscription | null = null;
let activeCollection: RxCollection<CategoryDocument> | null = null;

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

function toReplicatedCategory(
  row: Record<string, unknown>
): ReplicatedCategory {
  return {
    ...(fromAppwriteFormat(row, 'categories') as unknown as CategoryDocument),
    _deleted: false,
  };
}

function categoryStateEquals(
  left: ReplicatedCategory,
  right: ReplicatedCategory
): boolean {
  return (
    left.id === right.id &&
    left.userId === right.userId &&
    left.name === right.name &&
    left.color === right.color &&
    left.order === right.order &&
    left.visibility === right.visibility &&
    left.isDeleted === right.isDeleted &&
    (left.icon ?? '') === (right.icon ?? '') &&
    left.updatedAt === right.updatedAt &&
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

async function readRemoteCategory(
  rowId: string
): Promise<ReplicatedCategory | null> {
  try {
    const row = await guardedTablesDB.getRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLES.categories,
      rowId,
    });
    return toReplicatedCategory(row as unknown as Record<string, unknown>);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

async function createRemoteCategory(
  document: ReplicatedCategory,
  userId: string
): Promise<ReplicatedCategory | null> {
  try {
    await guardedTablesDB.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLES.categories,
      rowId: document.id,
      data: toAppwriteFormat(
        document as unknown as Record<string, unknown>,
        'categories',
        userId
      ),
      permissions: buildRowPermissions(userId),
    });
    return null;
  } catch (error) {
    if (!isConflictError(error)) throw error;
    const current = await readRemoteCategory(document.id);
    if (current) return current;
    throw error;
  }
}

async function pushCategories(
  rows: RxReplicationWriteToMasterRow<CategoryDocument>[],
  userId: string
): Promise<ReplicatedCategory[]> {
  const conflicts: ReplicatedCategory[] = [];

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
        `Category replication cannot physically delete ${next.id}; use isDeleted tombstones`
      );
    }

    const current = await readRemoteCategory(next.id);
    const assumed = row.assumedMasterState;

    if (!assumed) {
      if (!current) {
        const createConflict = await createRemoteCategory(next, userId);
        if (createConflict) conflicts.push(createConflict);
        continue;
      }

      // No assumed master means this row predates RxDB's persisted
      // replication metadata (first sync / metadata recovery). A local LWT
      // alone is not evidence of a local edit because downstream replication
      // also writes the local document. Identical state is acknowledged
      // without a remote write; otherwise only a genuinely newer
      // application-level edit is allowed to win this one-time bootstrap.
      if (categoryStateEquals(current, next)) {
        continue;
      }
      if (!isBootstrapLocalNewer(next.updatedAt, current.updatedAt)) {
        conflicts.push(current);
        continue;
      }
    } else if (current && !categoryStateEquals(current, assumed)) {
      conflicts.push(current);
      continue;
    }

    if (!current) {
      const createConflict = await createRemoteCategory(next, userId);
      if (createConflict) conflicts.push(createConflict);
      continue;
    }

    try {
      await guardedTablesDB.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLES.categories,
        rowId: next.id,
        data: toAppwriteFormat(
          next as unknown as Record<string, unknown>,
          'categories',
          userId
        ),
      });
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      const createConflict = await createRemoteCategory(next, userId);
      if (createConflict) conflicts.push(createConflict);
    }
  }

  return conflicts;
}

async function pullCategories(
  userId: string,
  checkpoint: CategoryReplicationCheckpoint | undefined,
  batchSize: number
): Promise<{
  documents: ReplicatedCategory[];
  checkpoint: CategoryReplicationCheckpoint | undefined;
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
    tableId: APPWRITE_TABLES.categories,
    queries,
    total: false,
  });
  const rows = (
    (response as unknown as { rows?: Record<string, unknown>[] }).rows ?? []
  ).filter(
    (row) =>
      typeof row.$id === 'string' &&
      row.$id.length > 0 &&
      typeof row.$updatedAt === 'string' &&
      row.$updatedAt.length > 0
  );

  const last = rows.at(-1);
  return {
    documents: rows.map(toReplicatedCategory),
    checkpoint: last
      ? {
          id: last.$id as string,
          updatedAt: last.$updatedAt as string,
        }
      : checkpoint,
  };
}

export async function captureCategoryReplicationPushCheckpoint(
  collection: RxCollection<CategoryDocument>
): Promise<CategoryReplicationPushCheckpoint | undefined> {
  let checkpoint: CategoryReplicationPushCheckpoint | undefined;

  for (;;) {
    const result = await getChangedDocumentsSince<
      CategoryDocument,
      CategoryReplicationPushCheckpoint
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

function subscribeToCategoryRealtime(
  userId: string,
  pullStream: Subject<
    RxReplicationPullStreamItem<
      CategoryDocument,
      CategoryReplicationCheckpoint
    >
  >
): RealtimeUnsubscribe {
  const channel =
    `databases.${APPWRITE_DATABASE_ID}.tables.${APPWRITE_TABLES.categories}.rows`;

  return guardedRealtime.subscribe(channel, (message) => {
    if (activeOwnerId !== userId) return;
    const payload = message.payload;
    const events = Array.isArray(message.events) ? message.events : [];

    if (events.some((event) => event.endsWith('.delete'))) {
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

export function isCategoryReplicationPilotActive(userId: string): boolean {
  return activeOwnerId === userId && activeReplication !== null;
}

export function resyncCategoryReplicationPilot(userId: string): boolean {
  if (!isCategoryReplicationPilotActive(userId)) return false;
  activeReplication?.reSync();
  return true;
}

export async function refreshCategoryReplicationPilot(
  userId: string,
  timeoutMs: number
): Promise<boolean> {
  if (
    !isCategoryReplicationPilotActive(userId) ||
    !activeReplication ||
    !activeCollection
  ) {
    return false;
  }
  await awaitPilotReplicationFreshness(
    'category',
    activeReplication,
    activeCollection,
    timeoutMs
  );
  return true;
}

async function stopCategoryReplicationPilotNow(
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

async function startCategoryReplicationPilotNow(
  userId: string,
  collection: RxCollection<CategoryDocument>,
  initialPushCheckpoint: CategoryReplicationPushCheckpoint | undefined
): Promise<void> {
  if (!userId) return;
  if (isCategoryReplicationPilotActive(userId)) return;

  if (activeReplication) {
    await stopCategoryReplicationPilotNow();
  }

  // The caller captures this checkpoint before the legacy bootstrap sync.
  // That makes all pre-bootstrap history eligible for suppression while
  // keeping writes made during the bootstrap newer than the seed, so RxDB
  // still pushes them after the handoff.
  const pullStream = new Subject<
    RxReplicationPullStreamItem<
      CategoryDocument,
      CategoryReplicationCheckpoint
    >
  >();

  const replication = replicateRxCollection<
    CategoryDocument,
    CategoryReplicationCheckpoint
  >({
    replicationIdentifier:
      getReplicationIdentifier('categories', userId),
    collection,
    live: true,
    retryTime: RETRY_TIME_MS,
    waitForLeadership: true,
    toggleOnDocumentVisible: true,
    pull: {
      batchSize: PULL_BATCH_SIZE,
      stream$: pullStream.asObservable(),
      handler: (checkpoint, batchSize) =>
        pullCategories(userId, checkpoint, batchSize),
    },
    push: {
      batchSize: PUSH_BATCH_SIZE,
      initialCheckpoint: initialPushCheckpoint,
      handler: (rows) => pushCategories(rows, userId),
    },
  });

  activeOwnerId = userId;
  activeReplication = replication;
  trackReplicationFreshness(replication, userId, 'categories');
  activeCollection = collection;
  activePullStream = pullStream;
  realtimeUnsubscribe = subscribeToCategoryRealtime(userId, pullStream);
  errorSubscription = replication.error$.subscribe((error) => {
    console.error('[CategoryReplicationPilot] replication error:', error);
  });
}

const runReplicationPilotLifecycle = createReplicationPilotLifecycleQueue();

export function stopCategoryReplicationPilot(
  ...args: Parameters<typeof stopCategoryReplicationPilotNow>
): ReturnType<typeof stopCategoryReplicationPilotNow> {
  return runReplicationPilotLifecycle(() => stopCategoryReplicationPilotNow(...args));
}

export function startCategoryReplicationPilot(
  ...args: Parameters<typeof startCategoryReplicationPilotNow>
): ReturnType<typeof startCategoryReplicationPilotNow> {
  return runReplicationPilotLifecycle(() => startCategoryReplicationPilotNow(...args));
}

export const __categoryReplicationPilotTestUtils = {
  pullCategories,
  pushCategories,
};
