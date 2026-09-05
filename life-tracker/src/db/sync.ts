import { getDatabase, type AppDatabaseCollections } from './database';

// ============================================================================
// CONFIGURATION
// ============================================================================

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

// ============================================================================
// SYNC STATE
// ============================================================================

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

// ============================================================================
// FIELD MAPPING HELPERS
// ============================================================================

function toAppwriteFormat(doc: any, collection: string): Record<string, any> {
  const mapped: Record<string, any> = { ...doc };
  
  if (collection === 'tasks') {
    mapped.is_completed = mapped.completed;
    mapped.category_id = mapped.categoryId;
    mapped.created_at = mapped.createdAt;
    mapped.completed_at = mapped.completedAt;
    mapped.updated_at = mapped.updatedAt;
    mapped.user_id = mapped.userId;
    mapped.deleted = mapped.isDeleted;
    
    delete mapped.completed; delete mapped.categoryId; delete mapped.createdAt;
    delete mapped.completedAt; delete mapped.updatedAt; delete mapped.userId;
    delete mapped.isDeleted;
  } else if (collection === 'categories' || collection === 'diary' || collection === 'settings') {
    mapped.user_id = mapped.userId;
    mapped.deleted = mapped.isDeleted;
    
    if (collection === 'diary') {
      mapped.created_at = mapped.createdAt;
      mapped.updated_at = mapped.updatedAt;
      delete mapped.createdAt; delete mapped.updatedAt;
    }
    delete mapped.userId; delete mapped.isDeleted;
  }
  
  return mapped;
}

function fromAppwriteFormat(row: any, collection: string): Record<string, any> {
  const mapped: Record<string, any> = { ...row };
  
  if (collection === 'tasks') {
    mapped.completed = mapped.is_completed;
    mapped.categoryId = mapped.category_id;
    mapped.createdAt = mapped.created_at;
    mapped.completedAt = mapped.completed_at;
    mapped.updatedAt = mapped.updated_at;
    mapped.userId = mapped.user_id;
    mapped.isDeleted = mapped.deleted;
    
    delete mapped.is_completed; delete mapped.category_id; delete mapped.created_at;
    delete mapped.completed_at; delete mapped.updated_at; delete mapped.user_id;
    delete mapped.deleted;
  } else if (collection === 'categories' || collection === 'diary' || collection === 'settings') {
    mapped.userId = mapped.user_id;
    mapped.isDeleted = mapped.deleted;
    
    if (collection === 'diary') {
      mapped.createdAt = mapped.created_at;
      mapped.updatedAt = mapped.updated_at;
      delete mapped.created_at; delete mapped.updated_at;
    }
    delete mapped.user_id; delete mapped.deleted;
  }
  
  return mapped;
}

// ============================================================================
// REST API HELPERS
// ============================================================================

async function appwriteFetch(
  table: string, 
  method: 'GET' | 'POST' | 'PATCH', 
  body?: any,
  rowId?: string
) {
  const url = `${APPWRITE_CONFIG.endpoint}/v1/tablesdb/${APPWRITE_CONFIG.databaseId}/tables/${table}/rows${rowId ? `/${rowId}` : ''}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
  };

  const options: RequestInit = { method, headers };
  if (body) options.body = JSON.stringify(body);

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

// ============================================================================
// SYNC LOGIC
// ============================================================================

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
    console.error('[Sync]  Sync failed', error);
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
    // 1. PULL: Get remote changes
    const remoteData = await appwriteFetch(tableId, 'GET');
    const rows = remoteData.rows || [];
    
    if (DEBUG) console.log(`[Sync] Pulled ${rows.length} rows from ${tableId}`);

    for (const row of rows) {
      const doc = fromAppwriteFormat(row, colName);
      await collection.upsert(doc);
    }

    // 2. PUSH: Send local changes to remote
    const localDocs = await collection.find().exec();
    for (const doc of localDocs) {
      const remotePayload = toAppwriteFormat(doc.toJSON(), colName);
      
      try {
        await appwriteFetch(tableId, 'PATCH', remotePayload, doc.id);
      } catch {
        try {
          await appwriteFetch(tableId, 'POST', remotePayload);
        } catch (createError) {
          console.warn(`[Sync] Failed to push ${colName} ${doc.id}`, createError);
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

// Auto-sync on window focus
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