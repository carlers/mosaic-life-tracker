import { recordCompletionConflict } from '../lib/syncStatus';
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
import type { TaskDocument } from './schema';
import { guardedTablesDB, type RealtimeUnsubscribe } from '../lib/sdk';
import { sendAppAction } from '../lib/appAction';
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
import { assertRemoteRowOwnedBy } from './replicationOwnership';
import { readOwnerMaster, updateOwnerRowWithCas } from './ownerWriteCas';
import {
  loadAcceptedFriendIds,
  sanitizeTaskReactions,
} from './socialReferenceSanitizer';

const PULL_BATCH_SIZE = 100;
const PUSH_BATCH_SIZE = 20;
const LOCAL_CHECKPOINT_BATCH_SIZE = 200;
const RETRY_TIME_MS = 5_000;
const TODOMATE_PUSH_CONCURRENCY = 4;
const TODOMATE_CREATE_INTERVAL_MS = 510;

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
const todoMateCreatePacers = new Map<
  string,
  { nextAt: number; tail: Promise<void> }
>();

function waitForTodoMateCreateSlot(userId: string): Promise<void> {
  let pacer = todoMateCreatePacers.get(userId);
  if (!pacer) {
    pacer = { nextAt: 0, tail: Promise.resolve() };
    todoMateCreatePacers.set(userId, pacer);
  }

  const slot = pacer.tail.then(async () => {
    const waitMs = pacer!.nextAt - Date.now();
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    pacer!.nextAt = Date.now() + TODOMATE_CREATE_INTERVAL_MS;
  });
  pacer.tail = slot.catch(() => {});
  return slot;
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
 * Reactions and explicit shared-task completion are server-writable. Other
 * task fields remain creator-owned. Never use timestamp-only last-writer-wins.
 */
function taskOwnerStateEquals(
  left: ReplicatedTask,
  right: ReplicatedTask
): boolean {
  return taskStateEquals(
    { ...left, reactions: '', updatedAt: '', completed: false, completedAt: '' },
    { ...right, reactions: '', updatedAt: '', completed: false, completedAt: '' }
  );
}
function completionChanged(left: ReplicatedTask, right: ReplicatedTask): boolean {
  return left.completed !== right.completed ||
    (left.completedAt ?? '') !== (right.completedAt ?? '');
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

async function readRemoteTaskMaster(
  rowId: string,
  userId: string
) {
  return readOwnerMaster(
    APPWRITE_TABLES.tasks,
    rowId,
    userId,
    toReplicatedTask
  );
}

async function createRemoteTask(
  document: ReplicatedTask,
  userId: string
): Promise<Awaited<ReturnType<typeof readRemoteTaskMaster>>> {
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
    const current = await readRemoteTaskMaster(document.id, userId);
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
  let preparedDocument = document;
  const reactions =
    typeof document.reactions === 'string' ? document.reactions : '';
  if (reactions && !document.isDeleted) {
    const acceptedFriendIds = await loadAcceptedFriendIds(userId);
    preparedDocument = {
      ...document,
      reactions: sanitizeTaskReactions(reactions, acceptedFriendIds),
    };
  }

  const image =
    typeof preparedDocument.image === 'string'
      ? preparedDocument.image
      : '';
  if (!image || !isPendingImageId(image)) {
    return { document: preparedDocument, pendingImageId: null };
  }

  if (preparedDocument.isDeleted) {
    return {
      document: { ...preparedDocument, image: '' },
      pendingImageId: image,
    };
  }

  const remoteFileId = await uploadPendingImage(image, userId);
  return {
    document: { ...preparedDocument, image: remoteFileId },
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

  const serverCompleted = completionChanged(current, assumed);
  const locallyCompleted = completionChanged(next, assumed);
  if (serverCompleted && locallyCompleted) {
    // Two completion intentions cannot be merged without choosing a winner.
    // Preserve the remote master, but durably surface the local conflict.
    recordCompletionConflict(next.userId);
    return null;
  }
  return {
    ...next,
    ...(serverCompleted ? {
      completed: current.completed,
      completedAt: current.completedAt,
    } : {}),
    reactions: current.reactions ?? '',
    updatedAt: laterIso(next.updatedAt, current.updatedAt),
  };
}

function isParallelTodoMateRow(
  row: RxReplicationWriteToMasterRow<TaskDocument>,
  userId: string
): boolean {
  const next = row.newDocumentState;
  return (
    next.userId === userId &&
    !next._deleted &&
    !row.assumedMasterState &&
    next.source === 'todomate' &&
    !isPendingImageId(next.image ?? '') &&
    !next.reactions
  );
}

type TodoMateBatchResult = {
  id: string;
  status: 'created' | 'existing';
  row?: Record<string, unknown>;
};

function isUnsupportedTodoMateBatchAction(error: unknown): boolean {
  const candidate = error as {
    code?: number;
    result?: { error?: unknown };
  };
  return (
    candidate?.code === 400 &&
    typeof candidate.result?.error === 'string' &&
    candidate.result.error.startsWith('Unknown action:')
  );
}

async function pushTodoMateRowsViaFunction(
  rows: RxReplicationWriteToMasterRow<TaskDocument>[],
  userId: string
): Promise<ReplicatedTask[] | null> {
  let response: Record<string, unknown>;
  try {
    response = await sendAppAction(
      {
        action: 'bulk_create_todomate_tasks',
        tasks: rows.map((row) => ({
          id: row.newDocumentState.id,
          data: toAppwriteFormat(
            row.newDocumentState as unknown as Record<string, unknown>,
            'tasks',
            userId
          ),
        })),
      },
      25_000
    );
  } catch (error) {
    if (isUnsupportedTodoMateBatchAction(error)) return null;
    throw error;
  }

  if (!Array.isArray(response.results)) {
    throw new Error('TodoMate task batch returned an invalid response');
  }
  const results = response.results as TodoMateBatchResult[];
  const byId = new Map(results.map((result) => [result.id, result]));
  if (byId.size !== rows.length) {
    throw new Error('TodoMate task batch returned an incomplete response');
  }

  const conflicts: ReplicatedTask[] = [];
  for (const row of rows) {
    const next = row.newDocumentState;
    const result = byId.get(next.id);
    if (!result || (result.status !== 'created' && result.status !== 'existing')) {
      throw new Error('TodoMate task batch returned an invalid row result');
    }
    if (result.status === 'created') continue;
    if (!result.row || typeof result.row !== 'object') {
      throw new Error('TodoMate task batch omitted existing row state');
    }

    assertRemoteRowOwnedBy(result.row, userId, 'Task');
    const current = toReplicatedTask(result.row);
    if (taskStateEquals(current, next)) continue;
    if (!isBootstrapLocalNewer(next.updatedAt, current.updatedAt)) {
      conflicts.push(current);
      continue;
    }

    // Rare same-owner ID collision where the imported row is genuinely newer:
    // fall back to the established single-row bootstrap/update path.
    conflicts.push(...(await pushTasks([row], userId, true)));
  }

  return conflicts;
}

async function pushParallelTodoMateRows(
  rows: RxReplicationWriteToMasterRow<TaskDocument>[],
  userId: string
): Promise<ReplicatedTask[]> {
  const results: ReplicatedTask[][] = Array.from(
    { length: rows.length },
    () => []
  );
  let cursor = 0;
  let failed = false;
  let failure: unknown;

  const worker = async () => {
    while (!failed) {
      const index = cursor++;
      if (index >= rows.length) return;
      try {
        results[index] = await pushTasks([rows[index]], userId, true);
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
        return;
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(TODOMATE_PUSH_CONCURRENCY, rows.length) },
      worker
    )
  );
  if (failed) throw failure;
  return results.flat();
}

async function pushTasks(
  rows: RxReplicationWriteToMasterRow<TaskDocument>[],
  userId: string,
  nested = false
): Promise<ReplicatedTask[]> {
  if (
    !nested &&
    rows.length > 1 &&
    rows.every((row) => isParallelTodoMateRow(row, userId))
  ) {
    const serverBatch = await pushTodoMateRowsViaFunction(rows, userId);
    if (serverBatch) return serverBatch;
    return pushParallelTodoMateRows(rows, userId);
  }

  const conflicts: ReplicatedTask[] = [];

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
        `Task replication cannot physically delete ${next.id}; use isDeleted tombstones`
      );
    }

    const assumed = row.assumedMasterState;
    let master: Awaited<ReturnType<typeof readRemoteTaskMaster>>;
    let current: ReplicatedTask | null;

    if (
      !assumed &&
      next.source === 'todomate' &&
      !isPendingImageId(next.image ?? '') &&
      !next.reactions
    ) {
      // Fresh TodoMate imports are deterministic, side-effect-free rows.
      // Try the create directly so a brand-new import does not pay an
      // expected getRow -> 404 round trip for every task. Fresh create starts
      // are paced below Appwrite's shared client create-row rate limit while
      // a small worker pool overlaps request latency.
      await waitForTodoMateCreateSlot(userId);
      const createConflict = await createRemoteTask(next, userId);
      if (!createConflict) {
        continue;
      }
      master = createConflict;
      current = createConflict.document;
    } else {
      master = await readRemoteTaskMaster(next.id, userId);
      current = master?.document ?? null;
    }

    if (current && current.userId !== userId) {
      throw new Error(
        `Task replication master owner mismatch for ${next.id}`
      );
    }

    let documentToPush: ReplicatedTask;

    if (!assumed) {
      if (!current) {
        const prepared = await prepareTaskForPush(next, userId);
        const createConflict = await createRemoteTask(
          prepared.document,
          userId
        );
        if (createConflict) {
          await cleanupPendingTaskImage(next, userId);
          conflicts.push(createConflict.document);
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
      // Missing replication metadata is not a license to overwrite a server
      // completion merely because this client's local updatedAt is newer.
      // Without an assumed master we cannot separate an owner completion
      // intent from independent title/date edits; protect the remote truth.
      if (completionChanged(next, current)) {
        recordCompletionConflict(userId);
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
          conflicts.push(createConflict.document);
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

    let prepared = await prepareTaskForPush(documentToPush, userId);
    if (!master) {
      throw new Error(
        `Task replication master token missing for ${prepared.document.id}`
      );
    }

    let writeResult = await updateOwnerRowWithCas(
      'tasks',
      prepared.document.id,
      userId,
      master.serverUpdatedAt,
      toAppwriteFormat(
        prepared.document as unknown as Record<string, unknown>,
        'tasks',
        userId
      )
    );

    // A friend can mutate reactions between our master read and CAS. Preserve
    // that server-owned drift and retry once; owner-field drift remains a real
    // conflict and must never be overwritten.
    if (writeResult.status === 'conflict' && assumed) {
      const latest = toReplicatedTask(writeResult.row);
      const retryDocument = mergeServerReactionDrift(next, latest, assumed);
      const retryUpdatedAt = writeResult.row.$updatedAt;
      if (
        retryDocument &&
        typeof retryUpdatedAt === 'string' &&
        !Number.isNaN(Date.parse(retryUpdatedAt))
      ) {
        prepared = await prepareTaskForPush(retryDocument, userId);
        writeResult = await updateOwnerRowWithCas(
          'tasks',
          prepared.document.id,
          userId,
          retryUpdatedAt,
          toAppwriteFormat(
            prepared.document as unknown as Record<string, unknown>,
            'tasks',
            userId
          )
        );
      }
    }

    if (writeResult.status === 'conflict') {
      await cleanupPendingTaskImage(next, userId);
      conflicts.push(toReplicatedTask(writeResult.row));
      continue;
    }
    if (writeResult.status === 'missing') {
      const createConflict = await createRemoteTask(
        prepared.document,
        userId
      );
      if (createConflict) {
        await cleanupPendingTaskImage(next, userId);
        conflicts.push(createConflict.document);
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
  return pullOwnerRowsByUpdatedAtId<ReplicatedTask, TaskReplicationCheckpoint>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLES.tasks,
    userId,
    ownerLabel: 'Task',
    checkpoint,
    batchSize,
    mapRow: toReplicatedTask,
  });
}

export function captureTaskReplicationPushCheckpoint(
  collection: RxCollection<TaskDocument>
): Promise<TaskReplicationPushCheckpoint | undefined> {
  return captureReplicationPushCheckpoint<TaskDocument, TaskReplicationPushCheckpoint>(
    collection,
    LOCAL_CHECKPOINT_BATCH_SIZE
  );
}

function subscribeToTaskRealtime(
  userId: string,
  pullStream: Subject<
    RxReplicationPullStreamItem<
      TaskDocument,
      TaskReplicationCheckpoint
    >
  >
): RealtimeUnsubscribe {
  return subscribeToOwnerRealtime({
    channel:
      `databases.${APPWRITE_DATABASE_ID}.tables.${APPWRITE_TABLES.tasks}.rows`,
    userId,
    isActiveOwner: () => activeOwnerId === userId,
    pullStream,
  });
}

export function isTaskReplicationPilotActive(userId: string): boolean {
  return activeOwnerId === userId && activeReplication !== null;
}

export function subscribeTaskPushProgress(
  userId: string,
  taskIds: string[],
  onProgress: (progress: { completed: number; total: number }) => void
): (() => void) | null {
  if (!isTaskReplicationPilotActive(userId) || !activeReplication) return null;

  const pending = new Set(taskIds);
  const total = pending.size;
  let completed = 0;
  onProgress({ completed, total });
  if (total === 0) return () => {};

  const subscription = activeReplication.sent$.subscribe((document) => {
    if (
      document.userId === userId &&
      pending.delete(document.id)
    ) {
      completed += 1;
      onProgress({ completed, total });
    }
  });
  return () => subscription.unsubscribe();
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
  resetTodoMateCreatePacing: () => todoMateCreatePacers.clear(),
};
