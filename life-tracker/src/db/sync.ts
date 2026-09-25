import { getDatabase, type AppDatabaseCollections } from './database';
import { Permission, Role, Query } from 'appwrite';
import { isUnauthorizedError } from '../lib/authEvents';
import { guardedTablesDB } from '../lib/sdk';
import { account } from '../lib/appwrite';
import { toAppwriteFormat, fromAppwriteFormat } from '../lib/syncMapping';
export { toAppwriteFormat, fromAppwriteFormat };
const APPWRITE_CONFIG = {
  endpoint: 'https://sgp.cloud.appwrite.io',
  projectId: '6a9703c50016b37110ff',
  databaseId: 'life_tracker',
  tables: {
    tasks: 'tasks',
    categories: 'categories',
    diary: 'diary',
    settings: 'settings',
    friendships: 'friendships',
    messages: 'messages',
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
const TRIGGER_DEBOUNCE_MS = 1_500;
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
export interface SyncStatus {
  isSyncing: boolean;
  lastSync: string | null;
  errors: string[];
}
let syncStatus: SyncStatus = {
  isSyncing: false,
  lastSync: null,
  errors: [],
};
export function getSyncStatus(): SyncStatus {
  return syncStatus;
}
type SyncListener = (status: SyncStatus) => void;
const listeners: SyncListener[] = [];
function updateSyncStatus(updates: Partial<SyncStatus>) {
  syncStatus = { ...syncStatus, ...updates };
  if (syncStatus.lastSync && perCollectionOwnerId) {
    try {
      localStorage.setItem(
        `lastSyncTime_${perCollectionOwnerId}`,
        syncStatus.lastSync
      );
    } catch {
    }
  }
  for (const l of listeners) {
    try {
      l(syncStatus);
    } catch (err) {
      console.error('[Sync] Status listener threw:', err);
    }
  }
  if (DEBUG) console.log('[Sync] Status:', syncStatus);
}
export function subscribeToSyncStatus(listener: SyncListener): () => void {
  listeners.push(listener);
  try {
    listener(syncStatus);
  } catch (err) {
    console.error('[Sync] Status listener threw on subscribe:', err);
  }
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
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
let rateLimitUntil = 0;
let rateLimitBackoffMs = 0;
let failureBackoffUntil = 0;
let failureBackoffMs = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
declare global {
  interface Window {
    __mosaicFocusSyncAttached?: boolean;
  }
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
// OFF-2: this runs on every sync cycle, including the cold-load call in
// main.tsx that precedes AuthProvider's own account.get(). A 401 here is
// the normal "no session yet" case, not a mid-session expiry, and the
// guarded SDK would dispatch `auth:unauthorized` on that 401 — racing
// AuthProvider's resolveInitialUser and intermittently showing a
// "session expired" banner on a fresh device. Use the raw client so sync
// never owns session state; AuthProvider is the single source of truth
// (docs/PROJECT_REFERENCE.md §23).
async function resolveAuthenticatedUserId(): Promise<string | null> {
  try {
    const user = await account.get();
    return user?.$id || null;
  } catch (err) {
    if (DEBUG) console.log('[Sync] account.get() failed:', err);
    return null;
  }
}
export async function initializeSync(): Promise<void> {
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
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (DEBUG) console.log('[Sync] Offline, skipping sync');
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
        await navigator.locks.request(WEB_LOCKS_NAME, runSyncCycleBody);
      } catch (lockErr) {
        // Web Locks API exists but the request failed for some reason.
        // Fall back to running the cycle without the cross-tab mutex so
        // the user still gets a sync. Log and continue.
        console.warn(
          '[Sync] Web Locks request failed; running without cross-tab mutex:',
          lockErr
        );
        await runSyncCycleBody();
      }
    } else {
      await runSyncCycleBody();
    }
  } finally {
    isSyncCycleQueued = false;
    if (syncRequestedDuringFlight) {
      syncRequestedDuringFlight = false;
      if (DEBUG) console.log('[Sync] Running queued follow-up sync');
      queueMicrotask(() => {
        initializeSync().catch((err) => {
          console.error('[Sync] Queued follow-up sync failed:', err);
        });
      });
    }
  }
}
async function runSyncCycleBody(): Promise<void> {
  isSyncInProgress = true;
  if (DEBUG) console.log('[Sync] Starting sync...');
  updateSyncStatus({ isSyncing: true, errors: [] });
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      if (DEBUG) console.log('[Sync] No authenticated user, skipping sync');
      updateSyncStatus({ isSyncing: false });
      return;
    }
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
    syncStatus = { ...syncStatus, lastSync: scopedLast };
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
      updateSyncStatus({
        isSyncing: false,
        lastSync: new Date().toISOString(),
        errors: [],
      });
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
        ...syncStatus.errors,
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
      const reconciliationStamp = reconciledMissing[reconciliationKey(colName, docId)];
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
      const rowData = toAppwriteFormat(json, colName, userId);
      if (DEBUG) console.log(`[Sync] Pushing ${colName} ${docId}`);
      try {
        await guardedTablesDB.updateRow({
          databaseId: APPWRITE_CONFIG.databaseId,
          tableId,
          rowId: docId,
          data: rowData,
        });
      } catch (updateErr) {
        if (isNotFoundError(updateErr)) {
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
          } catch (createErr) {
            console.error(
              `[Sync] Failed to create ${colName} ${docId}:`,
              createErr
            );
            pushFailed++;
          }
        } else {
          console.error(
            `[Sync] Failed to push ${colName} ${docId}:`,
            updateErr
          );
          pushFailed++;
        }
      }
    }
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
export async function forceSync() {
  if (DEBUG) console.log('[Sync] Force sync triggered');
  await initializeSync();
}
function safeForceSync(reason: string) {
  try {
    getDatabase();
    if (DEBUG) console.log(`[Sync] ${reason}, syncing...`);
    forceSync().catch((e) => console.error(`[Sync] ${reason} sync failed`, e));
  } catch (e) {
    if (DEBUG)
      console.log(`[Sync] ${reason} handler skipped (DB not ready):`, e);
  }
}
function scheduleSync(reason: string) {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    safeForceSync(reason);
  }, TRIGGER_DEBOUNCE_MS);
}
function handleWindowFocus() {
  scheduleSync('Window focused');
}
function handleOnline() {
  scheduleSync('Connection restored');
}
function handleVisibilityChange() {
  if (
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible'
  ) {
    scheduleSync('App became visible');
  }
}
if (typeof window !== 'undefined' && !window.__mosaicFocusSyncAttached) {
  window.__mosaicFocusSyncAttached = true;
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('online', handleOnline);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
}
