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
import type { TaskDocument } from './schema';
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
import { uploadPendingImage } from '../lib/storage';
import {
  deletePendingImage,
  isPendingImageId,
} from '../lib/pendingImages';
import { awaitPilotReplicationFreshness } from './replicationFreshness';
import { getReplicationIdentifier } from './replicationIds';
import { trackReplicationFreshness } from './replicationLocalState';

const PULL_BATCH_SIZE = 100;
const PUSH_BATCH_SIZE = 20;
const LOCAL_CHECKPOINT_BATCH_SIZE = 200;
const RETRY_TIME_MS = 5_000;

export interface TaskReplicationCheckpoint {
  updatedAt: string;
  id: string;
}

export type TaskReplicationPushCheckpoint = {
  id: string;
  lwt: number;
};

type ReplicatedTask = WithDeletedAndAttachments<TaskDocument>;

let activeOwnerId: string | null = null;
let activeReplication:
  | RxReplicationState<TaskDocument, TaskReplicationCheckpoint>
  | null = null;
let activePullStream:
  | Subject<
      RxReplicationPullStreamItem<
        TaskDocument,
        TaskReplicationCheckpoint
      >
    >
  | null = null;
let realtimeUnsubscribe: RealtimeUnsubscribe | null = null;
let errorSubscription: Subscription | null = null;
let activeCollection: RxCollection<TaskDocument> | null = null;

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

function toReplicatedTask(row: Record<string, unknown>): ReplicatedTask {
  return {
    ...(fromAppwriteFormat(row, 'tasks') as unknown as TaskDocument),
    _deleted: false,
  };
}

function taskStateEquals(
  left: ReplicatedTask,
  right: ReplicatedTask
): boolean {
  return (
    left.id === right.id &&
    left.userId === right.userId &&
    left.title === right.title &&
    left.completed === right.completed &&
    left.categoryId === right.categoryId &&
    left.order === right.order &&
    (left.tags ?? '') === (right.tags ?? '') &&
    left.date === right.date &&
    (left.memo ?? '') === (right.memo ?? '') &&
    (left.image ?? '') === (right.image ?? '') &&
    left.createdAt === right.createdAt &&
    (left.completedAt ?? '') === (right.completedAt ?? '') &&
    left.updatedAt === right.updatedAt &&
    (left.source ?? '') === (right.source ?? '') &&
    left.isDeleted === right.isDeleted &&
    (left.routineId ?? '') === (right.routineId ?? '') &&
    (left.reminderTime ?? '') === (right.reminderTime ?? '') &&
    (left.reactions ?? '') === (right.reactions ?? '') &&
    left.visibility === right.visibility &&
    left._deleted === right._deleted
  );
}

/**
 * A friend reaction is the only ordinary server-side mutation of an owner's
 * task row. message-action changes both reactions and updated_at. Ignore those
 * two fields when deciding whether the remote row changed in an owner-controlled
 * field since RxDB's assumed master.
 */
function taskOwnerStateEquals(
  left: ReplicatedTask,
  right: ReplicatedTask
): boolean {
  return taskStateEquals(
    { ...left, reactions: '', updatedAt: '' },
    { ...right, reactions: '', updatedAt: '' }
  );
}

function laterIso(left: string, right: string): string {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (!Number.isFinite(leftMs)) return right;
  if (!Number.isFinite(rightMs)) return left;
  return leftMs >= rightMs ? left : right;
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

async function readRemoteTask(
  rowId: string
): Promise<ReplicatedTask | null> {
  try {
    const row = await guardedTablesDB.getRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLES.tasks,
      rowId,
    });
    return toReplicatedTask(row as unknown as Record<string, unknown>);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

async function createRemoteTask(
  document: ReplicatedTask,
  userId: string
): Promise<ReplicatedTask | null> {
  try {
    await guardedTablesDB.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLES.tasks,
      rowId: document.id,
      data: toAppwriteFormat(
        document as unknown as Record<string, unknown>,
        'tasks',
        userId
      ),
      permissions: buildRowPermissions(userId),
    });
    return null;
  } catch (error) {
    if (!isConflictError(error)) throw error;
    const current = await readRemoteTask(document.id);
    if (current) return current;
    throw error;
  }
}

async function prepareTaskForPush(
  document: ReplicatedTask,
  userId: string
): Promise<{
  document: ReplicatedTask;
  pendingImageId: string | null;
}> {
  const image =
    typeof document.image === 'string' ? document.image : '';
  if (!image || !isPendingImageId(image)) {
    return { document, pendingImageId: null };
  }

  if (document.isDeleted) {
    return {
      document: { ...document, image: '' },
      pendingImageId: image,
    };
  }

  const remoteFileId = await uploadPendingImage(image, userId);
  return {
    document: { ...document, image: remoteFileId },
    pendingImageId: image,
  };
}

async function cleanupPendingTaskImage(
  document: ReplicatedTask,
  userId: string
): Promise<void> {
  const image =
    typeof document.image === 'string' ? document.image : '';
  if (!image || !isPendingImageId(image)) return;
  try {
    await deletePendingImage(image, userId);
  } catch (error) {
    console.warn(
      '[TaskReplicationPilot] pending image cleanup failed:',
      error
    );
  }
}

