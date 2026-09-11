import { getDatabase, type AppDatabaseCollections } from './database';
import { client, account } from '../lib/appwrite';
import { TablesDB, Permission, Role, Query } from 'appwrite';

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
  },
} as const;

const tablesDB = new TablesDB(client);
const DEBUG = import.meta.env.DEV;
const PAGE_SIZE = 100;

export interface SyncStatus {
  isSyncing: boolean;
  lastSync: string | null;
  errors: string[];
}

let syncStatus: SyncStatus = {
  isSyncing: false,
  lastSync: localStorage.getItem('lastSyncTime') || null,
  errors: [],
};

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

type SyncListener = (status: SyncStatus) => void;
const listeners: SyncListener[] = [];

function updateSyncStatus(updates: Partial<SyncStatus>) {
  syncStatus = { ...syncStatus, ...updates };
  if (syncStatus.lastSync) {
    localStorage.setItem('lastSyncTime', syncStatus.lastSync);
  }
  listeners.forEach((l) => l(syncStatus));
  if (DEBUG) console.log('[Sync] Status:', syncStatus);
}

export function subscribeToSyncStatus(listener: SyncListener): () => void {
  listeners.push(listener);
  listener(syncStatus);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

type AppwriteRow = Record<string, unknown>;
type AppwritePayload = Record<string, unknown>;
type LocalDoc = {
  id: string;
  _meta?: { lwt?: number };
  toJSON: () => Record<string, unknown>;
};
type LocalCollection = {
  findOne: (id: string) => { exec: () => Promise<LocalDoc | null> };
  find: () => { exec: () => Promise<LocalDoc[]> };
  upsert: (doc: Record<string, unknown>) => Promise<unknown>;
};

let isSyncInProgress = false;

declare global {
  interface Window {
    __mosaicFocusSyncAttached?: boolean;
  }
}

function isTimestampedCollection(collection: string): boolean {
  return (
    collection === 'tasks' ||
    collection === 'diary' ||
    collection === 'friendships'
  );
}

function toAppwriteFormat(
  doc: Record<string, unknown>,
  collection: string,
  userId: string
): AppwritePayload {
  const source: Record<string, unknown> = { ...doc };
  delete source._meta;
  delete source._deleted;
  delete source._rev;

  const mapped: AppwritePayload = {};

  if (collection === 'tasks') {
    mapped.title = source.title || '';
    mapped.is_completed = source.completed ?? false;
    mapped.category_id = source.categoryId || '';
    mapped.tags = source.tags || '';
    mapped.date = source.date || '';
    mapped.memo = source.memo || '';
    mapped.image = source.image || '';
    mapped.created_at = source.createdAt || new Date().toISOString();
    mapped.completed_at = source.completedAt || '';
    mapped.updated_at = source.updatedAt || new Date().toISOString();
    mapped.user_id = userId;
    mapped.deleted = source.isDeleted ?? false;
    mapped.visibility = source.visibility || 'private';
    mapped.source = source.source || '';
    mapped.routine_id = source.routineId || '';
    mapped.reminder_time = source.reminderTime || '';
    mapped.reactions = source.reactions || '';
  } else if (collection === 'categories') {
    mapped.name = source.name || '';
    mapped.color = source.color || '#3B82F6';
    mapped.visibility = source.visibility || 'private';
    mapped.order = source.order ?? 0;
    mapped.user_id = userId;
    mapped.deleted = source.isDeleted ?? false;
    mapped.icon = source.icon || '';
  } else if (collection === 'diary') {
    mapped.date = source.date || '';
    mapped.content = source.content || '';
    mapped.visibility = source.visibility || 'private';
    mapped.user_id = userId;
    mapped.deleted = source.isDeleted ?? false;
    mapped.created_at = source.createdAt || new Date().toISOString();
    mapped.updated_at = source.updatedAt || new Date().toISOString();
  } else if (collection === 'settings') {
    mapped.user_id = userId;
    mapped.key = source.key || '';
    mapped.value = source.value || '';
    mapped.deleted = source.isDeleted ?? false;
  } else if (collection === 'friendships') {
    mapped.user_id = userId;
    mapped.friend_id = source.friendId || '';
    mapped.friend_username = source.friendUsername || '';
    mapped.friend_display_name = source.friendDisplayName || '';
    mapped.friend_avatar_file_id = source.friendAvatarFileId || '';
    mapped.status = source.status || 'pending_outgoing';
    mapped.created_at = source.createdAt || new Date().toISOString();
    mapped.updated_at = source.updatedAt || new Date().toISOString();
    mapped.deleted = source.isDeleted ?? false;
  }

  return mapped;
}

function fromAppwriteFormat(
  row: AppwriteRow,
  collection: string
): Record<string, unknown> {
  const mapped: Record<string, unknown> = { ...row };
  delete mapped.$id;
  delete mapped.$createdAt;
  delete mapped.$updatedAt;
  delete mapped.$permissions;
  delete mapped.$databaseId;
  delete mapped.$tableId;
  delete mapped.$sequence;

  if (collection === 'tasks') {
    mapped.id = row.$id || mapped.id;
    mapped.completed = mapped.is_completed ?? false;
    mapped.categoryId = mapped.category_id || '';
    mapped.createdAt = mapped.created_at || new Date().toISOString();
    mapped.completedAt = mapped.completed_at || '';
    mapped.updatedAt = mapped.updated_at || new Date().toISOString();
    mapped.userId = mapped.user_id;
    mapped.isDeleted = mapped.deleted ?? false;
    mapped.source = row.source || '';
    mapped.tags = row.tags || '';
    mapped.memo = row.memo || '';
    mapped.image = row.image || '';
    mapped.routineId = row.routine_id || '';
    mapped.reminderTime = row.reminder_time || '';
    mapped.reactions = row.reactions || '';
    delete mapped.is_completed;
    delete mapped.category_id;
    delete mapped.created_at;
    delete mapped.completed_at;
    delete mapped.updated_at;
    delete mapped.user_id;
    delete mapped.deleted;
    delete mapped.routine_id;
    delete mapped.reminder_time;
  } else if (collection === 'categories') {
    mapped.id = row.$id || mapped.id;
    mapped.userId = mapped.user_id;
    mapped.isDeleted = mapped.deleted ?? false;
    mapped.icon = row.icon || '';
    delete mapped.user_id;
    delete mapped.deleted;
  } else if (collection === 'diary') {
    mapped.id = row.$id || mapped.id;
    mapped.userId = mapped.user_id;
    mapped.isDeleted = mapped.deleted ?? false;
    mapped.createdAt = mapped.created_at || new Date().toISOString();
    mapped.updatedAt = mapped.updated_at || new Date().toISOString();
    mapped.content = row.content || '';
    delete mapped.user_id;
    delete mapped.deleted;
    delete mapped.created_at;
    delete mapped.updated_at;
  } else if (collection === 'settings') {
    mapped.id = row.$id || mapped.id;
    mapped.userId = mapped.user_id;
    mapped.isDeleted = mapped.deleted ?? false;
    delete mapped.user_id;
    delete mapped.deleted;
  } else if (collection === 'friendships') {
    mapped.id = row.$id || mapped.id;
    mapped.userId = mapped.user_id;
    mapped.friendId = mapped.friend_id || '';
    mapped.friendUsername = mapped.friend_username || '';
    mapped.friendDisplayName = mapped.friend_display_name || '';
    mapped.friendAvatarFileId = mapped.friend_avatar_file_id || '';
    mapped.status = mapped.status || 'pending_outgoing';
    mapped.createdAt = mapped.created_at || new Date().toISOString();
    mapped.updatedAt = mapped.updated_at || new Date().toISOString();
    mapped.isDeleted = mapped.deleted ?? false;
    delete mapped.user_id;
    delete mapped.friend_id;
    delete mapped.friend_username;
    delete mapped.friend_display_name;
    delete mapped.friend_avatar_file_id;
    delete mapped.created_at;
    delete mapped.updated_at;
    delete mapped.deleted;
  }

  return mapped;
}

/**
 * Row-level permissions granted to the row's OWNER only.
 *
 * We cannot grant `user:{friendId}` on a friendship row — Appwrite forbids
 * granting roles you don't hold ("Permissions must be one of: (any, users,
 * user:{yourId}, ...)"). Cross-user visibility comes from the table-level
 * `all users` grant configured in the Console.
 *
 * Passing this explicitly (rather than omitting `permissions`) is required:
 * when the key is absent, the SDK serializes it as `[]`, which the server
 * rejects with the same "Permissions must be one of" error.
 */
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
    const user = await account.get();
    return user?.$id || null;
  } catch (err) {
    if (DEBUG) console.log('[Sync] account.get() failed:', err);
    return null;
  }
}

