import type { RefObject } from 'react';
import { getLocalImageUrl } from './storage';

export interface TaskImageLeaseEntry {
  url: string | null;
  promise: Promise<string | null> | null;
  refCount: number;
  revokeTimer: ReturnType<typeof setTimeout> | null;
  controller: AbortController | null;
  generation: number;
}

const REVOKE_DELAY_MS = 1500;
const CALENDAR_REVOKE_DELAY_MS = 30000;
const MAX_IDLE_CALENDAR_URLS = 24;

function revokeEntry(
  key: string, entry: TaskImageLeaseEntry,
  cache: Map<string, TaskImageLeaseEntry>,
  idle: Map<string, TaskImageLeaseEntry>,
): void {
  if (entry.revokeTimer) clearTimeout(entry.revokeTimer);
  entry.revokeTimer = null;
  if (entry.refCount > 0) return;
  idle.delete(key);
  if (entry.url) URL.revokeObjectURL(entry.url);
  if (cache.get(key) === entry) cache.delete(key);
}

function scheduleEviction(
  key: string, entry: TaskImageLeaseEntry,
  cache: Map<string, TaskImageLeaseEntry>,
  idle: Map<string, TaskImageLeaseEntry>,
): void {
  if (entry.revokeTimer) clearTimeout(entry.revokeTimer);
  if (key.startsWith('calendar:')) {
    idle.delete(key);
    idle.set(key, entry);
    while (idle.size > MAX_IDLE_CALENDAR_URLS) {
      const oldestKey = idle.keys().next().value;
      if (!oldestKey) break;
      const oldest = idle.get(oldestKey);
      if (oldest) revokeEntry(oldestKey, oldest, cache, idle);
    }
  }
  entry.revokeTimer = setTimeout(() => revokeEntry(key, entry, cache, idle),
    key.startsWith('calendar:') ? CALENDAR_REVOKE_DELAY_MS : REVOKE_DELAY_MS);
}

export function acquireTaskImageUrl(
  cache: Map<string, TaskImageLeaseEntry>,
  idle: Map<string, TaskImageLeaseEntry>,
  fileId: string, refreshFromCloud = false,
  calendarRef?: RefObject<HTMLElement | null>,
): { promise: Promise<string | null>; release: () => void } {
  const key = calendarRef ? `calendar:${fileId}` : fileId;
  let entry = cache.get(key);
  if (refreshFromCloud && entry) {
    cache.delete(key);
    idle.delete(key);
    entry = undefined;
  }
  if (!entry) {
    entry = {
      url: null, promise: null, refCount: 0, revokeTimer: null,
      controller: null, generation: 0,
    };
    cache.set(key, entry);
  }
  const e = entry;
  if (e.revokeTimer) clearTimeout(e.revokeTimer);
  e.revokeTimer = null;
  idle.delete(key);
  e.refCount++;
  if (e.controller?.signal.aborted && !e.url) {
    e.controller = null;
    e.promise = null;
  }
  if (!e.promise) {
    const generation = ++e.generation;
    const controller = calendarRef ? new AbortController() : null;
    e.controller = controller;
    const source = calendarRef
      ? import('./calendarPhotoPreview').then(m =>
          m.requestCalendarPreview(fileId, refreshFromCloud, calendarRef.current, controller!.signal))
      : (refreshFromCloud ? getLocalImageUrl(fileId, true) : getLocalImageUrl(fileId));
    e.promise = source.catch(error => {
      console.error('[useTaskImage] Failed to acquire image:', error);
      return null;
    }).then(url => {
      if (cache.get(key) !== e || e.generation !== generation || controller?.signal.aborted) {
        if (url) URL.revokeObjectURL(url);
        return null;
      }
      e.url = url;
      e.controller = null;
      if (!url) e.promise = null;
      return url;
    });
  }
  const release = () => {
    e.refCount--;
    if (e.refCount <= 0) {
      if (!e.url) e.controller?.abort();
      scheduleEviction(key, e, cache, idle);
    }
  };
  return { promise: e.promise, release };
}
