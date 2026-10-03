import { syncFriendships } from '../lib/friendshipSync';
import { getDatabase, type AppDatabaseCollections } from './database';
import { Permission, Role, Query } from 'appwrite';
import { isUnauthorizedError } from '../lib/authEvents';
import { guardedTablesDB } from '../lib/sdk';
import { toAppwriteFormat, fromAppwriteFormat } from '../lib/syncMapping';
import { updateProfileAvatar } from '../lib/social';
import {
  getSyncStatus,
  publishSyncStatus,
  type SyncStatus,
} from '../lib/syncStatus';
import { markOfflineDataReady } from '../lib/offlineReadiness';
import { isPendingImageId, deletePendingImage } from '../lib/pendingImages';
import { uploadPendingImage, makeProfileImageReadable } from '../lib/storage';
import { getConnectivitySnapshot } from '../lib/connectivity';
import {
  captureCategoryReplicationPushCheckpoint,
  isCategoryReplicationPilotActive,
  refreshCategoryReplicationPilot,
  resyncCategoryReplicationPilot,
  startCategoryReplicationPilot,
  stopCategoryReplicationPilot,
} from './categoryReplicationPilot';
import {
  captureDiaryReplicationPushCheckpoint,
  isDiaryReplicationPilotActive,
  refreshDiaryReplicationPilot,
  resyncDiaryReplicationPilot,
  startDiaryReplicationPilot,
  stopDiaryReplicationPilot,
} from './diaryReplicationPilot';
import {
  captureSettingsReplicationPushCheckpoint,
  isSettingsReplicationPilotActive,
  refreshSettingsReplicationPilot,
  resyncSettingsReplicationPilot,
  startSettingsReplicationPilot,
  stopSettingsReplicationPilot,
} from './settingsReplicationPilot';
import {
  captureFriendshipReplicationPushCheckpoint,
  isFriendshipReplicationPilotActive,
  refreshFriendshipReplicationPilot,
  resyncFriendshipReplicationPilot,
  startFriendshipReplicationPilot,
  stopFriendshipReplicationPilot,
} from './friendshipReplicationPilot';
import {
  captureTaskReplicationPushCheckpoint,
  isTaskReplicationPilotActive,
  refreshTaskReplicationPilot,
  resyncTaskReplicationPilot,
  startTaskReplicationPilot,
  stopTaskReplicationPilot,
} from './taskReplicationPilot';
import {
  captureMessageReplicationPullCheckpoint,
  captureMessageReplicationPushCheckpoint,
  isMessageReplicationPilotActive,
  refreshMessageReplicationPilot,
  resyncMessageReplicationPilot,
  startMessageReplicationPilot,
  stopMessageReplicationPilot,
} from './messageReplicationPilot';
import { APPWRITE_DATABASE_ID, APPWRITE_TABLES } from '../lib/appwriteConfig';
import {
  captureAccountWorkGeneration,
  isAccountWorkCurrent,
} from '../lib/accountWorkScope';
export { toAppwriteFormat, fromAppwriteFormat };
export { getSyncStatus, subscribeToSyncStatus } from '../lib/syncStatus';
const APPWRITE_CONFIG = {
  databaseId: APPWRITE_DATABASE_ID,
  tables: {
    tasks: APPWRITE_TABLES.tasks,
    categories: APPWRITE_TABLES.categories,
    diary: APPWRITE_TABLES.diary,
    settings: APPWRITE_TABLES.settings,
    friendships: APPWRITE_TABLES.friendships,
    messages: APPWRITE_TABLES.messages,
  },
} as const;
const DEBUG = import.meta.env.DEV;
const PAGE_SIZE = 100;
const MAX_PAGES_PER_COLLECTION = 100;
const PULL_OVERLAP_MS = 30_000;
const RATE_LIMIT_BASE_MS = 5_000;
const RATE_LIMIT_MAX_MS = 60_000;
const FAILURE_BACKOFF_BASE_MS = 5_000;
const FAILURE_BACKOFF_MAX_MS = 60_000;
const PUSH_CONCURRENCY = 4;
const SYNC_COORDINATOR_IDLE_TIMEOUT_MS = 90_000;
// Tombstones are retained remotely for this long. A client whose incremental
// pull cursor is older than the retention window performs a full pull so it
// never assumes that a missing row means the row still exists.
export const TOMBSTONE_RETENTION_DAYS = 90;
const TOMBSTONE_RETENTION_MS = TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const WEB_LOCKS_NAME = 'mosaic-sync';
type CollectionName = keyof AppDatabaseCollections;
const ALL_COLLECTIONS: CollectionName[] = [
  'tasks',
  'categories',
  'diary',
  'settings',
  'friendships',
  'messages',
];
interface PerCollectionSyncEntry {
  pull: string;
  dirty: string;
}
interface PerCollectionPersistedState {
  version: number;
  ownerId: string;
  entries: Partial<Record<CollectionName, PerCollectionSyncEntry>>;
}
interface BootstrapPushAcksState {
  version: number;
  ownerId: string;
  entries: Partial<Record<CollectionName, Record<string, number>>>;
}
const PER_COLLECTION_KEY = 'lastSyncTimePerCollection';
const RECONCILED_MISSING_KEY = 'reconciledMissingRows';
const BOOTSTRAP_PUSH_ACKS_KEY = 'bootstrapPushAcknowledgements';
const PER_COLLECTION_STATE_VERSION = 1;
const BOOTSTRAP_PUSH_ACKS_VERSION = 1;

function accountStorageKey(base: string, userId: string): string {
  return base + '_' + userId;
}

function parsePerCollectionState(
  raw: string | null,
  userId: string
): Partial<Record<CollectionName, PerCollectionSyncEntry>> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const state = parsed as Partial<PerCollectionPersistedState>;
    const version =
      typeof state.version === 'number'
        ? state.version
        : PER_COLLECTION_STATE_VERSION;
    if (version !== PER_COLLECTION_STATE_VERSION) return null;
    if (state.ownerId !== userId) return null;
    if (!state.entries || typeof state.entries !== 'object') return null;
    return state.entries as Partial<
      Record<CollectionName, PerCollectionSyncEntry>
    >;
  } catch {
    return null;
  }
}

function baselineFromLastSuccessfulSync(
  userId: string
): Partial<Record<CollectionName, PerCollectionSyncEntry>> | null {
  try {
    const lastSync = localStorage.getItem('lastSyncTime_' + userId);
    if (!lastSync || !Number.isFinite(Date.parse(lastSync))) return null;
    return Object.fromEntries(
      ALL_COLLECTIONS.map((collection) => [
        collection,
        { pull: lastSync, dirty: lastSync },
      ])
    ) as Record<CollectionName, PerCollectionSyncEntry>;
  } catch {
    return null;
  }
}

