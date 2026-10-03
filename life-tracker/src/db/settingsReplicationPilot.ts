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
import type { SettingsDocument } from './schema';
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
import {
  makeProfileImageReadable,
  uploadPendingImage,
} from '../lib/storage';
import {
  deletePendingImage,
  isPendingImageId,
} from '../lib/pendingImages';
import { updateProfileAvatar } from '../lib/social';
import { awaitPilotReplicationFreshness } from './replicationFreshness';
import { getReplicationIdentifier } from './replicationIds';
import { trackReplicationFreshness } from './replicationLocalState';

const PULL_BATCH_SIZE = 100;
const PUSH_BATCH_SIZE = 20;
const LOCAL_CHECKPOINT_BATCH_SIZE = 200;
const RETRY_TIME_MS = 5_000;

export interface SettingsReplicationCheckpoint {
  updatedAt: string;
  id: string;
}

export type SettingsReplicationPushCheckpoint = {
  id: string;
  lwt: number;
};

type ReplicatedSetting = WithDeletedAndAttachments<SettingsDocument>;

let activeOwnerId: string | null = null;
let activeReplication:
  | RxReplicationState<SettingsDocument, SettingsReplicationCheckpoint>
  | null = null;
let activePullStream:
  | Subject<
      RxReplicationPullStreamItem<
        SettingsDocument,
        SettingsReplicationCheckpoint
      >
    >
  | null = null;
let realtimeUnsubscribe: RealtimeUnsubscribe | null = null;
let errorSubscription: Subscription | null = null;
let activeCollection: RxCollection<SettingsDocument> | null = null;

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

function toReplicatedSetting(
  row: Record<string, unknown>
): ReplicatedSetting {
  return {
    ...(fromAppwriteFormat(row, 'settings') as unknown as SettingsDocument),
    _deleted: false,
  };
}

function settingStateEquals(
  left: ReplicatedSetting,
  right: ReplicatedSetting
): boolean {
  return (
    left.id === right.id &&
    left.userId === right.userId &&
    left.key === right.key &&
    left.value === right.value &&
    left.isDeleted === right.isDeleted &&
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

async function readRemoteSetting(
  rowId: string
): Promise<ReplicatedSetting | null> {
  try {
    const row = await guardedTablesDB.getRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLES.settings,
      rowId,
    });
    return toReplicatedSetting(row as unknown as Record<string, unknown>);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

async function prepareSettingForPush(
  document: ReplicatedSetting,
  userId: string
): Promise<{
  document: ReplicatedSetting;
  pendingImageId: string | null;
}> {
  if (
    document.key !== 'profileImageId' ||
    typeof document.value !== 'string' ||
    !isPendingImageId(document.value)
  ) {
    return { document, pendingImageId: null };
  }

  const pendingImageId = document.value;
  if (document.isDeleted) {
    return {
      document: { ...document, value: '' },
      pendingImageId,
    };
  }

  const remoteFileId = await uploadPendingImage(pendingImageId, userId);
  await makeProfileImageReadable(remoteFileId, userId);
  return {
    document: { ...document, value: remoteFileId },
    pendingImageId,
  };
}

async function mirrorProfileImageSetting(
  document: ReplicatedSetting,
  userId: string
): Promise<void> {
  if (
    document.key !== 'profileImageId' ||
    document.isDeleted ||
    typeof document.value !== 'string' ||
    !document.value
  ) {
    return;
  }
  await updateProfileAvatar(userId, document.value);
}

async function cleanupPendingProfileImage(
  document: ReplicatedSetting,
  userId: string
): Promise<void> {
  if (
    document.key !== 'profileImageId' ||
    typeof document.value !== 'string' ||
    !isPendingImageId(document.value)
  ) {
    return;
  }
  try {
    await deletePendingImage(document.value, userId);
  } catch (error) {
    console.warn(
      '[SettingsReplicationPilot] pending image cleanup failed:',
      error
    );
  }
}

async function finishSuccessfulPush(
  document: ReplicatedSetting,
  userId: string,
  pendingImageId: string | null
): Promise<void> {
  await mirrorProfileImageSetting(document, userId);
  if (!pendingImageId) return;
  await cleanupPendingProfileImage(
    { ...document, value: pendingImageId },
    userId
  );
}

async function createRemoteSetting(
  document: ReplicatedSetting,
  userId: string
): Promise<ReplicatedSetting | null> {
  try {
    await guardedTablesDB.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLES.settings,
      rowId: document.id,
      data: toAppwriteFormat(
        document as unknown as Record<string, unknown>,
        'settings',
        userId
      ),
      permissions: buildRowPermissions(userId),
    });
    return null;
  } catch (error) {
    if (!isConflictError(error)) throw error;
    const current = await readRemoteSetting(document.id);
    if (current) return current;
    throw error;
  }
}

