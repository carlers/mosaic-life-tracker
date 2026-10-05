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
import type { CategoryDocument } from './schema';
import { guardedTablesDB, type RealtimeUnsubscribe } from '../lib/sdk';
import { fromAppwriteFormat, toAppwriteFormat } from '../lib/syncMapping';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLES,
} from '../lib/appwriteConfig';
import { awaitPilotReplicationFreshness } from './replicationFreshness';
import { getReplicationIdentifier } from './replicationIds';
import { trackReplicationFreshness } from './replicationLocalState';
import { assertRemoteRowOwnedBy } from './replicationOwnership';

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
  rowId: string,
  userId: string
): Promise<ReplicatedCategory | null> {
  try {
    const row = await guardedTablesDB.getRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLES.categories,
      rowId,
    });
    const raw = row as unknown as Record<string, unknown>;
    assertRemoteRowOwnedBy(raw, userId, 'Category');
    return toReplicatedCategory(raw);
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
    const current = await readRemoteCategory(document.id, userId);
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

    const current = await readRemoteCategory(next.id, userId);
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
  return pullOwnerRowsByUpdatedAtId<ReplicatedCategory, CategoryReplicationCheckpoint>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLES.categories,
    userId,
    ownerLabel: 'Category',
    checkpoint,
    batchSize,
    mapRow: toReplicatedCategory,
  });
}

export function captureCategoryReplicationPushCheckpoint(
  collection: RxCollection<CategoryDocument>
): Promise<CategoryReplicationPushCheckpoint | undefined> {
  return captureReplicationPushCheckpoint<CategoryDocument, CategoryReplicationPushCheckpoint>(
    collection,
    LOCAL_CHECKPOINT_BATCH_SIZE
  );
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
  return subscribeToOwnerRealtime({
    channel:
      `databases.${APPWRITE_DATABASE_ID}.tables.${APPWRITE_TABLES.categories}.rows`,
    userId,
    isActiveOwner: () => activeOwnerId === userId,
    pullStream,
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