function loadPerCollectionState(
  userId: string
): Partial<Record<CollectionName, PerCollectionSyncEntry>> {
  try {
    const scoped = parsePerCollectionState(
      localStorage.getItem(accountStorageKey(PER_COLLECTION_KEY, userId)),
      userId
    );
    if (scoped) return scoped;

    const legacy = parsePerCollectionState(
      localStorage.getItem(PER_COLLECTION_KEY),
      userId
    );
    if (legacy) {
      savePerCollectionState(userId, legacy);
      return legacy;
    }

    // The account-scoped lastSync is written only after every collection
    // completes cleanly. It is therefore a safe fallback baseline when the
    // old single-owner compatibility blob was overwritten by another account.
    // Revisions newer than this timestamp remain dirty and eligible to push.
    const recovered = baselineFromLastSuccessfulSync(userId);
    if (recovered) {
      savePerCollectionState(userId, recovered);
      return recovered;
    }
  } catch {
  }

  // With no successful baseline (for example first-ever offline use), keep
  // the offline-first behavior and preserve potentially unsynced local rows.
  return {};
}

function savePerCollectionState(
  userId: string,
  entries: Partial<Record<CollectionName, PerCollectionSyncEntry>>
): void {
  try {
    const state: PerCollectionPersistedState = {
      version: PER_COLLECTION_STATE_VERSION,
      ownerId: userId,
      entries,
    };
    localStorage.setItem(
      accountStorageKey(PER_COLLECTION_KEY, userId),
      JSON.stringify(state)
    );
  } catch {
  }
}

function parseReconciledMissingState(
  raw: string | null,
  userId: string
): Record<string, string> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const state = parsed as {
      version?: number;
      ownerId?: string;
      entries?: Record<string, string>;
    };
    if (state.version !== 1 || state.ownerId !== userId || !state.entries) {
      return null;
    }
    return state.entries;
  } catch {
    return null;
  }
}

function loadReconciledMissingRows(
  userId: string
): Record<string, string> {
  try {
    const scoped = parseReconciledMissingState(
      localStorage.getItem(accountStorageKey(RECONCILED_MISSING_KEY, userId)),
      userId
    );
    if (scoped) return scoped;

    const legacy = parseReconciledMissingState(
      localStorage.getItem(RECONCILED_MISSING_KEY),
      userId
    );
    if (legacy) {
      saveReconciledMissingRows(userId, legacy);
      return legacy;
    }
  } catch {
  }
  return {};
}

function saveReconciledMissingRows(
  userId: string,
  entries: Record<string, string>
): void {
  try {
    localStorage.setItem(
      accountStorageKey(RECONCILED_MISSING_KEY, userId),
      JSON.stringify({ version: 1, ownerId: userId, entries })
    );
  } catch {
  }
}

function reconciliationKey(collection: string, rowId: string): string {
  return collection + '::' + rowId;
}

function parseBootstrapPushAcks(
  raw: string | null,
  userId: string
): Partial<Record<CollectionName, Record<string, number>>> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BootstrapPushAcksState>;
    if (
      parsed.version !== BOOTSTRAP_PUSH_ACKS_VERSION ||
      parsed.ownerId !== userId ||
      !parsed.entries ||
      typeof parsed.entries !== 'object'
    ) {
      return null;
    }
    return parsed.entries;
  } catch {
    return null;
  }
}

function loadBootstrapPushAcks(
  userId: string
): Partial<Record<CollectionName, Record<string, number>>> {
  try {
    const scoped = parseBootstrapPushAcks(
      localStorage.getItem(accountStorageKey(BOOTSTRAP_PUSH_ACKS_KEY, userId)),
      userId
    );
    if (scoped) return scoped;

    const legacy = parseBootstrapPushAcks(
      localStorage.getItem(BOOTSTRAP_PUSH_ACKS_KEY),
      userId
    );
    if (legacy) {
      saveBootstrapPushAcks(userId, legacy);
      return legacy;
    }
  } catch {
  }
  return {};
}

function saveBootstrapPushAcks(
  userId: string,
  entries: Partial<Record<CollectionName, Record<string, number>>>
): void {
  try {
    localStorage.setItem(
      accountStorageKey(BOOTSTRAP_PUSH_ACKS_KEY, userId),
      JSON.stringify({
        version: BOOTSTRAP_PUSH_ACKS_VERSION,
        ownerId: userId,
        entries,
      })
    );
  } catch {
    // Retry safety remains conservative if persistence is unavailable:
    // a previously successful row may be sent again, but no write is lost.
  }
}

let perCollectionSync: Partial<
  Record<CollectionName, PerCollectionSyncEntry>
> = {};
let perCollectionOwnerId: string | null = null;
class SyncOwnerChangedError extends Error {
  constructor() {
    super('Account changed during sync.');
    this.name = 'SyncOwnerChangedError';
  }
}

function assertSyncOwnerCurrent(
  userId: string,
  generation: number
): void {
  if (!isAccountWorkCurrent(userId, generation)) {
    throw new SyncOwnerChangedError();
  }
}

function updateSyncStatus(
  updates: Partial<SyncStatus>,
  ownerGuard?: { userId: string; generation: number }
) {
  if (
    ownerGuard &&
    !isAccountWorkCurrent(ownerGuard.userId, ownerGuard.generation)
  ) {
    return getSyncStatus();
  }
  const next = publishSyncStatus(updates);
  const persistenceOwnerId = ownerGuard?.userId ?? perCollectionOwnerId;
  if (next.lastSync && persistenceOwnerId) {
    try {
      localStorage.setItem(
        `lastSyncTime_${persistenceOwnerId}`,
        next.lastSync
      );
    } catch {
      // Sync status persistence is best-effort.
    }
  }
  if (DEBUG) console.log('[Sync] Status:', next);
  return next;
}
type AppwriteRow = Record<string, unknown>;
interface CollectionSyncResult {
  pullRowFailed: boolean;
  pushFailed: number;
  pushDeferred: number;
  pullComplete: boolean;
  errors: unknown[];
}
type LocalDoc = {
  id: string;
  _meta?: { lwt?: number };
  toJSON: () => Record<string, unknown>;
  incrementalPatch: (updates: Record<string, unknown>) => Promise<unknown>;
};
type LocalCollection = {
  findOne: (id: string) => { exec: () => Promise<LocalDoc | null> };
  find: () => { exec: () => Promise<LocalDoc[]> };
  upsert: (doc: Record<string, unknown>) => Promise<unknown>;
};
let isSyncInProgress = false;
let isSyncCycleQueued = false;
let syncRequestedDuringFlight = false;
let queuedSyncUserId: string | null = null;
let backoffOwnerId: string | null = null;
let rateLimitUntil = 0;
let rateLimitBackoffMs = 0;
let failureBackoffUntil = 0;
let failureBackoffMs = 0;
let backoffWakeTimer: ReturnType<typeof setTimeout> | null = null;
let backoffWakeAt = 0;
let backoffWakeUserId: string | null = null;

