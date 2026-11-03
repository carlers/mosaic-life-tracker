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
import { updateProfileAvatar, updateProfileDisplayName } from '../lib/social';
import { awaitPilotReplicationFreshness } from './replicationFreshness';
import { recordSyncPilotIssue, clearSyncPilotIssue } from '../lib/syncStatus';
import { ensureOversizedSettingsRowsMigrated } from '../lib/settingsLegacyCleanup';
import { getReplicationIdentifier } from './replicationIds';
import { trackReplicationFreshness } from './replicationLocalState';
import { readOwnerMaster, updateOwnerRowWithCas } from './ownerWriteCas';
import { isAppwriteCompatibleRowId } from '../lib/settingsRowId';
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

type SettingsFailureStage = 'profile' | 'friends' | 'read' | 'create' | 'update' | 'pull';
const failureStageLabels: Record<SettingsFailureStage, string> = {
  profile: 'Profile mirror',
  friends: 'Friend preference validation',
  read: 'Remote settings read',
  create: 'Remote settings create',
  update: 'Remote settings update',
  pull: 'Remote settings pull',
};

function identifySettingsFailure(stage: SettingsFailureStage, error: unknown): Error {
  const reason = error instanceof Error ? error.message : 'unknown error';
  return Object.assign(new Error(failureStageLabels[stage] + ' failed: ' + reason, { cause: error }), {
    syncStage: stage,
  });
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

async function readRemoteSettingMaster(
  rowId: string,
  userId: string
) {
  try {
    return await readOwnerMaster(
      APPWRITE_TABLES.settings,
      rowId,
      userId,
      toReplicatedSetting
    );
  } catch (error) {
    throw identifySettingsFailure('read', error);
  }
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
    let acceptedFriendIds: Set<string>;
    try {
      acceptedFriendIds = await loadAcceptedFriendIds(userId);
    } catch (error) {
      // Fail closed: never upload unvalidated friend references.
      throw identifySettingsFailure('friends', error);
    }
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

async function mirrorProfileSetting(
  document: ReplicatedSetting,
  userId: string
): Promise<void> {
  if (document.isDeleted || typeof document.value !== 'string' || !document.value.trim()) return;
  try {
    if (document.key === 'profileImageId') {
      await updateProfileAvatar(userId, document.value);
    } else if (document.key === 'displayName') {
      await updateProfileDisplayName(userId, document.value);
    }
  } catch (error) {
    // Keep the RxDB write pending so a failed profile side effect can retry.
    throw identifySettingsFailure('profile', error);
  }
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
  await mirrorProfileSetting(document, userId);
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
    if (!isConflictError(error)) throw identifySettingsFailure('create', error);
    const current = await readRemoteSetting(document.id, userId);
    if (current) return current;
    throw identifySettingsFailure('create', error);
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
      // Pre-hash legacy IDs could exceed Appwrite's length limit or contain
      // forbidden characters. These physical-deletion tombstones represent
      // impossible cloud rows and must not poison RxDB's push queue.
      // Valid remote-capable rows still require an isDeleted tombstone.
      if (!isAppwriteCompatibleRowId(next.id)) continue;
      throw new Error(
        `Settings replication cannot physically delete ${next.id}; use isDeleted tombstones`
      );
    }

    if (!isAppwriteCompatibleRowId(next.id)) {
      // Do not send a malformed local row to Appwrite; a fresh startup
      // migration must preserve its value under a supported ID first.
      throw new Error('Settings replication has an unsupported local row ID; migration required');
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
          await mirrorProfileSetting(createConflict, userId);
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
        await mirrorProfileSetting(current, userId);
        continue;
      }
      if (!isBootstrapLocalNewer(next.updatedAt, current.updatedAt)) {
        await mirrorProfileSetting(current, userId);
        await cleanupPendingProfileImage(next, userId);
        conflicts.push(current);
        continue;
      }
    } else if (current && !settingStateEquals(current, assumed)) {
      await mirrorProfileSetting(current, userId);
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
        await mirrorProfileSetting(createConflict, userId);
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
    const writeResult = await updateOwnerRowWithCas(
      'settings',
      prepared.document.id,
      userId,
      master.serverUpdatedAt,
      toAppwriteFormat(
        prepared.document as unknown as Record<string, unknown>,
        'settings',
        userId
      )
    ).catch((error: unknown) => { throw identifySettingsFailure('update', error); });
    if (writeResult.status === 'conflict') {
      const latest = toReplicatedSetting(writeResult.row);
      await mirrorProfileSetting(latest, userId);
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
        await mirrorProfileSetting(createConflict, userId);
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
  try {
    return await pullOwnerRowsByUpdatedAtId<ReplicatedSetting, SettingsReplicationCheckpoint>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLES.settings,
      userId,
      ownerLabel: 'Settings',
      checkpoint,
      batchSize,
      mapRow: toReplicatedSetting,
    });
  } catch (error) {
    throw identifySettingsFailure('pull', error);
  }
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
  clearSyncPilotIssue(userId, 'Preferences');
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

  // Migrate invalid legacy IDs before RxDB snapshots its push
  // checkpoint. Do not rely on a Preferences screen hook mounting first.
  await ensureOversizedSettingsRowsMigrated(userId);

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
  let recoveryProofInFlight = false;
  errorSubscription = replication.error$.subscribe((error) => {
    console.error('[SettingsReplicationPilot] replication error:', error);
    recordSyncPilotIssue(userId, 'Preferences', error);
    if (recoveryProofInFlight) return;
    recoveryProofInFlight = true;
    // Only remove the warning when RxDB proves the entire retry queue settled.
    void replication.awaitInSync().then(() => {
      if (activeReplication === replication && activeOwnerId === userId) {
        clearSyncPilotIssue(userId, 'Preferences');
      }
    }).catch(() => undefined).finally(() => {
      recoveryProofInFlight = false;
    });
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
