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

function toAppwriteFormat(doc: any, collection: string): Record<string, any> {
  const mapped: Record<string, any> = {};
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
    mapped.completed_at = doc.completedAt || null;
    mapped.updated_at = doc.updatedAt || new Date().toISOString();
    mapped.user_id = doc.userId || CURRENT_USER_ID;
    mapped.deleted = doc.isDeleted ?? false;
    mapped.visibility = doc.visibility || 'private';
    mapped.source = doc.source || '';
    mapped.routine_id = doc.routineId || '';
    mapped.reminder_time = doc.reminderTime || '';
    mapped.reactions = doc.reactions || '';
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

function fromAppwriteFormat(row: any, collection: string): Record<string, any> {
  const mapped: Record<string, any> = { ...row };
  
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
    mapped.completedAt = mapped.completed_at || ''; // FIX: Prevent null to satisfy RxDB schema
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
  body?: any,
  rowId?: string
) {
  const url = `${APPWRITE_CONFIG.endpoint}/v1/tablesdb/${APPWRITE_CONFIG.databaseId}/tables/${table}/rows${rowId ? `/${rowId}` : ''}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
  };
  const options: RequestInit = { method, headers };

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
        errorMessage += `: ${jsonError.message || errorText}`;
      } catch {
        errorMessage += `: ${errorText}`;
      }
      throw new Error(errorMessage);
    }
    return res.json();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Appwrite API Error')) {
      throw error;
    }
    throw new Error(`Network error during Appwrite sync: ${error instanceof Error ? error.message : 'Unknown network error'}`);
  }
}

export async function initializeSync(): Promise<void> {
  if (DEBUG) console.log('[Sync] Starting initial sync...');
  updateSyncStatus({ isSyncing: true, errors: [] });

  try {
    const db = getDatabase();
    const collections: (keyof AppDatabaseCollections)[] = ['tasks', 'categories', 'diary', 'settings'];

    for (const colName of collections) {
      await syncCollection(db[colName], colName);
    }

    updateSyncStatus({ isSyncing: false, lastSync: new Date().toISOString() });
    if (DEBUG) console.log('[Sync] ✅ Initial sync complete');
  } catch (error) {
    console.error('[Sync] ❌ Sync failed', error);
    updateSyncStatus({
      isSyncing: false,
      errors: [...syncStatus.errors, error instanceof Error ? error.message : 'Unknown error']
    });
  }
}

async function syncCollection(collection: any, colName: string) {
  const tableId = APPWRITE_CONFIG.tables[colName as keyof typeof APPWRITE_CONFIG.tables];
  if (DEBUG) console.log(`[Sync] Syncing ${colName}...`);

  try {
    const remoteData = await appwriteFetch(tableId, 'GET');
    const rows = remoteData.rows || [];
    if (DEBUG) console.log(`[Sync] Pulled ${rows.length} rows from ${tableId}`);

    for (const row of rows) {
      const doc = fromAppwriteFormat(row, colName);
      await collection.upsert(doc);
    }

    const localDocs = await collection.find().exec();
    for (const doc of localDocs) {
      const rowData = toAppwriteFormat(doc.toJSON(), colName);
      const remotePayload = {
        data: rowData,
        permissions: ['read("any")', 'update("any")', 'delete("any")', 'write("any")']
      };
      if (DEBUG) console.log(`[Sync] Pushing ${colName} ${doc.id}:`, remotePayload);
      try {
        await appwriteFetch(tableId, 'PATCH', remotePayload, doc.id);
      } catch (patchError) {
        try {
          await appwriteFetch(tableId, 'PUT', remotePayload, doc.id);
        } catch (upsertError) {
          console.error(`[Sync] Failed to upsert ${colName} ${doc.id}:`, upsertError);
        }
      }
    }
    if (DEBUG) console.log(`[Sync] ✅ ${colName} synced`);
  } catch (error) {
    console.error(`[Sync] Error syncing ${colName}`, error);
    throw error;
  }
}

export async function forceSync() {
  if (DEBUG) console.log('[Sync] Force sync triggered');
  await initializeSync();
}

if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    try {
      getDatabase();
      if (DEBUG) console.log('[Sync] Window focused, syncing...');
      forceSync().catch(e => console.error('[Sync] Focus sync failed', e));
    } catch {
      // Database not initialized yet
    }
  });
}