function clearBackoffWakeTimer(): void {
  if (backoffWakeTimer !== null) {
    clearTimeout(backoffWakeTimer);
  }
  backoffWakeTimer = null;
  backoffWakeAt = 0;
  backoffWakeUserId = null;
}

function scheduleBackoffWake(
  userId: string,
  wakeAt: number,
  generation = captureAccountWorkGeneration(userId)
): void {
  if (
    !userId ||
    generation === null ||
    !isAccountWorkCurrent(userId, generation) ||
    wakeAt <= Date.now()
  ) {
    return;
  }
  if (backoffWakeUserId === userId && backoffWakeAt === wakeAt) return;

  clearBackoffWakeTimer();
  backoffWakeUserId = userId;
  backoffWakeAt = wakeAt;
  backoffWakeTimer = globalThis.setTimeout(() => {
    backoffWakeTimer = null;
    backoffWakeAt = 0;
    backoffWakeUserId = null;
    if (!isAccountWorkCurrent(userId, generation)) return;
    void initializeSync(userId).catch((error) => {
      console.error('[Sync] Scheduled retry failed:', error);
    });
  }, Math.max(0, wakeAt - Date.now()) + 10);
}

function isTimestampedCollection(collection: string): boolean {
  return (
    collection === 'tasks' ||
    collection === 'categories' ||
    collection === 'diary' ||
    collection === 'settings' ||
    collection === 'friendships' ||
    collection === 'messages'
  );
}
function isRateLimitError(err: unknown): boolean {
  const code = (err as { code?: number } | null)?.code;
  if (code === 429) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /rate limit/i.test(msg);
}
function isNotFoundError(err: unknown): boolean {
  const code = (err as { code?: number } | null)?.code;
  return code === 404;
}
function isConflictError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === 'CONFLICT';
}

function describeSyncError(err: unknown): string {
  if (isRateLimitError(err)) return 'rate limited';
  if (isUnauthorizedError(err)) return 'authorization failed';
  const code = (err as { code?: number } | null)?.code;
  if (typeof code === 'number' && code >= 500) {
    return `server error ${code}`;
  }
  if (typeof code === 'number' && code >= 400) {
    return `request rejected ${code}`;
  }
  const message = err instanceof Error ? err.message : String(err);
  if (/network|fetch|timeout|offline/i.test(message)) return 'network error';
  return 'unexpected error';
}

function buildRowPermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}
function toMs(value: unknown): number {
  if (typeof value !== 'string' || !value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function allReplicationPilotsActive(userId: string): boolean {
  return (
    isTaskReplicationPilotActive(userId) &&
    isCategoryReplicationPilotActive(userId) &&
    isDiaryReplicationPilotActive(userId) &&
    isSettingsReplicationPilotActive(userId) &&
    isFriendshipReplicationPilotActive(userId) &&
    isMessageReplicationPilotActive(userId)
  );
}

function resyncAllReplicationPilots(userId: string): void {
  resyncTaskReplicationPilot(userId);
  resyncCategoryReplicationPilot(userId);
  resyncDiaryReplicationPilot(userId);
  resyncSettingsReplicationPilot(userId);
  resyncFriendshipReplicationPilot(userId);
  resyncMessageReplicationPilot(userId);
}

async function stopAllReplicationPilots(userId?: string): Promise<void> {
  await Promise.allSettled([
    stopTaskReplicationPilot(userId),
    stopCategoryReplicationPilot(userId),
    stopDiaryReplicationPilot(userId),
    stopSettingsReplicationPilot(userId),
    stopFriendshipReplicationPilot(userId),
    stopMessageReplicationPilot(userId),
  ]);
}

export async function suspendSyncOwner(userId?: string): Promise<void> {
  clearBackoffWakeTimer();
  if (!userId || backoffOwnerId === userId) {
    backoffOwnerId = null;
    rateLimitUntil = 0;
    rateLimitBackoffMs = 0;
    failureBackoffUntil = 0;
    failureBackoffMs = 0;
  }
  if (!userId || queuedSyncUserId === userId) {
    queuedSyncUserId = null;
    syncRequestedDuringFlight = false;
  }
  await stopAllReplicationPilots(userId);
}

async function runBounded<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
  shouldStop: () => boolean = () => false
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = [];
  let cursor = 0;

  const runWorker = async () => {
    while (true) {
      if (shouldStop()) return;
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results.push(await worker(items[index]));
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, limit), items.length) },
      () => runWorker()
    )
  );
  return results;
}