async function pushSettings(
  rows: RxReplicationWriteToMasterRow<SettingsDocument>[],
  userId: string
): Promise<ReplicatedSetting[]> {
  const conflicts: ReplicatedSetting[] = [];

  for (const row of rows) {
    const next = row.newDocumentState;
    if (next.userId !== userId) {
      throw new Error(`Settings replication owner mismatch for ${next.id}`);
    }
    if (next._deleted) {
      throw new Error(
        `Settings replication cannot physically delete ${next.id}; use isDeleted tombstones`
      );
    }

    const current = await readRemoteSetting(next.id);
    const assumed = row.assumedMasterState;

    if (!assumed) {
      if (!current) {
        const prepared = await prepareSettingForPush(next, userId);
        const createConflict = await createRemoteSetting(
          prepared.document,
          userId
        );
        if (createConflict) {
          await mirrorProfileImageSetting(createConflict, userId);
          await cleanupPendingProfileImage(next, userId);
          conflicts.push(createConflict);
          continue;
        }
        await finishSuccessfulPush(
          prepared.document,
          userId,
          prepared.pendingImageId
        );
        if (!settingStateEquals(prepared.document, next)) {
          conflicts.push(prepared.document);
        }
        continue;
      }

      if (settingStateEquals(current, next)) {
        await mirrorProfileImageSetting(current, userId);
        continue;
      }
      if (!isBootstrapLocalNewer(next.updatedAt, current.updatedAt)) {
        await mirrorProfileImageSetting(current, userId);
        await cleanupPendingProfileImage(next, userId);
        conflicts.push(current);
        continue;
      }
    } else if (current && !settingStateEquals(current, assumed)) {
      await mirrorProfileImageSetting(current, userId);
      await cleanupPendingProfileImage(next, userId);
      conflicts.push(current);
      continue;
    }

    const prepared = await prepareSettingForPush(next, userId);

    if (!current) {
      const createConflict = await createRemoteSetting(
        prepared.document,
        userId
      );
      if (createConflict) {
        await mirrorProfileImageSetting(createConflict, userId);
        await cleanupPendingProfileImage(next, userId);
        conflicts.push(createConflict);
        continue;
      }
      await finishSuccessfulPush(
        prepared.document,
        userId,
        prepared.pendingImageId
      );
      if (!settingStateEquals(prepared.document, next)) {
        conflicts.push(prepared.document);
      }
      continue;
    }

    try {
      await guardedTablesDB.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLES.settings,
        rowId: prepared.document.id,
        data: toAppwriteFormat(
          prepared.document as unknown as Record<string, unknown>,
          'settings',
          userId
        ),
      });
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      const createConflict = await createRemoteSetting(
        prepared.document,
        userId
      );
      if (createConflict) {
        await mirrorProfileImageSetting(createConflict, userId);
        await cleanupPendingProfileImage(next, userId);
        conflicts.push(createConflict);
        continue;
      }
    }

    await finishSuccessfulPush(
      prepared.document,
      userId,
      prepared.pendingImageId
    );
    if (!settingStateEquals(prepared.document, next)) {
      conflicts.push(prepared.document);
    }
  }

  return conflicts;
}

async function pullSettings(
  userId: string,
  checkpoint: SettingsReplicationCheckpoint | undefined,
  batchSize: number
): Promise<{
  documents: ReplicatedSetting[];
  checkpoint: SettingsReplicationCheckpoint | undefined;
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
    tableId: APPWRITE_TABLES.settings,
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
    documents: rows.map(toReplicatedSetting),
    checkpoint: last
      ? {
          id: last.$id as string,
          updatedAt: last.$updatedAt as string,
        }
      : checkpoint,
  };
}

