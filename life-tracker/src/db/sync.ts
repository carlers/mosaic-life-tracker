import { getDatabase, type AppDatabaseCollections } from './database';
import { Permission, Role, Query } from 'appwrite';
import { isUnauthorizedError } from '../lib/authEvents';
import { guardedTablesDB, guardedAccount } from '../lib/sdk';
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
    collection === 'diary' ||
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
async function resolveAuthenticatedUserId(): Promise<string | null> {
  try {
    const user = await guardedAccount.get();
    return user?.$id || null;
  } catch (err) {
    if (DEBUG) console.log('[Sync] account.get() failed:', err);
    return null;
  }
}
export async function initializeSync(): Promise<void> {
  if (isSyncInProgress) {
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
    if (perCollectionOwnerId !== userId) {
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
  const usesTimestamps = isTimestampedCollection(colName);
  const remoteIndex = new Map<
    string,
    { updatedAt: number; isDeleted: boolean }
  >();
  const justPulled = new Set<string>();
  let cursor: string | undefined = undefined;
  let pageCount = 0;
  let pullRowFailed = false;
  for (;;) {
    const queries: unknown[] = [
      Query.equal('user_id', userId),
      Query.limit(PAGE_SIZE),
      Query.orderAsc('$id'),
    ];
    if (pullBoundaryMs > 0) {
      const sinceIso = new Date(
        pullBoundaryMs - PULL_OVERLAP_MS
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
        const localDoc = await collection.findOne(docId).exec();
        if (!localDoc) {
          await collection.upsert(doc);
          justPulled.add(docId);
          continue;
        }
        const localLwt = localDoc._meta?.lwt ?? 0;
        const isLocalDirty = localLwt > dirtyBoundaryMs;
        if (isLocalDirty) continue;
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
        let remoteWins = false;
        if (usesTimestamps) {
          const localUpdatedAt = toMs(localDoc.toJSON().updatedAt);
          remoteWins = remoteUpdatedAt > localUpdatedAt;
        } else {
          remoteWins = remoteUpdatedAt > localLwt;
        }
        if (remoteWins) {
          await collection.upsert(doc);
          justPulled.add(docId);
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
          try {
            await guardedTablesDB.upsertRow({
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
  const nextDirtyIso =
    pushFailed > 0
      ? entry?.dirty ?? ''
      : new Date(Math.max(cycleStartMs, dirtyBoundaryMs)).toISOString();
  perCollectionSync[colName as CollectionName] = {
    pull: nextPullIso,
    dirty: nextDirtyIso,
  };
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