async function finishSuccessfulPush(
  pendingImageId: string | null,
  userId: string
): Promise<void> {
  if (!pendingImageId) return;
  try {
    await deletePendingImage(pendingImageId, userId);
  } catch (error) {
    console.warn(
      '[TaskReplicationPilot] pending image cleanup failed:',
      error
    );
  }
}

function mergeServerReactionDrift(
  next: ReplicatedTask,
  current: ReplicatedTask,
  assumed: ReplicatedTask
): ReplicatedTask | null {
  if (taskStateEquals(current, assumed)) return next;
  if (!taskOwnerStateEquals(current, assumed)) return null;

  return {
    ...next,
    reactions: current.reactions ?? '',
    updatedAt: laterIso(next.updatedAt, current.updatedAt),
  };
}

async function pushTasks(
  rows: RxReplicationWriteToMasterRow<TaskDocument>[],
  userId: string
): Promise<ReplicatedTask[]> {
  const conflicts: ReplicatedTask[] = [];

  for (const row of rows) {
    const next = row.newDocumentState;
    if (next.userId !== userId) {
      throw new Error(`Task replication owner mismatch for ${next.id}`);
    }
    if (next._deleted) {
      throw new Error(
        `Task replication cannot physically delete ${next.id}; use isDeleted tombstones`
      );
    }

    const current = await readRemoteTask(next.id);
    if (current && current.userId !== userId) {
      throw new Error(
        `Task replication master owner mismatch for ${next.id}`
      );
    }

    const assumed = row.assumedMasterState;
    let documentToPush: ReplicatedTask = next;

    if (!assumed) {
      if (!current) {
        const prepared = await prepareTaskForPush(next, userId);
        const createConflict = await createRemoteTask(
          prepared.document,
          userId
        );
        if (createConflict) {
          await cleanupPendingTaskImage(next, userId);
          conflicts.push(createConflict);
          continue;
        }

        await finishSuccessfulPush(prepared.pendingImageId, userId);
        if (!taskStateEquals(prepared.document, next)) {
          conflicts.push(prepared.document);
        }
        continue;
      }

      // First sync / lost replication metadata: downstream writes can make
      // RxDB's local LWT look new even when the application state came from
      // Appwrite. A byte-for-byte-equivalent task is therefore acknowledged
      // without a write. Only a genuinely newer application edit may win.
      if (taskStateEquals(current, next)) {
        await cleanupPendingTaskImage(next, userId);
        continue;
      }
      if (!isBootstrapLocalNewer(next.updatedAt, current.updatedAt)) {
        await cleanupPendingTaskImage(next, userId);
        conflicts.push(current);
        continue;
      }

      // Reactions are server-mutated even for owner tasks. Preserve the
      // current remote reaction set while carrying the newer local owner edit.
      documentToPush = {
        ...next,
        reactions: current.reactions ?? '',
        updatedAt: laterIso(next.updatedAt, current.updatedAt),
      };
    } else {
      if (!current) {
        const prepared = await prepareTaskForPush(next, userId);
        const createConflict = await createRemoteTask(
          prepared.document,
          userId
        );
        if (createConflict) {
          await cleanupPendingTaskImage(next, userId);
          conflicts.push(createConflict);
          continue;
        }

        await finishSuccessfulPush(prepared.pendingImageId, userId);
        if (!taskStateEquals(prepared.document, next)) {
          conflicts.push(prepared.document);
        }
        continue;
      }

      const merged = mergeServerReactionDrift(next, current, assumed);
      if (!merged) {
        await cleanupPendingTaskImage(next, userId);
        conflicts.push(current);
        continue;
      }
      documentToPush = merged;
    }

    const prepared = await prepareTaskForPush(documentToPush, userId);

    try {
      await guardedTablesDB.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLES.tasks,
        rowId: prepared.document.id,
        data: toAppwriteFormat(
          prepared.document as unknown as Record<string, unknown>,
          'tasks',
          userId
        ),
      });
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      const createConflict = await createRemoteTask(
        prepared.document,
        userId
      );
      if (createConflict) {
        await cleanupPendingTaskImage(next, userId);
        conflicts.push(createConflict);
        continue;
      }
    }

    await finishSuccessfulPush(prepared.pendingImageId, userId);
    if (!taskStateEquals(prepared.document, next)) {
      conflicts.push(prepared.document);
    }
  }

  return conflicts;
}

async function pullTasks(
  userId: string,
  checkpoint: TaskReplicationCheckpoint | undefined,
  batchSize: number
): Promise<{
  documents: ReplicatedTask[];
  checkpoint: TaskReplicationCheckpoint | undefined;
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
    tableId: APPWRITE_TABLES.tasks,
    queries,
    total: false,
  });

  const rows = (
    (response as unknown as { rows?: Record<string, unknown>[] }).rows ?? []
  ).filter(
    (row) =>
      row.user_id === userId &&
      typeof row.$id === 'string' &&
      row.$id.length > 0 &&
      typeof row.$updatedAt === 'string' &&
      row.$updatedAt.length > 0
  );

  const last = rows.at(-1);
  return {
    documents: rows.map(toReplicatedTask),
    checkpoint: last
      ? {
          id: last.$id as string,
          updatedAt: last.$updatedAt as string,
        }
      : checkpoint,
  };
}

