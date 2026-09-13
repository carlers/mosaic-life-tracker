import type { TaskDocument, CategoryDocument } from '../db/schema';

const DB_NAME = 'mosaic_friend_cache';
const STORE_NAME = 'calendars';
const DB_VERSION = 1;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

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

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedCalendar(
  friendUserId: string
): Promise<FriendCalendarBundle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(friendUserId);
      req.onsuccess = () => {
        const entry = req.result as CachedEntry | undefined;
        if (!entry) return resolve(null);
        if (Date.now() - entry.cachedAt > TTL_MS) return resolve(null);
        resolve(entry.bundle);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[friendCache] read failed:', err);
    return null;
  }
}

export async function setCachedCalendar(
  bundle: FriendCalendarBundle
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const entry: CachedEntry = { bundle, cachedAt: Date.now() };
      const req = store.put(entry, bundle.friendUserId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[friendCache] write failed:', err);
  }
}

export async function clearCachedCalendar(friendUserId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(friendUserId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[friendCache] delete failed:', err);
  }
}

export async function clearAllFriendCaches(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[friendCache] clear failed:', err);
  }
}