export async function initializeSync(): Promise<void> {
  if (isSyncInProgress) {
    if (DEBUG)
      console.log('[Sync] initializeSync skipped: sync already in progress');
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (DEBUG) console.log('[Sync] Offline, skipping sync');
    updateSyncStatus({ isSyncing: false });
    return;
  }

  isSyncInProgress = true;
  if (DEBUG) console.log('[Sync] Starting initial sync...');
  updateSyncStatus({ isSyncing: true, errors: [] });

  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      if (DEBUG) console.log('[Sync] No authenticated user, skipping sync');
      updateSyncStatus({ isSyncing: false });
      return;
    }

    const db = getDatabase();
    const collections: (keyof AppDatabaseCollections)[] = [
      'tasks',
      'categories',
      'diary',
      'settings',
      'friendships',
    ];

    const collectionErrors: string[] = [];

    for (const colName of collections) {
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
      }
    }

    if (collectionErrors.length === 0) {
      updateSyncStatus({
        isSyncing: false,
        lastSync: new Date().toISOString(),
        errors: [],
      });
      if (DEBUG) console.log('[Sync] ✅ Initial sync complete');
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
  const tableId =
    APPWRITE_CONFIG.tables[colName as keyof typeof APPWRITE_CONFIG.tables];
  if (DEBUG) console.log(`[Sync] Syncing ${colName}...`);

  const lastSyncMs = syncStatus.lastSync
    ? new Date(syncStatus.lastSync).getTime()
    : 0;
  const usesTimestamps = isTimestampedCollection(colName);

  const remoteIndex = new Map<string, { updatedAt: number; isDeleted: boolean }>();
  const justPulled = new Set<string>();

  let cursor: string | undefined = undefined;
  let pageCount = 0;

  for (;;) {
    const queries: unknown[] = [
      Query.equal('user_id', userId),
      Query.limit(PAGE_SIZE),
      Query.orderAsc('$id'),
    ];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const remoteResponse = await tablesDB.listRows({
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
        const isLocalDirty = localLwt > lastSyncMs;
        if (isLocalDirty) continue;

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
      }
    }

    if (rows.length < PAGE_SIZE) break;
    const lastId = rows[rows.length - 1].$id as string | undefined;
    if (!lastId || lastId === cursor) break;
    cursor = lastId;
  }

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
    const isLocalDirty = localLwt > lastSyncMs;

    let shouldPush = false;
    if (!remoteMeta) {
      shouldPush = true;
    } else if (isLocalDirty) {
      shouldPush = true;
    } else if (usesTimestamps) {
      const localUpdatedAt = toMs(json.updatedAt);
      shouldPush = localUpdatedAt > remoteMeta.updatedAt;
    }

    if (!shouldPush) continue;

    const rowData = toAppwriteFormat(json, colName, userId);
    if (DEBUG) console.log(`[Sync] Pushing ${colName} ${docId}`);

    try {
      // Always pass the OWNER's permissions explicitly.
      //
      // - For tasks/categories/diary/settings: this is the standard
      //   user-scoped ACL.
      // - For friendships: the row's `user_id` column points at the
      //   recipient (the friend), while we (the authenticated writer) are
      //   the creator. Granting `user:{userId}` is always allowed because
      //   it's our own role. The friend gains read/update/delete via the
      //   table-level `all users` grant in the Console.
      //
      // Passing `permissions` explicitly is required: an omitted key is
      // serialized by the SDK as `[]`, which the server rejects with
      // "Permissions must be one of: (any, users, user:{yourId}, ...)".
      await tablesDB.upsertRow({
        databaseId: APPWRITE_CONFIG.databaseId,
        tableId,
        rowId: docId,
        data: rowData,
        permissions: buildRowPermissions(userId),
      });
    } catch (upsertError) {
      console.error(`[Sync] Failed to upsert ${colName} ${docId}:`, upsertError);
      throw upsertError;
    }
  }

  if (DEBUG)
    console.log(`[Sync] ✅ ${colName} synced (${pageCount} page(s) pulled)`);
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

function handleWindowFocus() {
  safeForceSync('Window focused');
}
function handleOnline() {
  safeForceSync('Connection restored');
}
function handleVisibilityChange() {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    safeForceSync('App became visible');
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