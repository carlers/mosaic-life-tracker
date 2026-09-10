import { getDatabase, type AppDatabaseCollections } from './database';

const APPWRITE_CONFIG = {
  endpoint: 'https://sgp.cloud.appwrite.io',
  projectId: '6a9703c50016b37110ff',
  databaseId: 'life_tracker',
  tables: {
    tasks: 'tasks',
    categories: 'categories',
    diary: 'diary',
    settings: 'settings',
  },
} as const;

export const CURRENT_USER_ID = 'user1';

const DEBUG = import.meta.env.DEV;

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
  listeners.forEach(l => l(syncStatus));
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
  patch: (data: Record<string, unknown>) => Promise<unknown>;
};
type LocalCollection = {
  findOne: (id: string) => { exec: () => Promise<LocalDoc | null> };
  find: () => { exec: () => Promise<LocalDoc[]> };
  upsert: (doc: Record<string, unknown>) => Promise<unknown>;
};

// --- Module-level guards against concurrent / duplicate sync activity ---
let isSyncInProgress = false;
let activeSyncController: AbortController | null = null;

declare global {
  interface Window {
    __mosaicFocusSyncAttached?: boolean;
  }
}

function makeAbortError(): Error {
  const err = new Error('Sync aborted');
  err.name = 'AbortError';
  return err;
}

function toAppwriteFormat(doc: Record<string, unknown>, collection: string): AppwritePayload {
  const mapped: AppwritePayload = {};
  delete doc._meta;
  delete doc._deleted;
  delete doc._rev;
  if (collection === 'tasks') {
    mapped.title = doc.title || '';
    mapped.is_completed = doc.completed ?? false;
    mapped.category_id = doc.categoryId || '';
    mapped.tags = doc.tags || '';
    mapped.date = doc.date || '';
    mapped.memo = doc.memo || '';
    mapped.image = doc.image || '';
    mapped.created_at = doc.createdAt || new Date().toISOString();
    mapped.completed_at = doc.completedAt || '';
    mapped.updated_at = doc.updatedAt || new Date().toISOString();
    mapped.user_id = doc.userId || CURRENT_USER_ID;
    mapped.deleted = doc.isDeleted ?? false;
    mapped.visibility = doc.visibility || 'private';
  } else if (collection === 'categories') {
    mapped.name = doc.name || '';
    mapped.color = doc.color || '#3B82F6';
    mapped.visibility = doc.visibility || 'private';
    mapped.order = doc.order ?? 0;
    mapped.user_id = doc.userId || CURRENT_USER_ID;
    mapped.deleted = doc.isDeleted ?? false;
    mapped.icon = doc.icon || '';
  } else if (collection === 'diary') {
    mapped.date = doc.date || '';
    mapped.content = doc.content || '';
    mapped.visibility = doc.visibility || 'private';
    mapped.user_id = doc.userId || CURRENT_USER_ID;
    mapped.deleted = doc.isDeleted ?? false;
    mapped.created_at = doc.createdAt || new Date().toISOString();
    mapped.updated_at = doc.updatedAt || new Date().toISOString();
  } else if (collection === 'settings') {
    mapped.user_id = doc.userId || CURRENT_USER_ID;
    mapped.key = doc.key || '';
    mapped.value = doc.value || '';
    mapped.deleted = doc.isDeleted ?? false;
  }
  return mapped;
}

function fromAppwriteFormat(row: AppwriteRow, collection: string): Record<string, unknown> {
  const mapped: Record<string, unknown> = { ...row };
  delete mapped.$id;
  delete mapped.$createdAt;
  delete mapped.$updatedAt;
  delete mapped.$permissions;
  delete mapped.$databaseId;
  delete mapped.$collectionId;
  delete mapped.$sequence;
  delete mapped.$tableId;
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
  }
  return mapped;
}