export async function captureSettingsReplicationPushCheckpoint(
  collection: RxCollection<SettingsDocument>
): Promise<SettingsReplicationPushCheckpoint | undefined> {
  let checkpoint: SettingsReplicationPushCheckpoint | undefined;

  for (;;) {
    const result = await getChangedDocumentsSince<
      SettingsDocument,
      SettingsReplicationPushCheckpoint
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

function subscribeToSettingsRealtime(
  userId: string,
  pullStream: Subject<
    RxReplicationPullStreamItem<
      SettingsDocument,
      SettingsReplicationCheckpoint
    >
  >
): RealtimeUnsubscribe {
  const channel =
    `databases.${APPWRITE_DATABASE_ID}.tables.${APPWRITE_TABLES.settings}.rows`;

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
      documents: [toReplicatedSetting(payload as Record<string, unknown>)],
    });
  });
}

export function isSettingsReplicationPilotActive(userId: string): boolean {
  return activeOwnerId === userId && activeReplication !== null;
}

export function resyncSettingsReplicationPilot(userId: string): boolean {
  if (!isSettingsReplicationPilotActive(userId)) return false;
  activeReplication?.reSync();
  return true;
}

export async function refreshSettingsReplicationPilot(
  userId: string,
  timeoutMs: number
): Promise<boolean> {
  if (
    !isSettingsReplicationPilotActive(userId) ||
    !activeReplication ||
    !activeCollection
  ) {
    return false;
  }
  await awaitPilotReplicationFreshness(
    'settings',
    activeReplication,
    activeCollection,
    timeoutMs
  );
  return true;
}

async function stopSettingsReplicationPilotNow(
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

async function startSettingsReplicationPilotNow(
  userId: string,
  collection: RxCollection<SettingsDocument>,
  initialPushCheckpoint: SettingsReplicationPushCheckpoint | undefined
): Promise<void> {
  if (!userId) return;
  if (isSettingsReplicationPilotActive(userId)) return;

  if (activeReplication) {
    await stopSettingsReplicationPilotNow();
  }

  const pullStream = new Subject<
    RxReplicationPullStreamItem<
      SettingsDocument,
      SettingsReplicationCheckpoint
    >
  >();

  const replication = replicateRxCollection<
    SettingsDocument,
    SettingsReplicationCheckpoint
  >({
    replicationIdentifier:
      getReplicationIdentifier('settings', userId),
    collection,
    live: true,
    retryTime: RETRY_TIME_MS,
    waitForLeadership: true,
    toggleOnDocumentVisible: true,
    pull: {
      batchSize: PULL_BATCH_SIZE,
      stream$: pullStream.asObservable(),
      handler: (checkpoint, batchSize) =>
        pullSettings(userId, checkpoint, batchSize),
    },
    push: {
      batchSize: PUSH_BATCH_SIZE,
      initialCheckpoint: initialPushCheckpoint,
      handler: (rows) => pushSettings(rows, userId),
    },
  });

  activeOwnerId = userId;
  activeReplication = replication;
  trackReplicationFreshness(replication, userId, 'settings');
  activeCollection = collection;
  activePullStream = pullStream;
  realtimeUnsubscribe = subscribeToSettingsRealtime(userId, pullStream);
  errorSubscription = replication.error$.subscribe((error) => {
    console.error('[SettingsReplicationPilot] replication error:', error);
  });
}

const runReplicationPilotLifecycle = createReplicationPilotLifecycleQueue();

export function stopSettingsReplicationPilot(
  ...args: Parameters<typeof stopSettingsReplicationPilotNow>
): ReturnType<typeof stopSettingsReplicationPilotNow> {
  return runReplicationPilotLifecycle(() => stopSettingsReplicationPilotNow(...args));
}

export function startSettingsReplicationPilot(
  ...args: Parameters<typeof startSettingsReplicationPilotNow>
): ReturnType<typeof startSettingsReplicationPilotNow> {
  return runReplicationPilotLifecycle(() => startSettingsReplicationPilotNow(...args));
}

export const __settingsReplicationPilotTestUtils = {
  pullSettings,
  pushSettings,
};
