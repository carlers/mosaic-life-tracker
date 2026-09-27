import type { TaskDocument, CategoryDocument } from '../db/schema';

const DB_NAME = 'mosaic_friend_cache';
const STORE_NAME = 'calendars';
const DB_VERSION = 2;
const TTL_MS = 5 * 60 * 1000;

export interface FriendCalendarBundle {
  friendUserId: string;
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  fetchedAt: string;
}

interface CachedEntry {
  bundle: FriendCalendarBundle;
  cachedAt: number;
}

function cacheKey(ownerUserId: string, friendUserId: string): string {
  return `${ownerUserId}::${friendUserId}`;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      } else if ((event.oldVersion ?? 0) < 2) {
        // v1 keys were friend-only and could cross account boundaries.
        request.transaction?.objectStore(STORE_NAME).clear();
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedCalendar(
  ownerUserId: string,
  friendUserId: string,
  options: { allowStale?: boolean } = {}
): Promise<FriendCalendarBundle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(cacheKey(ownerUserId, friendUserId));
      req.onsuccess = () => {
        const entry = req.result as CachedEntry | undefined;
        if (!entry) return resolve(null);
        const stale = Date.now() - entry.cachedAt > TTL_MS;
        if (stale && !options.allowStale) return resolve(null);
        resolve(entry.bundle);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('[friendCache] read failed:', error);
    return null;
  }
}

export async function setCachedCalendar(
  ownerUserId: string,
  bundle: FriendCalendarBundle
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const entry: CachedEntry = { bundle, cachedAt: Date.now() };
      const req = tx
        .objectStore(STORE_NAME)
        .put(entry, cacheKey(ownerUserId, bundle.friendUserId));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('[friendCache] write failed:', error);
  }
}

export async function clearCachedCalendar(
  ownerUserId: string,
  friendUserId: string
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx
        .objectStore(STORE_NAME)
        .delete(cacheKey(ownerUserId, friendUserId));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('[friendCache] delete failed:', error);
  }
}

export async function clearAllFriendCaches(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('[friendCache] clear failed:', error);
  }
}

export async function patchCachedCalendarTask(
  ownerUserId: string,
  friendUserId: string,
  taskId: string,
  updates: Partial<TaskDocument>
): Promise<void> {
  try {
    const bundle = await getCachedCalendar(ownerUserId, friendUserId, {
      allowStale: true,
    });
    if (!bundle) return;
    const nextTasks = bundle.tasks.map((task) =>
      task.id === taskId ? { ...task, ...updates } : task
    );
    await setCachedCalendar(ownerUserId, { ...bundle, tasks: nextTasks });
  } catch (error) {
    console.warn('[friendCache] patch failed:', error);
  }
}
