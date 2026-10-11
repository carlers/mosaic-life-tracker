const CONFLICT_PREFIX = 'mosaic_shared_completion_conflict_';
const CONFLICT_NOTICE = 'A task changed on another device before your completion synced. Review its current state before retrying.';

export function recordCompletionConflict(userId: string): void {
  if (!userId) return;
  try {
    localStorage.setItem(CONFLICT_PREFIX + userId, '1');
  } catch {
    // Still display the conflict for the active account.
  }
  if (ownerId === userId) publishSyncStatus({ notice: CONFLICT_NOTICE });
}

export function acknowledgeCompletionConflict(userId: string): void {
  try { localStorage.removeItem(CONFLICT_PREFIX + userId); } catch { /* no storage */ }
  if (ownerId === userId && status.notice === CONFLICT_NOTICE) publishSyncStatus({ notice: null });
}

export interface SyncProgress {
  completed: number;
  total: number;
  percent: number;
  label: string;
  pendingGroups?: string[];
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSync: string | null;
  errors: string[];
  notice?: string | null;
  progress?: SyncProgress | null;
}

let status: SyncStatus = {
  isSyncing: false,
  lastSync: null,
  errors: [],
  notice: null,
  progress: null,
};
let ownerId: string | null = null;

type SyncListener = (status: SyncStatus) => void;
const listeners = new Set<SyncListener>();

export function getSyncStatus(): SyncStatus {
  return status;
}

export function scopeSyncStatusToUser(userId: string | null): void {
  if (ownerId === userId) return;
  ownerId = userId;
  let lastSync: string | null = null;
  if (userId && typeof localStorage !== 'undefined') {
    try {
      lastSync = localStorage.getItem(`lastSyncTime_${userId}`);
    } catch {
      lastSync = null;
    }
  }
  status = {
    isSyncing: false,
    lastSync,
    errors: [],
    notice: userId && (() => {
      try { return localStorage.getItem(CONFLICT_PREFIX + userId) ? CONFLICT_NOTICE : null; }
      catch { return null; }
    })(),
    progress: null,
  };
  for (const listener of listeners) {
    try {
      listener(status);
    } catch (error) {
      console.error('[Sync] Status listener threw:', error);
    }
  }
}

export function publishSyncStatus(updates: Partial<SyncStatus>): SyncStatus {
  status = { ...status, ...updates };
  for (const listener of listeners) {
    try {
      listener(status);
    } catch (error) {
      console.error('[Sync] Status listener threw:', error);
    }
  }
  return status;
}

export function subscribeToSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  try {
    listener(status);
  } catch (error) {
    console.error('[Sync] Status listener threw on subscribe:', error);
  }
  return () => listeners.delete(listener);
}

export function resetSyncStatusForTests(): void {
  ownerId = null;
  status = {
    isSyncing: false,
    lastSync: null,
    errors: [],
    notice: null,
    progress: null,
  };
  listeners.clear();
}
