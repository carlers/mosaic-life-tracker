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
import type { SettingsDocument } from './schema';
import { guardedTablesDB, type RealtimeUnsubscribe } from '../lib/sdk';
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
import { assertRemoteRowOwnedBy } from './replicationOwnership';
import { readOwnerMaster, updateOwnerRowWithCas } from './ownerWriteCas';
import {
  loadAcceptedFriendIds,
  sanitizeFriendCarouselValue,
} from './socialReferenceSanitizer';

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

async function readRemoteSettingMaster(
  rowId: string,
  userId: string
) {
  return readOwnerMaster({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLES.settings,
    rowId,
    userId,
    ownerLabel: 'Settings',
    mapRow: toReplicatedSetting,
  });
}

async function readRemoteSetting(
  rowId: string,
  userId: string
): Promise<ReplicatedSetting | null> {
  const master = await readRemoteSettingMaster(rowId, userId);
  return master?.document ?? null;
}

async function prepareSettingForPush(
  document: ReplicatedSetting,
  userId: string
): Promise<{
  document: ReplicatedSetting;
  pendingImageId: string | null;
}> {
  if (
    document.key === 'friend_carousel_prefs' &&
    typeof document.value === 'string' &&
    !document.isDeleted
  ) {
    const acceptedFriendIds = await loadAcceptedFriendIds(userId);
    return {
      document: {
        ...document,
        value: sanitizeFriendCarouselValue(
          document.value,
          acceptedFriendIds
        ),
      },
      pendingImageId: null,
    };
  }

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
    const current = await readRemoteSetting(document.id, userId);
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
      // Mosaic intentionally keeps multiple owners in one local RxDB. A
      // per-user replication identifier will encounter those cached foreign
      // rows on first upstream scan; acknowledge them as outside this
      // replication scope instead of poisoning the active owner's queue.
      continue;
    }
    if (next._deleted) {
      throw new Error(
        `Settings replication cannot physically delete ${next.id}; use isDeleted tombstones`
      );
    }

    const master = await readRemoteSettingMaster(next.id, userId);
    const current = master?.document ?? null;
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

    if (!master) {
      throw new Error(
        `Settings replication master token missing for ${prepared.document.id}`
      );
    }
    const writeResult = await updateOwnerRowWithCas({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: 'settings',
      rowId: prepared.document.id,
      userId,
      expectedUpdatedAt: master.serverUpdatedAt,
      data: toAppwriteFormat(
        prepared.document as unknown as Record<string, unknown>,
        'settings',
        userId
      ),
    });
    if (writeResult.status === 'conflict') {
      assertRemoteRowOwnedBy(writeResult.row, userId, 'Settings');
      const latest = toReplicatedSetting(writeResult.row);
      await mirrorProfileImageSetting(latest, userId);
      await cleanupPendingProfileImage(next, userId);
      conflicts.push(latest);
      continue;
    }
    if (writeResult.status === 'missing') {
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
  return pullOwnerRowsByUpdatedAtId<ReplicatedSetting, SettingsReplicationCheckpoint>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLES.settings,
    userId,
    ownerLabel: 'Settings',
    checkpoint,
    batchSize,
    mapRow: toReplicatedSetting,
  });
}

export function captureSettingsReplicationPushCheckpoint(
  collection: RxCollection<SettingsDocument>
): Promise<SettingsReplicationPushCheckpoint | undefined> {
  return captureReplicationPushCheckpoint<SettingsDocument, SettingsReplicationPushCheckpoint>(
    collection,
    LOCAL_CHECKPOINT_BATCH_SIZE
  );
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
  return subscribeToOwnerRealtime({
    channel:
      `databases.${APPWRITE_DATABASE_ID}.tables.${APPWRITE_TABLES.settings}.rows`,
    userId,
    isActiveOwner: () => activeOwnerId === userId,
    pullStream,
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
