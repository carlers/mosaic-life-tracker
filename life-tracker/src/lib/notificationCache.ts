import type { NotificationItem } from './notifications';
import type { TaskDocument } from '../db/schema';
import { activeNotifications } from './notificationRetention';

const DB_NAME = 'mosaic_notifications_cache';
const STORE_NAME = 'feeds';
const DB_VERSION = 1;
const MAX_CACHED_ITEMS = 100;

export interface CachedNotificationFeed {
  items: NotificationItem[];
  nextCursor: string;
  fetchedAt: string;
}

interface CacheEntry {
  feed: CachedNotificationFeed;
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

export async function getCachedNotifications(
  userId: string
): Promise<CachedNotificationFeed | null> {
  if (!userId) return null;
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(userId);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        resolve(entry?.feed
          ? { ...entry.feed, items: activeNotifications(entry.feed.items) }
          : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[notificationCache] read failed:', error);
    return null;
  }
}

export async function setCachedNotifications(
  userId: string,
  feed: CachedNotificationFeed
): Promise<void> {
  if (!userId) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const request = tx.objectStore(STORE_NAME).put(
        {
          feed: {
            ...feed,
            items: activeNotifications(feed.items).slice(0, MAX_CACHED_ITEMS),
          },
          cachedAt: Date.now(),
        } satisfies CacheEntry,
        userId
      );
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[notificationCache] write failed:', error);
  }
}

export async function patchCachedNotificationTask(
  userId: string,
  taskId: string,
  updates: Partial<TaskDocument>
): Promise<void> {
  const cached = await getCachedNotifications(userId);
  if (!cached) return;
  await setCachedNotifications(userId, {
    ...cached,
    items: cached.items.map((item) =>
      item.task.id === taskId
        ? { ...item, task: { ...item.task, ...updates } }
        : item
    ),
  });
}

export async function markCachedNotificationsRead(
  userId: string,
  ids: string[],
  readAt: string
): Promise<void> {
  const cached = await getCachedNotifications(userId);
  if (!cached) return;
  const selected = new Set(ids);
  await setCachedNotifications(userId, {
    ...cached,
    items: cached.items.map((item) =>
      selected.has(item.id) && !item.readAt ? { ...item, readAt } : item
    ),
  });
}