async function waitForSyncCoordinatorIdle(
  timeoutMs = SYNC_COORDINATOR_IDLE_TIMEOUT_MS
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (isSyncInProgress || isSyncCycleQueued || syncRequestedDuringFlight) {
    if (Date.now() >= deadline) {
      throw new Error(
        'Mosaic sync is still busy. Close other Mosaic tabs or wait for sync to finish, then try again.'
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

export interface FreshSyncResult {
  status: SyncStatus;
  startedAt: number;
}

/**
 * Callers that must observe a genuinely fresh server snapshot (for example
 * destructive/import restore preflight) cannot treat initializeSync() as an
 * awaitable freshness barrier: initializeSync intentionally coalesces
 * same-tab re-entry and returns immediately while a cycle is in flight.
 *
 * Drain the coordinator first, then start and await one new cycle. Cross-tab
 * Web Locks still serialize the new cycle behind any other tab.
 */
export async function refreshSync(
  userId: string,
  timeoutMs = SYNC_COORDINATOR_IDLE_TIMEOUT_MS
): Promise<FreshSyncResult> {
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null) {
    throw new Error('Fresh sync requires the currently authenticated account.');
  }

  const deadline = Date.now() + timeoutMs;
  await waitForSyncCoordinatorIdle(timeoutMs);
  assertSyncOwnerCurrent(userId, generation);
  const startedAt = Date.now();

  const remaining = () => {
    const value = deadline - Date.now();
    if (value <= 0) {
      throw new Error(
        'Mosaic fresh sync timed out. Close other Mosaic tabs or check your connection, then try again.'
      );
    }
    return value;
  };

  try {
    await initializeSync(userId, { deadline });
    assertSyncOwnerCurrent(userId, generation);

    const bootstrapErrors = getSyncStatus().errors;
    if (bootstrapErrors.length > 0) {
      throw new Error(
        'Fresh sync bootstrap failed: ' + bootstrapErrors.join('; ')
      );
    }
    if (!allReplicationPilotsActive(userId)) {
      throw new Error(
        'Fresh sync could not activate every replication collection.'
      );
    }

    updateSyncStatus(
      { isSyncing: true },
      { userId, generation }
    );

    const refreshes: Array<
      [string, (timeout: number) => Promise<boolean>]
    > = [
      [
        'category',
        (timeout) => refreshCategoryReplicationPilot(userId, timeout),
      ],
      ['diary', (timeout) => refreshDiaryReplicationPilot(userId, timeout)],
      [
        'settings',
        (timeout) => refreshSettingsReplicationPilot(userId, timeout),
      ],
      [
        'friendship',
        (timeout) => refreshFriendshipReplicationPilot(userId, timeout),
      ],
      ['task', (timeout) => refreshTaskReplicationPilot(userId, timeout)],
      ['message', (timeout) => refreshMessageReplicationPilot(userId, timeout)],
    ];

    for (const [name, refresh] of refreshes) {
      assertSyncOwnerCurrent(userId, generation);
      const refreshed = await refresh(remaining());
      if (!refreshed) {
        throw new Error(
          'Fresh ' + name + ' sync is not active for the current account.'
        );
      }
    }

    assertSyncOwnerCurrent(userId, generation);
    const completedAt = new Date().toISOString();
    updateSyncStatus(
      {
        isSyncing: false,
        lastSync: completedAt,
        errors: [],
      },
      { userId, generation }
    );
    markOfflineDataReady(userId, completedAt);
    return { status: getSyncStatus(), startedAt };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Fresh RxDB sync failed';
    updateSyncStatus(
      {
        isSyncing: false,
        errors: [...getSyncStatus().errors, message],
      },
      { userId, generation }
    );
    throw error;
  }
}

/**
 * User-invoked sync is a real freshness request, unlike ordinary coalescing
 * triggers. Drain the same-tab coordinator first. A transient failure backoff
 * may be retried immediately by explicit user intent, while Appwrite 429
 * backoff remains protected and wakes itself when the server window expires.
 */
export async function syncNow(
  userId: string,
  timeoutMs = SYNC_COORDINATOR_IDLE_TIMEOUT_MS
): Promise<FreshSyncResult> {
  await waitForSyncCoordinatorIdle(timeoutMs);

  if (allReplicationPilotsActive(userId)) {
    return refreshSync(userId, timeoutMs);
  }

  if (backoffOwnerId === userId && Date.now() < rateLimitUntil) {
    scheduleBackoffWake(userId, rateLimitUntil);
    return { status: getSyncStatus(), startedAt: Date.now() };
  }

  if (backoffOwnerId === userId && Date.now() < failureBackoffUntil) {
    failureBackoffUntil = 0;
    failureBackoffMs = 0;
    clearBackoffWakeTimer();
  }

  const startedAt = Date.now();
  await initializeSync(userId);
  return { status: getSyncStatus(), startedAt };
}

async function resolvePendingImageForPush(
  doc: LocalDoc,
  json: Record<string, unknown>,
  collection: string,
  userId: string
): Promise<Record<string, unknown>> {
  const field =
    collection === 'tasks'
      ? 'image'
      : collection === 'settings' && json.key === 'profileImageId'
        ? 'value'
        : null;
  if (!field) return json;

  const pendingId = typeof json[field] === 'string' ? (json[field] as string) : '';
  if (!pendingId || !isPendingImageId(pendingId)) return json;

  if (json.isDeleted === true) {
    await doc.incrementalPatch({ [field]: '' });
    await deletePendingImage(pendingId, userId);
    return { ...json, [field]: '' };
  }

  const remoteFileId = await uploadPendingImage(pendingId, userId);
  if (collection === 'settings' && json.key === 'profileImageId') await makeProfileImageReadable(remoteFileId, userId);
  await doc.incrementalPatch({ [field]: remoteFileId });
  await deletePendingImage(pendingId, userId);
  return { ...json, [field]: remoteFileId };
}
export async function initializeSync(
  userId: string,
  options: { deadline?: number } = {}
): Promise<void> {
  if (!userId) return;
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null) return;

  if (allReplicationPilotsActive(userId)) {
    if (isAccountWorkCurrent(userId, generation)) {
      resyncAllReplicationPilots(userId);
    }
    return;
  }

  if (backoffOwnerId !== userId) {
    backoffOwnerId = userId;
    rateLimitUntil = 0;
    rateLimitBackoffMs = 0;
    failureBackoffUntil = 0;
    failureBackoffMs = 0;
    clearBackoffWakeTimer();
  }

  if (isSyncInProgress || isSyncCycleQueued) {
    if (DEBUG) {
      console.log(
        '[Sync] initializeSync requested while in-flight; queueing follow-up'
      );
    }
    syncRequestedDuringFlight = true;
    queuedSyncUserId = userId;
    return;
  }

  if (Date.now() < rateLimitUntil) {
    if (DEBUG) {
      console.log(
        '[Sync] Skipping: rate-limit backoff until ' +
          new Date(rateLimitUntil).toISOString()
      );
    }
    scheduleBackoffWake(userId, rateLimitUntil, generation);
    updateSyncStatus(
      { isSyncing: false },
      { userId, generation }
    );
    return;
  }

  if (Date.now() < failureBackoffUntil) {
    if (DEBUG) {
      console.log(
        '[Sync] Skipping: failure backoff until ' +
          new Date(failureBackoffUntil).toISOString()
      );
    }
    scheduleBackoffWake(userId, failureBackoffUntil, generation);
    updateSyncStatus(
      { isSyncing: false },
      { userId, generation }
    );
    return;
  }

  if (getConnectivitySnapshot().status !== 'online') {
    if (DEBUG) console.log('[Sync] Reachability not confirmed, skipping sync');
    updateSyncStatus(
      { isSyncing: false },
      { userId, generation }
    );
    return;
  }

  const runCycle = async () => {
    if (!isAccountWorkCurrent(userId, generation)) return;
    await runSyncCycleBody(userId, generation);
  };

  isSyncCycleQueued = true;
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.locks &&
      typeof navigator.locks.request === 'function'
    ) {
      let abortController: AbortController | null = null;
      let abortTimer: ReturnType<typeof setTimeout> | null = null;
      try {
        if (options.deadline !== undefined) {
          const lockWaitMs = options.deadline - Date.now();
          if (lockWaitMs <= 0) {
            throw new Error(
              'Mosaic fresh sync timed out while waiting for the sync lock.'
            );
          }
          abortController = new AbortController();
          abortTimer = globalThis.setTimeout(
            () => abortController?.abort(),
            lockWaitMs
          );
          await navigator.locks.request(
            WEB_LOCKS_NAME,
            { signal: abortController.signal },
            runCycle
          );
        } else {
          await navigator.locks.request(WEB_LOCKS_NAME, runCycle);
        }
      } catch (lockErr) {
        if (abortController?.signal.aborted) {
          throw new Error(
            'Mosaic fresh sync timed out while waiting for another Mosaic tab.'
          );
        }
        console.warn('[Sync] Web Locks request failed:', lockErr);
        throw lockErr;
      } finally {
        if (abortTimer !== null) clearTimeout(abortTimer);
      }
    } else {
      await runCycle();
    }
  } finally {
    isSyncCycleQueued = false;
    if (syncRequestedDuringFlight) {
      syncRequestedDuringFlight = false;
      const nextUserId = queuedSyncUserId ?? userId;
      queuedSyncUserId = null;
      if (DEBUG) console.log('[Sync] Running queued follow-up sync');
      queueMicrotask(() => {
        initializeSync(nextUserId).catch((err) => {
          console.error('[Sync] Queued follow-up sync failed:', err);
        });
      });
    }
  }
}
async function runSyncCycleBody(
  userId: string,
  generation: number
): Promise<void> {
  assertSyncOwnerCurrent(userId, generation);
  isSyncInProgress = true;
  if (DEBUG) console.log('[Sync] Starting sync...');
  updateSyncStatus(
    { isSyncing: true, errors: [] },
    { userId, generation }
  );
  try {
    // Unconditional reload: another tab may have written a newer per-
    // collection state since this tab last loaded it. The cross-tab lock
    // guarantees mutual exclusion, not that our in-memory copy is
    // current. Reloading here means the pull/push boundaries reflect the
    // last writer across all tabs.
    assertSyncOwnerCurrent(userId, generation);
    perCollectionSync = loadPerCollectionState(userId);
    perCollectionOwnerId = userId;
    let scopedLast: string | null = null;
    try {
      scopedLast = localStorage.getItem(`lastSyncTime_${userId}`);
    } catch {
    }
    if (isAccountWorkCurrent(userId, generation)) {
      publishSyncStatus({ lastSync: scopedLast });
    }
    if (DEBUG) {
      console.log(
        `[Sync] Loaded per-collection state for user ${userId}:`,
        Object.keys(perCollectionSync)
      );
    }
    const db = getDatabase();
    const collectionErrors: string[] = [];
    let sawRateLimit = false;
    let sawUnauthorized = false;
    let sawNonRateLimitFailure = false;
    for (const colName of ALL_COLLECTIONS) {
      assertSyncOwnerCurrent(userId, generation);
      try {
        if (
          colName === 'categories' &&
          isCategoryReplicationPilotActive(userId)
        ) {
          resyncCategoryReplicationPilot(userId);
          continue;
        }
        if (
          colName === 'diary' &&
          isDiaryReplicationPilotActive(userId)
        ) {
          resyncDiaryReplicationPilot(userId);
          continue;
        }

        if (
          colName === 'settings' &&
          isSettingsReplicationPilotActive(userId)
        ) {
          resyncSettingsReplicationPilot(userId);
          continue;
        }

        if (
          colName === 'tasks' &&
          isTaskReplicationPilotActive(userId)
        ) {
          resyncTaskReplicationPilot(userId);
          continue;
        }

        if (
          colName === 'friendships' &&
          isFriendshipReplicationPilotActive(userId)
        ) {
          resyncFriendshipReplicationPilot(userId);
          continue;
        }

        if (
          colName === 'messages' &&
          isMessageReplicationPilotActive(userId)
        ) {
          resyncMessageReplicationPilot(userId);
          continue;
        }

        const taskPushCheckpoint =
          colName === 'tasks'
            ? await captureTaskReplicationPushCheckpoint(db.tasks)
            : undefined;
        const categoryPushCheckpoint =
          colName === 'categories'
            ? await captureCategoryReplicationPushCheckpoint(db.categories)
            : undefined;
        const diaryPushCheckpoint =
          colName === 'diary'
            ? await captureDiaryReplicationPushCheckpoint(db.diary)
            : undefined;
        const settingsPushCheckpoint =
          colName === 'settings'
            ? await captureSettingsReplicationPushCheckpoint(db.settings)
            : undefined;
        const friendshipPushCheckpoint =
          colName === 'friendships'
            ? await captureFriendshipReplicationPushCheckpoint(db.friendships)
            : undefined;
        const messagePushCheckpoint =
          colName === 'messages'
            ? await captureMessageReplicationPushCheckpoint(db.messages)
            : undefined;
        const messagePullCheckpoint =
          colName === 'messages'
            ? await captureMessageReplicationPullCheckpoint(userId)
            : undefined;
        const result = await syncCollection(
          db[colName] as unknown as LocalCollection,
          colName,
          userId,
          generation,
          colName === 'messages'
        );
        assertSyncOwnerCurrent(userId, generation);

        const hasCollectionIssues =
          result.pullRowFailed ||
          result.pushFailed > 0 ||
          result.pushDeferred > 0 ||
          !result.pullComplete;
        if (hasCollectionIssues) {
          const issueParts: string[] = [];
          if (result.pullRowFailed) issueParts.push('pull row failed');
          if (result.pushFailed > 0 || result.pushDeferred > 0) {
            const reasons = [
              ...new Set(result.errors.map((error) => describeSyncError(error))),
            ];
            const reasonSuffix =
              reasons.length > 0 ? ` (${reasons.join(', ')})` : '';
            const failedPart =
              result.pushFailed > 0
                ? `${result.pushFailed} failed`
                : '0 failed';
            const deferredPart =
              result.pushDeferred > 0
                ? `, ${result.pushDeferred} deferred`
                : '';
            issueParts.push(
              `push/reconciliation: ${failedPart}${deferredPart}${reasonSuffix}`
            );
          }
          if (!result.pullComplete) issueParts.push('pull incomplete');
          collectionErrors.push(`${colName}: ${issueParts.join(', ')}`);

          let classifiedError = false;
          for (const rowError of result.errors) {
            classifiedError = true;
            if (isRateLimitError(rowError)) {
              sawRateLimit = true;
            } else if (isUnauthorizedError(rowError)) {
              sawUnauthorized = true;
            } else {
              sawNonRateLimitFailure = true;
            }
          }
          if (!classifiedError || !result.pullComplete) {
            sawNonRateLimitFailure = true;
          }
          continue;
        }

        if (colName === 'tasks') {
          assertSyncOwnerCurrent(userId, generation);
          await startTaskReplicationPilot(
            userId,
            db.tasks,
            taskPushCheckpoint
          );
        } else if (colName === 'categories') {
          // Only a completely clean legacy bootstrap may establish RxDB's
          // initial upstream baseline. The seed was captured before the
          // bootstrap so edits made while it was running remain newer than
          // the checkpoint and cannot be skipped by the handoff.
          assertSyncOwnerCurrent(userId, generation);
          await startCategoryReplicationPilot(
            userId,
            db.categories,
            categoryPushCheckpoint
          );
        } else if (colName === 'diary') {
          assertSyncOwnerCurrent(userId, generation);
          await startDiaryReplicationPilot(
            userId,
            db.diary,
            diaryPushCheckpoint
          );
        } else if (colName === 'settings') {
          assertSyncOwnerCurrent(userId, generation);
          await startSettingsReplicationPilot(
            userId,
            db.settings,
            settingsPushCheckpoint
          );
        } else if (colName === 'friendships') {
          assertSyncOwnerCurrent(userId, generation);
          await startFriendshipReplicationPilot(
            userId,
            db.friendships,
            friendshipPushCheckpoint
          );
        } else if (colName === 'messages') {
          assertSyncOwnerCurrent(userId, generation);
          await startMessageReplicationPilot(
            userId,
            db.messages,
            messagePushCheckpoint,
            messagePullCheckpoint
          );
        }
      } catch (colError) {
        if (colError instanceof SyncOwnerChangedError) {
          await stopAllReplicationPilots(userId);
          return;
        }
        const message =
          colError instanceof Error
            ? colError.message
            : `Unknown error in ${colName}`;
        console.error(`[Sync] Collection "${colName}" failed:`, colError);
        collectionErrors.push(`${colName}: ${message}`);
        if (isRateLimitError(colError)) {
          sawRateLimit = true;
        } else if (isUnauthorizedError(colError)) {
          sawUnauthorized = true;
        } else {
          sawNonRateLimitFailure = true;
        }
      }
    }
    assertSyncOwnerCurrent(userId, generation);
    if (sawUnauthorized) {
      clearBackoffWakeTimer();
      updateSyncStatus(
        { isSyncing: false, errors: collectionErrors },
        { userId, generation }
      );
      return;
    }
    if (sawRateLimit) {
      rateLimitBackoffMs =
        rateLimitBackoffMs === 0
          ? RATE_LIMIT_BASE_MS
          : Math.min(rateLimitBackoffMs * 2, RATE_LIMIT_MAX_MS);
      rateLimitUntil = Date.now() + rateLimitBackoffMs;
      console.warn(
        `[Sync] Rate limited; backing off for ${rateLimitBackoffMs}ms`
      );
    } else {
      rateLimitBackoffMs = 0;
      rateLimitUntil = 0;
    }
    if (sawNonRateLimitFailure && !sawRateLimit) {
      failureBackoffMs =
        failureBackoffMs === 0
          ? FAILURE_BACKOFF_BASE_MS
          : Math.min(failureBackoffMs * 2, FAILURE_BACKOFF_MAX_MS);
      failureBackoffUntil = Date.now() + failureBackoffMs;
      console.warn(
        `[Sync] Backing off after non-429 failures for ${failureBackoffMs}ms`
      );
    } else if (!sawNonRateLimitFailure) {
      failureBackoffMs = 0;
      failureBackoffUntil = 0;
    }

    const wakeAt = Math.max(rateLimitUntil, failureBackoffUntil);
    if (wakeAt > Date.now()) {
      scheduleBackoffWake(userId, wakeAt, generation);
    } else {
      clearBackoffWakeTimer();
    }

    if (collectionErrors.length === 0) {
      const completedAt = new Date().toISOString();
      updateSyncStatus(
        {
          isSyncing: false,
          lastSync: completedAt,
          errors: [],
        },
        { userId, generation }
      );
      markOfflineDataReady(userId, completedAt);
      if (DEBUG) console.log('[Sync] ✅ Sync complete');
    } else {
      updateSyncStatus(
        { isSyncing: false, errors: collectionErrors },
        { userId, generation }
      );
      if (DEBUG)
        console.warn('[Sync] ⚠️ Sync completed with errors:', collectionErrors);
    }
  } catch (error) {
    if (error instanceof SyncOwnerChangedError) {
      await stopAllReplicationPilots(userId);
    } else {
      console.error('[Sync] ❌ Sync failed', error);
      updateSyncStatus(
        {
          isSyncing: false,
          errors: [
            ...getSyncStatus().errors,
            error instanceof Error ? error.message : 'Unknown error',
          ],
        },
        { userId, generation }
      );
    }
  } finally {
    isSyncInProgress = false;
  }
}
async function syncCollection(
  collection: LocalCollection,
  colName: string,
  userId: string,
  generation: number,
  forceFullPull = false
): Promise<CollectionSyncResult> {
  assertSyncOwnerCurrent(userId, generation);
  if (colName === 'friendships') {
    assertSyncOwnerCurrent(userId, generation);
    await syncFriendships(userId);
    assertSyncOwnerCurrent(userId, generation);
    return {
      pullRowFailed: false,
      pushFailed: 0,
      pushDeferred: 0,
      pullComplete: true,
      errors: [],
    };
  }
  const cycleStartMs = Date.now();
  const tableId =
    APPWRITE_CONFIG.tables[colName as keyof typeof APPWRITE_CONFIG.tables];
  if (DEBUG) console.log(`[Sync] Syncing ${colName}...`);
  const entry = perCollectionSync[colName as CollectionName];
  const pullBoundaryMs = entry?.pull ? new Date(entry.pull).getTime() : 0;
  const dirtyBoundaryMs = entry?.dirty ? new Date(entry.dirty).getTime() : 0;
  const incrementalCursorExpired =
    pullBoundaryMs > 0 && Date.now() - pullBoundaryMs > TOMBSTONE_RETENTION_MS;
  const effectivePullBoundaryMs =
    forceFullPull || incrementalCursorExpired ? 0 : pullBoundaryMs;
  if (incrementalCursorExpired && DEBUG) {
    console.log(
      `[Sync] ${colName} incremental cursor expired; performing full pull`
    );
  }
  const usesTimestamps = isTimestampedCollection(colName);
  const remoteIndex = new Map<
    string,
    { updatedAt: number; isDeleted: boolean }
  >();
  const justPulled = new Set<string>();
  const reconciledMissing = loadReconciledMissingRows(userId);
  const bootstrapPushAcks = loadBootstrapPushAcks(userId);
  const collectionPushAcks =
    bootstrapPushAcks[colName as CollectionName] ?? {};
  bootstrapPushAcks[colName as CollectionName] = collectionPushAcks;
  let cursor: string | undefined = undefined;
  let pageCount = 0;
  let pullRowFailed = false;
  let pullComplete = true;
  const collectionErrors: unknown[] = [];
  for (;;) {
    assertSyncOwnerCurrent(userId, generation);
    const queries: unknown[] = [
      Query.equal('user_id', userId),
      Query.limit(PAGE_SIZE),
      Query.orderAsc('$id'),
    ];
    if (effectivePullBoundaryMs > 0) {
      const sinceIso = new Date(
        effectivePullBoundaryMs - PULL_OVERLAP_MS
      ).toISOString();
      queries.push(Query.greaterThan('$updatedAt', sinceIso));
    }
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const remoteResponse = await guardedTablesDB.listRows({
      databaseId: APPWRITE_CONFIG.databaseId,
      tableId,
      queries: queries as never,
      total: false,
    });
    assertSyncOwnerCurrent(userId, generation);
    const rows = ((remoteResponse as { rows?: AppwriteRow[] }).rows ||
      []) as AppwriteRow[];
    pageCount++;
    if (DEBUG)
      console.log(`[Sync] ${colName} page ${pageCount}: ${rows.length} rows`);
    if (rows.length === 0) break;
    for (const row of rows) {
      try {
        const doc = fromAppwriteFormat(row, colName);
        const docId = doc.id as string;
        if (!docId) continue;
        const remoteUpdatedAt = toMs(row.$updatedAt);
        remoteIndex.set(docId, {
          updatedAt: remoteUpdatedAt,
          isDeleted: (doc.isDeleted as boolean) ?? false,
        });
        if (incrementalCursorExpired && pullComplete && !pullRowFailed) {
          delete reconciledMissing[reconciliationKey(colName, docId)];
        }
        const localDoc = await collection.findOne(docId).exec();
        if (!localDoc) {
          // Local doc did not exist when we looked. RxDB may raise
          // CONFLICT if a local insert landed in the meantime; treat that
          // as a preserved local edit (docs/PROJECT_REFERENCE.md §10 — CONFLICT is not an
          // error) rather than a row failure.
          try {
            await collection.upsert(doc);
            justPulled.add(docId);
          } catch (upsertErr) {
            if (isConflictError(upsertErr)) {
              if (DEBUG) {
                console.log(
                  `[Sync] Pull insert CONFLICT for ${colName} ${docId}; preserving local`
                );
              }
            } else {
              throw upsertErr;
            }
          }
          continue;
        }
        const localLwt = localDoc._meta?.lwt ?? 0;
        const acknowledgedLwt = collectionPushAcks[docId];
        // A revision that already reached Appwrite during an earlier partial
        // bootstrap is no longer locally dirty for pull arbitration. This
        // lets a genuinely newer remote edit win on retry while the persisted
        // acknowledgement still prevents replaying the already-sent revision.
        const isLocalDirty =
          localLwt > dirtyBoundaryMs && acknowledgedLwt !== localLwt;
        // Server-owned read_at on outgoing messages is applied BEFORE the
        // dirty-skip. The local client never writes read_at on outgoing
        // rows (see docs/PROJECT_REFERENCE.md §12), so a dirty outgoing row's local edit is
        // never the source of truth for this field.
        if (colName === 'messages' && row.direction === 'outgoing') {
          const remoteReadAt = (row.read_at as string) || '';
          const localJson = localDoc.toJSON();
          const localReadAt = (localJson.readAt as string) || '';
          if (remoteReadAt && remoteReadAt !== localReadAt) {
            try {
              await localDoc.incrementalPatch({ readAt: remoteReadAt });
            } catch (err) {
              pullRowFailed = true;
              collectionErrors.push(err);
              console.warn('[Sync] read_at pull failed for', docId, err);
            }
          }
        }
        if (isLocalDirty) continue;
        let remoteWins = false;
        if (usesTimestamps) {
          const localUpdatedAt = toMs(localDoc.toJSON().updatedAt);
          remoteWins = remoteUpdatedAt > localUpdatedAt;
        } else {
          remoteWins = remoteUpdatedAt > localLwt;
        }
        if (!remoteWins) continue;
        // Narrow race window (F13): a local edit may have landed between
        // the initial findOne and this write. Re-read _meta.lwt and abort
        // if it moved, preserving the local edit for the next push cycle.
        const recheck = await collection.findOne(docId).exec();
        const recheckLwt = recheck?._meta?.lwt ?? 0;
        if (recheckLwt !== localLwt) {
          if (DEBUG) {
            console.log(
              `[Sync] Skipping pull upsert for ${colName} ${docId}; local edit landed mid-pull`
            );
          }
          continue;
        }
        try {
          await collection.upsert(doc);
          justPulled.add(docId);
        } catch (upsertErr) {
          if (isConflictError(upsertErr)) {
            if (DEBUG) {
              console.log(
                `[Sync] Pull upsert CONFLICT for ${colName} ${docId}; preserving local`
              );
            }
          } else {
            throw upsertErr;
          }
        }
      } catch (rowError) {
        console.error(`[Sync] Failed to process ${colName} row:`, rowError);
        pullRowFailed = true;
        collectionErrors.push(rowError);
      }
    }
    if (rows.length < PAGE_SIZE) break;
    const lastId = rows[rows.length - 1].$id as string | undefined;
    if (!lastId || lastId === cursor) {
      pullComplete = false;
      console.warn(
        `[Sync] ${colName} pagination did not advance; keeping pull checkpoint`
      );
      break;
    }
    cursor = lastId;
    if (pageCount >= MAX_PAGES_PER_COLLECTION) {
      pullComplete = false;
      console.warn(
        `[Sync] ${colName} hit page cap (${MAX_PAGES_PER_COLLECTION}); stopping pull`
      );
      break;
    }
  }
  const nextPullIso =
    pullRowFailed || !pullComplete
      ? entry?.pull ?? ''
      : new Date(cycleStartMs).toISOString();
  perCollectionSync[colName as CollectionName] = {
    pull: nextPullIso,
    dirty: entry?.dirty ?? '',
  };
  savePerCollectionState(userId, perCollectionSync);
  let pushFailed = 0;
  let pushDeferred = 0;
  let pushRateLimited = false;
  // A stale cursor forces a complete remote reconciliation, but it does not
  // discard edits made locally since the last successful push. Clean local
  // rows that disappeared from the remote full pull are intentionally not
  // recreated; only genuinely dirty local rows remain eligible to push.
  if (colName !== 'messages') {
    const localDocs = await collection.find().exec();
    const pushCandidates: Array<{
      doc: LocalDoc;
      json: Record<string, unknown>;
      docId: string;
    }> = [];

    for (const doc of localDocs) {
      const json = doc.toJSON();
      const docUserId = json.userId as string | undefined;
      if (docUserId !== userId) continue;
      const docId = (json.id as string) || doc.id;
      if (!docId) continue;
      if (justPulled.has(docId)) continue;
      const remoteMeta = remoteIndex.get(docId);
      const localLwt = doc._meta?.lwt ?? 0;
      const acknowledgedLwt = collectionPushAcks[docId];
      if (localLwt > 0 && acknowledgedLwt === localLwt) continue;
      const isLocalDirty = localLwt > dirtyBoundaryMs;
      const reconciliationStamp =
        reconciledMissing[reconciliationKey(colName, docId)];
      const isReconciledMissing =
        !remoteMeta &&
        json.isDeleted === true &&
        !!reconciliationStamp &&
        toMs(json.updatedAt) <= toMs(reconciliationStamp);
      if (isReconciledMissing) continue;

      let shouldPush = false;
      if (isLocalDirty) {
        shouldPush = true;
      } else if (remoteMeta && usesTimestamps) {
        const localUpdatedAt = toMs(json.updatedAt);
        shouldPush = localUpdatedAt > remoteMeta.updatedAt;
      }
      if (!shouldPush) continue;
      pushCandidates.push({ doc, json, docId });
    }

    const acknowledgeSuccessfulPush = (docId: string, lwt: number) => {
      if (lwt <= 0) return;
      collectionPushAcks[docId] = lwt;
      saveBootstrapPushAcks(userId, bootstrapPushAcks);
    };

    const markPushFailure = (error: unknown) => {
      collectionErrors.push(error);
      if (isRateLimitError(error)) pushRateLimited = true;
      return 1;
    };

    const pushResults = await runBounded(
      pushCandidates,
      PUSH_CONCURRENCY,
      async ({ doc, json: initialJson, docId }) => {
        assertSyncOwnerCurrent(userId, generation);
        let json = initialJson;
        try {
          json = await resolvePendingImageForPush(
            doc,
            json,
            colName,
            userId
          );
        } catch (imageError) {
          console.error(
            `[Sync] Failed to reconcile pending image for ${colName} ${docId}:`,
            imageError
          );
          return markPushFailure(imageError);
        }

        // Pending-image reconciliation and a concurrent local edit can both
        // create a newer RxDB revision after candidates were collected.
        // Re-read immediately before serialization so the revision marker we
        // persist describes the same local state that is sent remotely.
        const currentDoc = await collection.findOne(docId).exec();
        if (currentDoc) {
          json = currentDoc.toJSON();
        }
        const pushedLwt = currentDoc?._meta?.lwt ?? doc._meta?.lwt ?? 0;
        assertSyncOwnerCurrent(userId, generation);
        const rowData = toAppwriteFormat(json, colName, userId);
        if (DEBUG) console.log(`[Sync] Pushing ${colName} ${docId}`);
        try {
          await guardedTablesDB.updateRow({
            databaseId: APPWRITE_CONFIG.databaseId,
            tableId,
            rowId: docId,
            data: rowData,
          });
          if (
            colName === 'settings' &&
            json.key === 'profileImageId' &&
            typeof json.value === 'string' &&
            json.value
          ) {
            await updateProfileAvatar(userId, json.value);
          }
          acknowledgeSuccessfulPush(docId, pushedLwt);
          return 0;
        } catch (updateErr) {
          if (!isNotFoundError(updateErr)) {
            console.error(
              `[Sync] Failed to push ${colName} ${docId}:`,
              updateErr
            );
            return markPushFailure(updateErr);
          }

          // createRow is a strict insert (no PUT semantics). If the row
          // reappeared between our 404 and this call, createRow throws
          // 409 and we let the next cycle reconcile. Do NOT use
          // upsertRow here — its PUT semantics would reset any column
          // the client does not send (see docs/PROJECT_REFERENCE.md §6).
          try {
            await guardedTablesDB.createRow({
              databaseId: APPWRITE_CONFIG.databaseId,
              tableId,
              rowId: docId,
              data: rowData,
              permissions: buildRowPermissions(userId),
            });
            if (
              colName === 'settings' &&
              json.key === 'profileImageId' &&
              typeof json.value === 'string' &&
              json.value
            ) {
              await updateProfileAvatar(userId, json.value);
            }
            acknowledgeSuccessfulPush(docId, pushedLwt);
            return 0;
          } catch (createErr) {
            console.error(
              `[Sync] Failed to create ${colName} ${docId}:`,
              createErr
            );
            return markPushFailure(createErr);
          }
        }
      },
      () => pushRateLimited
    );
    pushFailed = pushResults.reduce<number>(
      (total, failed) => total + failed,
      0
    );
    pushDeferred = Math.max(0, pushCandidates.length - pushResults.length);
    if (pushFailed === 0 && pushDeferred === 0) {
      delete bootstrapPushAcks[colName as CollectionName];
      saveBootstrapPushAcks(userId, bootstrapPushAcks);
    }
  }
  if (incrementalCursorExpired && pullComplete && !pullRowFailed) {
    const localDocsAfterPull = await collection.find().exec();
    const reconciliationNow = new Date().toISOString();
    for (const doc of localDocsAfterPull) {
      assertSyncOwnerCurrent(userId, generation);
      const json = doc.toJSON();
      const docUserId = json.userId as string | undefined;
      if (docUserId !== userId) continue;
      const docId = (json.id as string) || doc.id;
      if (!docId || remoteIndex.has(docId)) continue;
      const localLwt = doc._meta?.lwt ?? 0;
      if (localLwt > dirtyBoundaryMs || json.isDeleted === true) continue;
      if (
        colName === 'messages' &&
        json.direction === 'outgoing' &&
        json.deliveryStatus === 'pending'
      ) {
        continue;
      }
      try {
        await doc.incrementalPatch({
          isDeleted: true,
          updatedAt: reconciliationNow,
        });
        reconciledMissing[reconciliationKey(colName, docId)] = reconciliationNow;
      } catch (reconcileErr) {
        console.error(
          `[Sync] Failed to reconcile missing ${colName} ${docId}:`,
          reconcileErr
        );
        collectionErrors.push(reconcileErr);
        pushFailed++;
      }
    }
    saveReconciledMissingRows(userId, reconciledMissing);
  }
  const nextDirtyIso =
    pushFailed > 0 || pushDeferred > 0
      ? entry?.dirty ?? ''
      : new Date(Math.max(cycleStartMs, dirtyBoundaryMs)).toISOString();
  perCollectionSync[colName as CollectionName] = {
    pull: nextPullIso,
    dirty: nextDirtyIso,
  };
  saveReconciledMissingRows(userId, reconciledMissing);
  savePerCollectionState(userId, perCollectionSync);
  if (DEBUG) {
    if (
      pullRowFailed ||
      pushFailed > 0 ||
      pushDeferred > 0 ||
      !pullComplete
    ) {
      console.warn(
        `[Sync] ⚠️ ${colName} completed with issues: ` +
          `pullRowFailed=${pullRowFailed} pushFailed=${pushFailed} ` +
          `pushDeferred=${pushDeferred} pullComplete=${pullComplete}`
      );
    } else {
      console.log(`[Sync] ✅ ${colName} synced (${pageCount} page(s) pulled)`);
    }
  }
  return {
    pullRowFailed,
    pushFailed,
    pushDeferred,
    pullComplete,
    errors: collectionErrors,
  };
}
export async function forceSync(userId: string) {
  if (DEBUG) console.log('[Sync] Force sync triggered');
  if (allReplicationPilotsActive(userId)) {
    resyncAllReplicationPilots(userId);
    return;
  }
  await initializeSync(userId);
}

export async function forceMessageSync(userId: string): Promise<void> {
  if (isMessageReplicationPilotActive(userId)) {
    resyncMessageReplicationPilot(userId);
    return;
  }
  await initializeSync(userId);
}

export function __resetSyncRuntimeForTests(): void {
  clearBackoffWakeTimer();
  isSyncInProgress = false;
  isSyncCycleQueued = false;
  syncRequestedDuringFlight = false;
  queuedSyncUserId = null;
  backoffOwnerId = null;
  rateLimitUntil = 0;
  rateLimitBackoffMs = 0;
  failureBackoffUntil = 0;
  failureBackoffMs = 0;
  perCollectionSync = {};
  perCollectionOwnerId = null;
}