export async function captureTaskReplicationPushCheckpoint(
  collection: RxCollection<TaskDocument>
): Promise<TaskReplicationPushCheckpoint | undefined> {
  let checkpoint: TaskReplicationPushCheckpoint | undefined;

  for (;;) {
    const result = await getChangedDocumentsSince<
      TaskDocument,
      TaskReplicationPushCheckpoint
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

function subscribeToTaskRealtime(
  userId: string,
  pullStream: Subject<
    RxReplicationPullStreamItem<TaskDocument, TaskReplicationCheckpoint>
  >
): RealtimeUnsubscribe {
  const channel =
    `databases.${APPWRITE_DATABASE_ID}.tables.${APPWRITE_TABLES.tasks}.rows`;

  return guardedRealtime.subscribe(channel, (message) => {
    if (activeOwnerId !== userId) return;
    const payload = message.payload;
    if (!payload || payload.user_id !== userId) return;

    const events = Array.isArray(message.events) ? message.events : [];
    if (events.some((event) => event.endsWith('.delete'))) {
      pullStream.next('RESYNC');
      return;
    }
    if (
      !events.some(
        (event) => event.endsWith('.create') || event.endsWith('.update')
      )
    ) {
      return;
    }

    const id = payload.$id;
    const updatedAt = payload.$updatedAt;
    if (
      typeof id !== 'string' ||
      !id ||
      typeof updatedAt !== 'string' ||
      !updatedAt
    ) {
      pullStream.next('RESYNC');
      return;
    }

    pullStream.next({
      checkpoint: { id, updatedAt },
      documents: [toReplicatedTask(payload as Record<string, unknown>)],
    });
  });
}

export function isTaskReplicationPilotActive(userId: string): boolean {
  return activeOwnerId === userId && activeReplication !== null;
}

export function resyncTaskReplicationPilot(userId: string): boolean {
  if (!isTaskReplicationPilotActive(userId)) return false;
  activeReplication?.reSync();
  return true;
}

export async function refreshTaskReplicationPilot(
  userId: string,
  timeoutMs: number
): Promise<boolean> {
  if (
    !isTaskReplicationPilotActive(userId) ||
    !activeReplication ||
    !activeCollection
  ) {
    return false;
  }

  await awaitPilotReplicationFreshness(
    'task',
    activeReplication,
    activeCollection,
    timeoutMs
  );
  return true;
}

async function stopTaskReplicationPilotNow(
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

async function startTaskReplicationPilotNow(
  userId: string,
  collection: RxCollection<TaskDocument>,
  initialPushCheckpoint: TaskReplicationPushCheckpoint | undefined
): Promise<void> {
  if (!userId) return;
  if (isTaskReplicationPilotActive(userId)) return;

  if (activeReplication) {
    await stopTaskReplicationPilotNow();
  }

  const pullStream = new Subject<
    RxReplicationPullStreamItem<TaskDocument, TaskReplicationCheckpoint>
  >();

  const replication = replicateRxCollection<
    TaskDocument,
    TaskReplicationCheckpoint
  >({
    replicationIdentifier:
      getReplicationIdentifier('tasks', userId),
    collection,
    live: true,
    retryTime: RETRY_TIME_MS,
    waitForLeadership: true,
    toggleOnDocumentVisible: true,
    pull: {
      batchSize: PULL_BATCH_SIZE,
      stream$: pullStream.asObservable(),
      handler: (checkpoint, batchSize) =>
        pullTasks(userId, checkpoint, batchSize),
    },
    push: {
      batchSize: PUSH_BATCH_SIZE,
      initialCheckpoint: initialPushCheckpoint,
      handler: (rows) => pushTasks(rows, userId),
    },
  });

  activeOwnerId = userId;
  activeReplication = replication;
  trackReplicationFreshness(replication, userId, 'tasks');
  activeCollection = collection;
  activePullStream = pullStream;
  realtimeUnsubscribe = subscribeToTaskRealtime(userId, pullStream);
  errorSubscription = replication.error$.subscribe((error) => {
    console.error('[TaskReplicationPilot] replication error:', error);
  });
}

const runReplicationPilotLifecycle = createReplicationPilotLifecycleQueue();

export function stopTaskReplicationPilot(
  ...args: Parameters<typeof stopTaskReplicationPilotNow>
): ReturnType<typeof stopTaskReplicationPilotNow> {
  return runReplicationPilotLifecycle(() => stopTaskReplicationPilotNow(...args));
}

export function startTaskReplicationPilot(
  ...args: Parameters<typeof startTaskReplicationPilotNow>
): ReturnType<typeof startTaskReplicationPilotNow> {
  return runReplicationPilotLifecycle(() => startTaskReplicationPilotNow(...args));
}

export const __taskReplicationPilotTestUtils = {
  pullTasks,
  pushTasks,
};
