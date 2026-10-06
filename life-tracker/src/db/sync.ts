import { syncFriendships } from '../lib/friendshipSync';
import { getDatabase } from './database';
import { Query } from 'appwrite';
import { isUnauthorizedError } from '../lib/authEvents';
import { guardedTablesDB } from '../lib/sdk';
import { toAppwriteFormat, fromAppwriteFormat } from '../lib/syncMapping';
import {
  getSyncStatus,
  publishSyncStatus,
  type SyncProgress,
  type SyncStatus,
} from '../lib/syncStatus';
import { markOfflineDataReady } from '../lib/offlineReadiness';
import { getConnectivitySnapshot } from '../lib/connectivity';
import {
  isCategoryReplicationPilotActive,
  refreshCategoryReplicationPilot,
  resyncCategoryReplicationPilot,
  startCategoryReplicationPilot,
  stopCategoryReplicationPilot,
} from './categoryReplicationPilot';
import {
  isDiaryReplicationPilotActive,
  refreshDiaryReplicationPilot,
  resyncDiaryReplicationPilot,
  startDiaryReplicationPilot,
  stopDiaryReplicationPilot,
} from './diaryReplicationPilot';
import {
  isSettingsReplicationPilotActive,
  refreshSettingsReplicationPilot,
  resyncSettingsReplicationPilot,
  startSettingsReplicationPilot,
  stopSettingsReplicationPilot,
} from './settingsReplicationPilot';
import {
  isFriendshipReplicationPilotActive,
  refreshFriendshipReplicationPilot,
  resyncFriendshipReplicationPilot,
  startFriendshipReplicationPilot,
  stopFriendshipReplicationPilot,
} from './friendshipReplicationPilot';
import {
  isTaskReplicationPilotActive,
  refreshTaskReplicationPilot,
  resyncTaskReplicationPilot,
  startTaskReplicationPilot,
  stopTaskReplicationPilot,
} from './taskReplicationPilot';
import {
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
import {
  getReplicationIdentifier,
  SYNCED_COLLECTION_NAMES,
  type SyncedCollectionName,
} from './replicationIds';
import { getReplicationFreshness } from './replicationLocalState';
import { assertRemoteRowsOwnedBy } from './replicationOwnership';
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
const SYNC_COORDINATOR_IDLE_TIMEOUT_MS = 90_000;
// Tombstones are retained remotely for this long. A client whose incremental
// pull cursor is older than the retention window performs a full pull so it
// never assumes that a missing row means the row still exists.
export const TOMBSTONE_RETENTION_DAYS = 90;
const TOMBSTONE_RETENTION_MS = TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const WEB_LOCKS_NAME = 'mosaic-sync';
type CollectionName = SyncedCollectionName;
const ALL_COLLECTIONS: CollectionName[] = [...SYNCED_COLLECTION_NAMES];
interface PerCollectionSyncEntry {
  pull: string;
  dirty: string;
}
interface PerCollectionPersistedState {
  version: number;
  ownerId: string;
  entries: Partial<Record<CollectionName, PerCollectionSyncEntry>>;
}
const PER_COLLECTION_KEY = 'lastSyncTimePerCollection';
const PER_COLLECTION_STATE_VERSION = 1;

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
function mappedStateEquals(
  local: Record<string, unknown>,
  remote: Record<string, unknown>
): boolean {
  return Object.entries(remote).every(([key, value]) => local[key] === value);
}

export function isRateLimitError(err: unknown): boolean {
  const error = err as { code?: number; cause?: { code?: number } } | null;
  return (
    error?.code === 429 ||
    error?.cause?.code === 429 ||
    /rate limit/i.test(err instanceof Error ? err.message : String(err))
  );
}
function isConflictError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === 'CONFLICT';
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
  if (!userId || backoffWakeUserId === userId) {
    clearBackoffWakeTimer();
  }
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

export interface FreshSyncOptions {
  onProgress?: (progress: SyncProgress) => void;
  reconcile?: boolean;
}

function isFreshSyncStillPending(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /timed out|sync is still busy/i.test(error.message);
}

function formatSyncGroupList(groups: string[]): string {
  if (groups.length === 0) return '';
  if (groups.length === 1) return groups[0];
  if (groups.length === 2) return groups.join(' and ');
  return groups.slice(0, -1).join(', ') + ', and ' + groups.at(-1);
}

async function reconcileLocalReplica(
  userId: string,
  generation: number,
  deadline: number
): Promise<void> {
  const db = getDatabase();

  for (const colName of ALL_COLLECTIONS) {
    assertSyncOwnerCurrent(userId, generation);
    if (Date.now() >= deadline) throw new Error('Reconciliation timed out');

    const result = await syncCollection(
      db[colName] as unknown as LocalCollection,
      colName,
      userId,
      generation,
      {
        forceFullPull: true,
        staleFreshnessBoundaryMs:
          colName === 'messages' ? Date.now() : Infinity,
      }
    );

    if (result.pullRowFailed || !result.pullComplete) {
      throw new Error('Reconciliation failed: ' + colName);
    }
  }
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
  timeoutMs = SYNC_COORDINATOR_IDLE_TIMEOUT_MS,
  options: FreshSyncOptions = {}
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
    const pilotsWereActive = allReplicationPilotsActive(userId);
    await initializeSync(userId, { deadline });
    assertSyncOwnerCurrent(userId, generation);

    if (!pilotsWereActive) {
      const bootstrapErrors = getSyncStatus().errors;
      if (bootstrapErrors.length > 0) {
        throw new Error(
          'Fresh sync startup or stale recovery failed: ' + bootstrapErrors.join('; ')
        );
      }
    }
    if (!allReplicationPilotsActive(userId)) {
      throw new Error(
        'Fresh sync could not activate every replication collection.'
      );
    }

    const refreshes: Array<
      [CollectionName, string, (timeout: number) => Promise<boolean>]
    > = [
      [
        'categories',
        'Categories',
        (timeout) => refreshCategoryReplicationPilot(userId, timeout),
      ],
      [
        'diary',
        'Diary',
        (timeout) => refreshDiaryReplicationPilot(userId, timeout),
      ],
      [
        'settings',
        'Preferences',
        (timeout) => refreshSettingsReplicationPilot(userId, timeout),
      ],
      [
        'friendships',
        'Friends',
        (timeout) => refreshFriendshipReplicationPilot(userId, timeout),
      ],
      [
        'tasks',
        'Tasks',
        (timeout) => refreshTaskReplicationPilot(userId, timeout),
      ],
      [
        'messages',
        'Messages',
        (timeout) => refreshMessageReplicationPilot(userId, timeout),
      ],
    ];

    const total = refreshes.length;
    let completed = 0;
    const pendingGroups = new Set(
      refreshes.map(([, displayName]) => displayName)
    );
    const reportProgress = (label: string) => {
      const progress: SyncProgress = {
        completed,
        total,
        percent: Math.round((completed / total) * 100),
        label,
        pendingGroups: [...pendingGroups],
      };
      updateSyncStatus(
        {
          isSyncing: true,
          errors: [],
          notice: null,
          progress,
        },
        { userId, generation }
      );
      options.onProgress?.(progress);
    };

    reportProgress('Checking all 6 data groups…');

    // The six pilots are independent replication states. Awaiting them
    // sequentially made later collections inherit only the scraps of one
    // shared deadline; a slow category pass could therefore make a healthy
    // diary pilot report a false timeout. Start every freshness proof against
    // the same remaining deadline and report exactly which groups remain.
    const results = await Promise.allSettled(
      refreshes.map(async ([name, displayName, refresh]) => {
        assertSyncOwnerCurrent(userId, generation);
        const refreshed = await refresh(remaining());
        if (!refreshed) {
          throw new Error(
            'Fresh ' + name + ' sync is not active for the current account.'
          );
        }
        assertSyncOwnerCurrent(userId, generation);
        pendingGroups.delete(displayName);
        completed += 1;
        reportProgress(
          completed === total
            ? 'All data groups synced'
            : 'Waiting for ' +
                formatSyncGroupList([...pendingGroups]) +
                ' · ' +
                completed +
                ' of ' +
                total +
                ' synced'
        );
      })
    );

    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    if (failure) throw failure.reason;

    if (options.reconcile) {
      reportProgress('Verifying local data…');
      await reconcileLocalReplica(userId, generation, deadline);
      assertSyncOwnerCurrent(userId, generation);

      if (
        (await Promise.all(
          refreshes.map(([, , refresh]) => refresh(remaining()))
        )).includes(false)
      ) {
        throw new Error('Fresh sync is not active');
      }
      assertSyncOwnerCurrent(userId, generation);
      reportProgress('All data groups verified');
    }

    assertSyncOwnerCurrent(userId, generation);
    const completedAt = new Date().toISOString();
    updateSyncStatus(
      {
        isSyncing: false,
        lastSync: completedAt,
        errors: [],
        notice: null,
        progress: null,
      },
      { userId, generation }
    );
    markOfflineDataReady(userId, completedAt);
    return { status: getSyncStatus(), startedAt };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Fresh RxDB sync failed';
    if (isFreshSyncStillPending(error)) {
      const pendingGroups = getSyncStatus().progress?.pendingGroups ?? [];
      updateSyncStatus(
        {
          isSyncing: false,
          errors: [],
          notice:
            pendingGroups.length > 0
              ? 'Still waiting for ' +
                formatSyncGroupList(pendingGroups) +
                '. Live sync will keep trying in the background; tap Sync Now later to confirm.'
              : 'Sync is still finishing in the background. Tap Sync Now to confirm when it is fully caught up.',
          progress: null,
        },
        { userId, generation }
      );
    } else {
      updateSyncStatus(
        {
          isSyncing: false,
          errors: [...getSyncStatus().errors, message],
          notice: null,
          progress: null,
        },
        { userId, generation }
      );
    }
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

  if (backoffOwnerId === userId && Date.now() < rateLimitUntil) {
    scheduleBackoffWake(userId, rateLimitUntil);
    return { status: getSyncStatus(), startedAt: Date.now() };
  }

  if (backoffOwnerId === userId && Date.now() < failureBackoffUntil) {
    failureBackoffUntil = 0;
    failureBackoffMs = 0;
    clearBackoffWakeTimer();
  }

  return refreshSync(userId, timeoutMs, { reconcile: true });
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
            'Mosaic fresh sync timed out while waiting for another Mosaic tab.',
            { cause: lockErr }
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
function isReplicationPilotActive(
  collection: CollectionName,
  userId: string
): boolean {
  switch (collection) {
    case 'tasks':
      return isTaskReplicationPilotActive(userId);
    case 'categories':
      return isCategoryReplicationPilotActive(userId);
    case 'diary':
      return isDiaryReplicationPilotActive(userId);
    case 'settings':
      return isSettingsReplicationPilotActive(userId);
    case 'friendships':
      return isFriendshipReplicationPilotActive(userId);
    case 'messages':
      return isMessageReplicationPilotActive(userId);
  }
  return false;
}

function resyncReplicationPilot(
  collection: CollectionName,
  userId: string
): void {
  switch (collection) {
    case 'tasks':
      resyncTaskReplicationPilot(userId);
      return;
    case 'categories':
      resyncCategoryReplicationPilot(userId);
      return;
    case 'diary':
      resyncDiaryReplicationPilot(userId);
      return;
    case 'settings':
      resyncSettingsReplicationPilot(userId);
      return;
    case 'friendships':
      resyncFriendshipReplicationPilot(userId);
      return;
    case 'messages':
      resyncMessageReplicationPilot(userId);
      return;
  }
}

async function startReplicationPilot(
  collection: CollectionName,
  userId: string,
  generation: number
): Promise<void> {
  assertSyncOwnerCurrent(userId, generation);
  const db = getDatabase();
  switch (collection) {
    case 'tasks':
      await startTaskReplicationPilot(userId, db.tasks, undefined);
      return;
    case 'categories':
      await startCategoryReplicationPilot(userId, db.categories, undefined);
      return;
    case 'diary':
      await startDiaryReplicationPilot(userId, db.diary, undefined);
      return;
    case 'settings':
      await startSettingsReplicationPilot(userId, db.settings, undefined);
      return;
    case 'friendships':
      await startFriendshipReplicationPilot(
        userId,
        db.friendships,
        undefined
      );
      return;
    case 'messages':
      await startMessageReplicationPilot(
        userId,
        db.messages,
        undefined,
        undefined
      );
      return;
  }
}

async function getStaleRecoveryBoundary(
  userId: string,
  collection: CollectionName,
  legacyEntry: PerCollectionSyncEntry | undefined
): Promise<number | null> {
  const freshness = await getReplicationFreshness(userId, collection);
  const currentReplicationIdentifier = getReplicationIdentifier(
    collection,
    userId
  );
  const freshnessMs =
    freshness?.replicationIdentifier === currentReplicationIdentifier
      ? toMs(freshness.lastFreshAt)
      : 0;
  const legacyPullMs = legacyEntry?.pull ? toMs(legacyEntry.pull) : 0;
  const boundaryMs = freshnessMs || legacyPullMs;
  if (
    boundaryMs > 0 &&
    Date.now() - boundaryMs > TOMBSTONE_RETENTION_MS
  ) {
    return boundaryMs;
  }
  return null;
}

async function runSyncCycleBody(
  userId: string,
  generation: number
): Promise<void> {
  assertSyncOwnerCurrent(userId, generation);
  isSyncInProgress = true;
  if (DEBUG) console.log('[Sync] Starting replication coordinator...');
  updateSyncStatus(
    { isSyncing: true, errors: [], notice: null, progress: null },
    { userId, generation }
  );

  try {
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

    const db = getDatabase();
    const collectionErrors: string[] = [];
    let sawRateLimit = false;
    let sawUnauthorized = false;
    let sawNonRateLimitFailure = false;

    for (const colName of ALL_COLLECTIONS) {
      assertSyncOwnerCurrent(userId, generation);
      try {
        if (isReplicationPilotActive(colName, userId)) {
          resyncReplicationPilot(colName, userId);
          continue;
        }

        const staleBoundaryMs = await getStaleRecoveryBoundary(
          userId,
          colName,
          perCollectionSync[colName]
        );

        if (staleBoundaryMs !== null) {
          if (DEBUG) {
            console.log(
              `[Sync] ${colName} local freshness exceeds tombstone retention; running read-only full recovery`
            );
          }
          const result = await syncCollection(
            db[colName] as unknown as LocalCollection,
            colName,
            userId,
            generation,
            {
              forceFullPull: true,
              staleFreshnessBoundaryMs: staleBoundaryMs,
            }
          );
          assertSyncOwnerCurrent(userId, generation);

          if (result.pullRowFailed || !result.pullComplete) {
            const issueParts: string[] = [];
            if (result.pullRowFailed) issueParts.push('pull row failed');
            if (!result.pullComplete) issueParts.push('pull incomplete');
            collectionErrors.push(
              `${colName}: stale recovery ${issueParts.join(', ')}`
            );
            if (result.errors.length === 0) {
              sawNonRateLimitFailure = true;
            }
            for (const rowError of result.errors) {
              if (isRateLimitError(rowError)) {
                sawRateLimit = true;
              } else if (isUnauthorizedError(rowError)) {
                sawUnauthorized = true;
              } else {
                sawNonRateLimitFailure = true;
              }
            }
            continue;
          }
        }

        await startReplicationPilot(colName, userId, generation);
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
        `[Sync] Rate limited during stale recovery; backing off for ${rateLimitBackoffMs}ms`
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
        `[Sync] Backing off after stale-recovery failure for ${failureBackoffMs}ms`
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

    updateSyncStatus(
      {
        isSyncing: false,
        errors: collectionErrors,
        notice: null,
        progress: null,
      },
      { userId, generation }
    );

    if (DEBUG && collectionErrors.length === 0) {
      console.log('[Sync] ✅ RxDB replication pilots active');
    }
  } catch (error) {
    if (error instanceof SyncOwnerChangedError) {
      await stopAllReplicationPilots(userId);
    } else {
      console.error('[Sync] ❌ Sync coordinator failed', error);
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

interface StaleRecoveryOptions {
  forceFullPull?: boolean;
  staleFreshnessBoundaryMs?: number;
}

async function syncCollection(
  collection: LocalCollection,
  colName: CollectionName,
  userId: string,
  generation: number,
  options: StaleRecoveryOptions = {}
): Promise<CollectionSyncResult> {
  assertSyncOwnerCurrent(userId, generation);

  if (colName === 'friendships') {
    await syncFriendships(
      userId,
      options.staleFreshnessBoundaryMs === Infinity
    );
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
  const tableId = APPWRITE_CONFIG.tables[colName];
  const entry = perCollectionSync[colName];
  const pullBoundaryMs = entry?.pull ? toMs(entry.pull) : 0;
  const dirtyBoundaryMs = entry?.dirty ? toMs(entry.dirty) : 0;
  const forceFullPull = options.forceFullPull === true;
  const effectivePullBoundaryMs = forceFullPull ? 0 : pullBoundaryMs;
  const staleBoundaryMs = options.staleFreshnessBoundaryMs;
  const authoritativeReconcile = staleBoundaryMs === Infinity;

  const remoteIndex = new Map<
    string,
    { updatedAt: number; isDeleted: boolean }
  >();
  let cursor: string | undefined;
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
    assertRemoteRowsOwnedBy(
      rows as unknown as Record<string, unknown>[],
      userId,
      `${colName} stale recovery`
    );
    pageCount++;
    if (DEBUG) {
      console.log(
        `[Sync] stale recovery ${colName} page ${pageCount}: ${rows.length} rows`
      );
    }
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
        const localDoc = await collection.findOne(docId).exec();
        if (!localDoc) {
          try {
            await collection.upsert(doc);
          } catch (upsertErr) {
            if (!isConflictError(upsertErr)) throw upsertErr;
          }
          continue;
        }

        const localJson = localDoc.toJSON();
        const localLwt = localDoc._meta?.lwt ?? 0;
        const localUpdatedAt = toMs(localJson.updatedAt);
        const isLocalDirty = authoritativeReconcile
          ? localLwt > cycleStartMs
          : staleBoundaryMs !== undefined
            ? localUpdatedAt <= 0 || localUpdatedAt > staleBoundaryMs
            : localLwt > dirtyBoundaryMs;

        if (colName === 'messages' && row.direction === 'outgoing') {
          const remoteReadAt = (row.read_at as string) || '';
          const localReadAt = (localJson.readAt as string) || '';
          if (remoteReadAt && remoteReadAt !== localReadAt) {
            try {
              await localDoc.incrementalPatch({ readAt: remoteReadAt });
            } catch (error) {
              pullRowFailed = true;
              collectionErrors.push(error);
              console.warn('[Sync] read_at pull failed for', docId, error);
            }
          }
        }

        if (isLocalDirty) continue;
        if (authoritativeReconcile && mappedStateEquals(localJson, doc)) {
          continue;
        }

        const remoteWins =
          authoritativeReconcile ||
          (isTimestampedCollection(colName)
            ? remoteUpdatedAt > localUpdatedAt
            : remoteUpdatedAt > localLwt);
        if (!remoteWins) continue;

        const recheck = await collection.findOne(docId).exec();
        const recheckLwt = recheck?._meta?.lwt ?? 0;
        if (recheckLwt !== localLwt) {
          if (DEBUG) {
            console.log(
              `[Sync] Skipping stale-recovery upsert for ${colName} ${docId}; local edit landed mid-pull`
            );
          }
          continue;
        }

        try {
          await collection.upsert(doc);
        } catch (upsertErr) {
          if (!isConflictError(upsertErr)) throw upsertErr;
        }
      } catch (rowError) {
        console.error(
          `[Sync] Failed to process stale-recovery ${colName} row:`,
          rowError
        );
        pullRowFailed = true;
        collectionErrors.push(rowError);
      }
    }

    if (rows.length < PAGE_SIZE) break;
    const lastId = rows[rows.length - 1].$id as string | undefined;
    if (!lastId || lastId === cursor) {
      pullComplete = false;
      console.warn(
        `[Sync] ${colName} stale-recovery pagination did not advance`
      );
      break;
    }
    cursor = lastId;
    if (pageCount >= MAX_PAGES_PER_COLLECTION) {
      pullComplete = false;
      console.warn(
        `[Sync] ${colName} stale recovery hit page cap (${MAX_PAGES_PER_COLLECTION})`
      );
      break;
    }
  }

  if (
    forceFullPull &&
    staleBoundaryMs !== undefined &&
    pullComplete &&
    !pullRowFailed
  ) {
    const localDocs = await collection.find().exec();
    const reconciliationNow = new Date().toISOString();

    for (const doc of localDocs) {
      assertSyncOwnerCurrent(userId, generation);
      const json = doc.toJSON();
      if ((json.userId as string | undefined) !== userId) continue;
      const docId = (json.id as string) || doc.id;
      if (!docId || remoteIndex.has(docId) || json.isDeleted === true) continue;

      if (
        colName === 'messages' &&
        json.direction === 'outgoing' &&
        json.deliveryStatus === 'pending'
      ) {
        continue;
      }

      const localUpdatedAt = toMs(json.updatedAt);
      if (
        authoritativeReconcile
          ? (doc._meta?.lwt ?? 0) > cycleStartMs
          : localUpdatedAt <= 0 || localUpdatedAt > staleBoundaryMs
      ) {
        continue;
      }

      try {
        await doc.incrementalPatch({
          isDeleted: true,
          updatedAt: reconciliationNow,
        });

      } catch (reconcileErr) {
        console.error(
          `[Sync] Failed to reconcile stale missing ${colName} ${docId}:`,
          reconcileErr
        );
        collectionErrors.push(reconcileErr);
        pullRowFailed = true;
      }
    }
  }

  const nextPullIso =
    pullRowFailed || !pullComplete
      ? entry?.pull ?? ''
      : new Date(cycleStartMs).toISOString();
  perCollectionSync[colName] = {
    pull: nextPullIso,
    dirty: entry?.dirty ?? '',
  };
  savePerCollectionState(userId, perCollectionSync);

  if (DEBUG) {
    if (pullRowFailed || !pullComplete) {
      console.warn(
        `[Sync] ⚠️ ${colName} stale recovery issues: pullRowFailed=${pullRowFailed} pullComplete=${pullComplete}`
      );
    } else {
      console.log(
        `[Sync] ✅ ${colName} stale recovery complete (${pageCount} page(s))`
      );
    }
  }

  return {
    pullRowFailed,
    pushFailed: 0,
    pushDeferred: 0,
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