async function appwriteFetch(
  table: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT',
  body?: AppwritePayload,
  rowId?: string,
  signal?: AbortSignal
) {
  const url = `${APPWRITE_CONFIG.endpoint}/v1/tablesdb/${APPWRITE_CONFIG.databaseId}/tables/${table}/rows${rowId ? `/${rowId}` : ''}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
  };
  const options: RequestInit = { method, headers, credentials: 'include' };
  if (signal) options.signal = signal;
  if (body && Object.keys(body).length > 0) {
    options.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errorText = await res.text();
      let errorMessage = `Appwrite API Error (${res.status})`;
      try {
        const jsonError = JSON.parse(errorText);
        errorMessage += `: ${jsonError.message || JSON.stringify(jsonError)}`;
      } catch {
        errorMessage += `: ${errorText}`;
      }
      console.error(`[Sync] ❌ ${method} ${url} failed:`, errorMessage);
      throw new Error(errorMessage);
    }
    return res.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith('Appwrite API Error')) {
      throw error;
    }
    throw new Error(
      `Network error during Appwrite sync: ${error instanceof Error ? error.message : 'Unknown network error'}`,
      { cause: error }
    );
  }
}

export async function initializeSync(): Promise<void> {
  if (isSyncInProgress) {
    if (DEBUG) console.log('[Sync] initializeSync skipped: sync already in progress');
    return;
  }
  isSyncInProgress = true;
  if (DEBUG) console.log('[Sync] Starting initial sync...');
  updateSyncStatus({ isSyncing: true, errors: [] });

  const controller = new AbortController();
  activeSyncController = controller;

  try {
    const db = getDatabase();
    const collections: (keyof AppDatabaseCollections)[] = ['tasks', 'categories', 'diary', 'settings'];
    for (const colName of collections) {
      if (controller.signal.aborted) throw makeAbortError();
      await syncCollection(db[colName] as unknown as LocalCollection, colName, controller.signal);
    }
    updateSyncStatus({ isSyncing: false, lastSync: new Date().toISOString() });
    if (DEBUG) console.log('[Sync] ✅ Initial sync complete');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (DEBUG) console.log('[Sync] Sync aborted');
      return;
    }
    console.error('[Sync] ❌ Sync failed', error);
    updateSyncStatus({
      isSyncing: false,
      errors: [...syncStatus.errors, error instanceof Error ? error.message : 'Unknown error']
    });
  } finally {
    if (activeSyncController === controller) {
      activeSyncController = null;
    }
    isSyncInProgress = false;
  }
}

async function syncCollection(collection: LocalCollection, colName: string, signal: AbortSignal) {
  const tableId = APPWRITE_CONFIG.tables[colName as keyof typeof APPWRITE_CONFIG.tables];
  if (DEBUG) console.log(`[Sync] Syncing ${colName}...`);
  try {
    const remoteData = await appwriteFetch(tableId, 'GET', undefined, undefined, signal);
    const rows: AppwriteRow[] = remoteData.rows || [];
    if (DEBUG) console.log(`[Sync] Pulled ${rows.length} rows from ${tableId}`);

    for (const row of rows) {
      if (signal.aborted) throw makeAbortError();
      const doc = fromAppwriteFormat(row, colName);
      const docId = doc.id as string;
      const localDoc = await collection.findOne(docId).exec();
      if (localDoc) {
        const localLwt = localDoc._meta?.lwt || 0;
        const remoteLwt = row.$updatedAt ? new Date(row.$updatedAt as string).getTime() : 0;
        if (remoteLwt > localLwt) {
          await collection.upsert(doc);
        } else {
          if (DEBUG) console.log(`[Sync] Skipping remote overwrite for ${docId} (local is newer)`);
        }
      } else {
        await collection.upsert(doc);
      }
    }

    const localDocs = await collection.find().exec();
    for (const doc of localDocs) {
      if (signal.aborted) throw makeAbortError();
      const rowData = toAppwriteFormat(doc.toJSON(), colName);
      const remotePayload = {
        data: rowData,
        permissions: ['read("any")', 'update("any")', 'delete("any")']
      };
      if (DEBUG) console.log(`[Sync] Pushing ${colName} ${doc.id}`);
      try {
        await appwriteFetch(tableId, 'PATCH', remotePayload, doc.id, signal);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err;
        try {
          await appwriteFetch(tableId, 'PUT', remotePayload, doc.id, signal);
        } catch (upsertError) {
          if (upsertError instanceof Error && upsertError.name === 'AbortError') throw upsertError;
          console.error(`[Sync] Failed to upsert ${colName} ${doc.id}:`, upsertError);
        }
      }
    }
    if (DEBUG) console.log(`[Sync] ✅ ${colName} synced`);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    console.error(`[Sync] Error syncing ${colName}`, error);
    throw error;
  }
}

export async function forceSync() {
  if (DEBUG) console.log('[Sync] Force sync triggered');
  await initializeSync();
}

function handleWindowFocus() {
  try {
    getDatabase();
    if (DEBUG) console.log('[Sync] Window focused, syncing...');
    forceSync().catch(e => console.error('[Sync] Focus sync failed', e));
  } catch {
    // Database not yet initialized; bootstrap will trigger initial sync
  }
}

if (typeof window !== 'undefined' && !window.__mosaicFocusSyncAttached) {
  window.__mosaicFocusSyncAttached = true;
  window.addEventListener('focus', handleWindowFocus);
}