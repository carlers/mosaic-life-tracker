import { getDatabase, type AppDatabaseCollections } from './database';
import { Permission, Role, Query } from 'appwrite';
import { isUnauthorizedError } from '../lib/authEvents';
import { guardedTablesDB } from '../lib/sdk';
import { toAppwriteFormat, fromAppwriteFormat } from '../lib/syncMapping';
import {
  getSyncStatus,
  publishSyncStatus,
  type SyncStatus,
} from '../lib/syncStatus';
import { markOfflineDataReady } from '../lib/offlineReadiness';
import { isPendingImageId, deletePendingImage } from '../lib/pendingImages';
import { uploadPendingImage } from '../lib/storage';
import { getConnectivitySnapshot } from '../lib/connectivity';
import { APPWRITE_DATABASE_ID, APPWRITE_TABLES } from '../lib/appwriteConfig';
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
const PER_COLLECTION_KEY = 'lastSyncTimePerCollection';
const RECONCILED_MISSING_KEY = 'reconciledMissingRows';
const PER_COLLECTION_STATE_VERSION = 1;
function loadPerCollectionState(
  userId: string
): Partial<Record<CollectionName, PerCollectionSyncEntry>> {
  try {
    const raw = localStorage.getItem(PER_COLLECTION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const state = parsed as Partial<PerCollectionPersistedState>;
    // Legacy blobs (pre-versioning) have no `version` field. Treat them as
    // version 1 so existing users do not lose their per-collection state.
    const version =
      typeof state.version === 'number'
        ? state.version
        : PER_COLLECTION_STATE_VERSION;
    if (version !== PER_COLLECTION_STATE_VERSION) return {};
    if (state.ownerId !== userId) return {};
    if (!state.entries || typeof state.entries !== 'object') return {};
    return state.entries as Partial<
      Record<CollectionName, PerCollectionSyncEntry>
    >;
  } catch {
    return {};
  }
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
    localStorage.setItem(PER_COLLECTION_KEY, JSON.stringify(state));
  } catch {
  }
}
function loadReconciledMissingRows(
  userId: string
): Record<string, string> {
  try {
    const raw = localStorage.getItem(RECONCILED_MISSING_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const state = parsed as {
      version?: number;
      ownerId?: string;
      entries?: Record<string, string>;
    };
    if (state.version !== 1 || state.ownerId !== userId || !state.entries) {
      return {};
    }
    return state.entries;
  } catch {
    return {};
  }
}

function saveReconciledMissingRows(
  userId: string,
  entries: Record<string, string>
): void {
  try {
    localStorage.setItem(
      RECONCILED_MISSING_KEY,
      JSON.stringify({ version: 1, ownerId: userId, entries })
    );
  } catch {
  }
}

function reconciliationKey(collection: string, rowId: string): string {
  return `${collection}::${rowId}`;
}

let perCollectionSync: Partial<
  Record<CollectionName, PerCollectionSyncEntry>
> = {};
let perCollectionOwnerId: string | null = null;
function updateSyncStatus(updates: Partial<SyncStatus>) {
  const next = publishSyncStatus(updates);
  if (next.lastSync && perCollectionOwnerId) {
    try {
      localStorage.setItem(
        `lastSyncTime_${perCollectionOwnerId}`,
        next.lastSync
      );
    } catch {
      // Sync status persistence is best-effort.
    }
  }
  if (DEBUG) console.log('[Sync] Status:', next);
}
type AppwriteRow = Record<string, unknown>;
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

async function runBounded<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runWorker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
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
  await waitForSyncCoordinatorIdle(timeoutMs);
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
  await doc.incrementalPatch({ [field]: remoteFileId });
  await deletePendingImage(pendingId, userId);
  return { ...json, [field]: remoteFileId };
}
export async function initializeSync(userId: string): Promise<void> {
  if (!userId) return;
  if (backoffOwnerId !== userId) {
    backoffOwnerId = userId;
    rateLimitUntil = 0;
    rateLimitBackoffMs = 0;
    failureBackoffUntil = 0;
    failureBackoffMs = 0;
  }
  // Same-tab reentry: if a cycle is queued (awaiting or holding the lock)
  // or running, coalesce into a single follow-up run rather than queueing
  // a second full cycle. The cross-tab lock below serializes cycles
  // across tabs; this guard only governs intra-tab coalescing.
  if (isSyncInProgress || isSyncCycleQueued) {
    if (DEBUG)
      console.log(
        '[Sync] initializeSync requested while in-flight; queueing follow-up'
      );
    syncRequestedDuringFlight = true;
    queuedSyncUserId = userId;
    return;
  }
  if (Date.now() < rateLimitUntil) {
    if (DEBUG) {
      console.log(
        `[Sync] Skipping: rate-limit backoff until ${new Date(
          rateLimitUntil
        ).toISOString()}`
      );
    }
    updateSyncStatus({ isSyncing: false });
    return;
  }
  if (Date.now() < failureBackoffUntil) {
    if (DEBUG) {
      console.log(
        `[Sync] Skipping: failure backoff until ${new Date(
          failureBackoffUntil
        ).toISOString()}`
      );
    }
    updateSyncStatus({ isSyncing: false });
    return;
  }
  if (getConnectivitySnapshot().status !== 'online') {
    if (DEBUG) console.log('[Sync] Reachability not confirmed, skipping sync');
    updateSyncStatus({ isSyncing: false });
    return;
  }
  isSyncCycleQueued = true;
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.locks &&
      typeof navigator.locks.request === 'function'
    ) {
      try {
        await navigator.locks.request(WEB_LOCKS_NAME, () => runSyncCycleBody(userId));
      } catch (lockErr) {
        // Web Locks API exists but the request failed for some reason.
        // Fall back to running the cycle without the cross-tab mutex so
        // the user still gets a sync. Log and continue.
        console.warn(
          '[Sync] Web Locks request failed; running without cross-tab mutex:',
          lockErr
        );
        await runSyncCycleBody(userId);
      }
    } else {
      await runSyncCycleBody(userId);
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
async function runSyncCycleBody(userId: string): Promise<void> {
  isSyncInProgress = true;
  if (DEBUG) console.log('[Sync] Starting sync...');
  updateSyncStatus({ isSyncing: true, errors: [] });
  try {
    // Unconditional reload: another tab may have written a newer per-
    // collection state since this tab last loaded it. The cross-tab lock
    // guarantees mutual exclusion, not that our in-memory copy is
    // current. Reloading here means the pull/push boundaries reflect the
    // last writer across all tabs.
    perCollectionSync = loadPerCollectionState(userId);
    perCollectionOwnerId = userId;
    let scopedLast: string | null = null;
    try {
      scopedLast = localStorage.getItem(`lastSyncTime_${userId}`);
    } catch {
    }
    publishSyncStatus({ lastSync: scopedLast });
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
      try {
        await syncCollection(
          db[colName] as unknown as LocalCollection,
          colName,
          userId
        );
      } catch (colError) {
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
    if (sawUnauthorized) {
      updateSyncStatus({ isSyncing: false, errors: collectionErrors });
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
    if (collectionErrors.length === 0) {
      const completedAt = new Date().toISOString();
      updateSyncStatus({
        isSyncing: false,
        lastSync: completedAt,
        errors: [],
      });
      markOfflineDataReady(userId, completedAt);
      if (DEBUG) console.log('[Sync] ✅ Sync complete');
    } else {
      updateSyncStatus({ isSyncing: false, errors: collectionErrors });
      if (DEBUG)
        console.warn('[Sync] ⚠️ Sync completed with errors:', collectionErrors);
    }
  } catch (error) {
    console.error('[Sync] ❌ Sync failed', error);
    updateSyncStatus({
      isSyncing: false,
      errors: [
        ...getSyncStatus().errors,
        error instanceof Error ? error.message : 'Unknown error',
      ],
    });
  } finally {
    isSyncInProgress = false;
  }
}
async function syncCollection(
  collection: LocalCollection,
  colName: string,
  userId: string
) {
  const cycleStartMs = Date.now();
  const tableId =
    APPWRITE_CONFIG.tables[colName as keyof typeof APPWRITE_CONFIG.tables];
  if (DEBUG) console.log(`[Sync] Syncing ${colName}...`);
  const entry = perCollectionSync[colName as CollectionName];
  const pullBoundaryMs = entry?.pull ? new Date(entry.pull).getTime() : 0;
  const dirtyBoundaryMs = entry?.dirty ? new Date(entry.dirty).getTime() : 0;
  const incrementalCursorExpired =
    pullBoundaryMs > 0 && Date.now() - pullBoundaryMs > TOMBSTONE_RETENTION_MS;
  const effectivePullBoundaryMs = incrementalCursorExpired ? 0 : pullBoundaryMs;
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
  let cursor: string | undefined = undefined;
  let pageCount = 0;
  let pullRowFailed = false;
  for (;;) {
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
        if (incrementalCursorExpired) {
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
        const isLocalDirty = localLwt > dirtyBoundaryMs;
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
              if (DEBUG) {
                console.warn('[Sync] read_at pull failed for', docId, err);
              }
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
      }
    }
    if (rows.length < PAGE_SIZE) break;
    const lastId = rows[rows.length - 1].$id as string | undefined;
    if (!lastId || lastId === cursor) break;
    cursor = lastId;
    if (pageCount >= MAX_PAGES_PER_COLLECTION) {
      console.warn(
        `[Sync] ${colName} hit page cap (${MAX_PAGES_PER_COLLECTION}); stopping pull`
      );
      break;
    }
  }
  const nextPullIso = pullRowFailed
    ? entry?.pull ?? ''
    : new Date(cycleStartMs).toISOString();
  perCollectionSync[colName as CollectionName] = {
    pull: nextPullIso,
    dirty: entry?.dirty ?? '',
  };
  savePerCollectionState(userId, perCollectionSync);
  let pushFailed = 0;
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

    const pushResults = await runBounded(
      pushCandidates,
      PUSH_CONCURRENCY,
      async ({ doc, json: initialJson, docId }) => {
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
          return 1;
        }

        const rowData = toAppwriteFormat(json, colName, userId);
        if (DEBUG) console.log(`[Sync] Pushing ${colName} ${docId}`);
        try {
          await guardedTablesDB.updateRow({
            databaseId: APPWRITE_CONFIG.databaseId,
            tableId,
            rowId: docId,
            data: rowData,
          });
          return 0;
        } catch (updateErr) {
          if (!isNotFoundError(updateErr)) {
            console.error(
              `[Sync] Failed to push ${colName} ${docId}:`,
              updateErr
            );
            return 1;
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
            return 0;
          } catch (createErr) {
            console.error(
              `[Sync] Failed to create ${colName} ${docId}:`,
              createErr
            );
            return 1;
          }
        }
      }
    );
    pushFailed = pushResults.reduce<number>(
      (total, failed) => total + failed,
      0
    );
  }
  if (incrementalCursorExpired) {
    const localDocsAfterPull = await collection.find().exec();
    const reconciliationNow = new Date().toISOString();
    for (const doc of localDocsAfterPull) {
      const json = doc.toJSON();
      const docUserId = json.userId as string | undefined;
      if (docUserId !== userId) continue;
      const docId = (json.id as string) || doc.id;
      if (!docId || remoteIndex.has(docId)) continue;
      const localLwt = doc._meta?.lwt ?? 0;
      if (localLwt > dirtyBoundaryMs || json.isDeleted === true) continue;
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
        pushFailed++;
      }
    }
    saveReconciledMissingRows(userId, reconciledMissing);
  }
  const nextDirtyIso =
    pushFailed > 0
      ? entry?.dirty ?? ''
      : new Date(Math.max(cycleStartMs, dirtyBoundaryMs)).toISOString();
  perCollectionSync[colName as CollectionName] = {
    pull: nextPullIso,
    dirty: nextDirtyIso,
  };
  saveReconciledMissingRows(userId, reconciledMissing);
  savePerCollectionState(userId, perCollectionSync);
  if (DEBUG) {
    if (pullRowFailed || pushFailed > 0) {
      console.warn(
        `[Sync] ⚠️ ${colName} completed with issues: ` +
          `pullRowFailed=${pullRowFailed} pushFailed=${pushFailed}`
      );
    } else {
      console.log(`[Sync] ✅ ${colName} synced (${pageCount} page(s) pulled)`);
    }
  }
}
export async function forceSync(userId: string) {
  if (DEBUG) console.log('[Sync] Force sync triggered');
  await initializeSync(userId);
}
