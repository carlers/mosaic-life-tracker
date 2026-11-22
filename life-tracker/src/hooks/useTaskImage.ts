import { useState, useEffect, type RefObject } from 'react';
import { getLocalImageUrl } from '../lib/storage';

interface ImageState {
  url: string | null;
  isLoading: boolean;
}

interface CacheEntry {
  url: string | null;
  promise: Promise<string | null> | null;
  refCount: number;
  revokeTimer: ReturnType<typeof setTimeout> | null;
  controller: AbortController | null;
  generation: number;
}

const objectUrlCache = new Map<string, CacheEntry>();
// Keep only small Calendar previews warm across rapid reversals, never a large
// unbounded collection of full-resolution image bitmaps.
const REVOKE_DELAY_MS = 1500;
const CALENDAR_REVOKE_DELAY_MS = 30000;
const MAX_IDLE_CALENDAR_URLS = 24;
const idleCalendarUrls = new Map<string, CacheEntry>();

function cachedKey(fileId: string, calendar: boolean): string {
  return calendar ? `calendar:${fileId}` : fileId;
}
function readCachedUrl(fileId: string | undefined, calendar: boolean): string | null {
  return fileId ? objectUrlCache.get(cachedKey(fileId, calendar))?.url ?? null : null;
}
function revokeEntry(key: string, entry: CacheEntry): void {
  if (entry.revokeTimer) clearTimeout(entry.revokeTimer);
  entry.revokeTimer = null;
  if (entry.refCount > 0) return;
  idleCalendarUrls.delete(key);
  if (entry.url) URL.revokeObjectURL(entry.url);
  if (objectUrlCache.get(key) === entry) objectUrlCache.delete(key);
}
function scheduleEviction(key: string, entry: CacheEntry): void {
  if (entry.revokeTimer) clearTimeout(entry.revokeTimer);
  if (key.startsWith('calendar:')) {
    idleCalendarUrls.delete(key);
    idleCalendarUrls.set(key, entry);
    while (idleCalendarUrls.size > MAX_IDLE_CALENDAR_URLS) {
      const oldestKey = idleCalendarUrls.keys().next().value;
      if (!oldestKey) break;
      const oldest = idleCalendarUrls.get(oldestKey);
      if (oldest) revokeEntry(oldestKey, oldest);
    }
  }
  entry.revokeTimer = setTimeout(() => revokeEntry(key, entry),
    key.startsWith('calendar:') ? CALENDAR_REVOKE_DELAY_MS : REVOKE_DELAY_MS);
}

function acquireObjectUrl(
  fileId: string, refreshFromCloud = false,
  calendarRef?: RefObject<HTMLElement | null>,
): { promise: Promise<string | null>; release: () => void } {
  const key = cachedKey(fileId, Boolean(calendarRef));
  let entry = objectUrlCache.get(key);
  if (refreshFromCloud && entry) {
    objectUrlCache.delete(key);
    idleCalendarUrls.delete(key);
    entry = undefined;
  }
  if (!entry) {
    entry = {
      url: null, promise: null, refCount: 0, revokeTimer: null,
      controller: null, generation: 0,
    };
    objectUrlCache.set(key, entry);
  }
  const e = entry;
  if (e.revokeTimer) clearTimeout(e.revokeTimer);
  e.revokeTimer = null;
  idleCalendarUrls.delete(key);
  e.refCount++;
  // An unmounted Calendar gate can abandon a queued request. An immediate
  // reverse swipe must create a fresh request instead of inheriting its abort.
  if (e.controller?.signal.aborted && !e.url) {
    e.controller = null;
    e.promise = null;
  }
  if (!e.promise) {
    const generation = ++e.generation;
    const controller = calendarRef ? new AbortController() : null;
    e.controller = controller;
    const source = calendarRef
      ? import('../lib/calendarPhotoPreview').then(m =>
          m.requestCalendarPreview(fileId, refreshFromCloud, calendarRef.current, controller!.signal))
      : (refreshFromCloud ? getLocalImageUrl(fileId, true) : getLocalImageUrl(fileId));
    e.promise = source.catch(error => {
      console.error('[useTaskImage] Failed to acquire image:', error);
      return null;
    }).then(url => {
      if (objectUrlCache.get(key) !== e || e.generation !== generation) {
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
      // In-flight Appwrite requests may finish, but an unreferenced Calendar
      // image does not need decoding or publication in an outgoing month.
      if (!e.url) e.controller?.abort();
      scheduleEviction(key, e);
    }
  };
  return { promise: e.promise, release };
}

// Test-only escape hatch. The module-level `objectUrlCache` persists across
// test files in the same worker, which can cause confusing cross-test state
// if two tests happen to use the same fileId. Calling this in `beforeEach`
// gives each test a clean slate. Production code never calls this.
export function resetTaskImageCacheForTests(): void {
  for (const entry of objectUrlCache.values()) {
    entry.controller?.abort();
    if (entry.revokeTimer) {
      clearTimeout(entry.revokeTimer);
      entry.revokeTimer = null;
    }
    if (entry.url) {
      URL.revokeObjectURL(entry.url);
    }
  }
  objectUrlCache.clear();
  idleCalendarUrls.clear();
}

export function useTaskImage(
  fileId: string | undefined, enabled = true,
  calendarRef?: RefObject<HTMLElement | null>,
) {
  const isCalendar = Boolean(calendarRef);
  const [tracked, setTracked] = useState({ fileId, enabled, isCalendar });
  const [revision, setRevision] = useState({ fileId, count: 0 });
  const [state, setState] = useState<ImageState>(() => {
    const cached = readCachedUrl(fileId, isCalendar);
    return { url: cached, isLoading: enabled && !cached && !!fileId };
  });

  if (fileId !== tracked.fileId || enabled !== tracked.enabled || isCalendar !== tracked.isCalendar) {
    setTracked({ fileId, enabled, isCalendar });
    if (fileId !== tracked.fileId) setRevision({ fileId, count: 0 });
    const cached = readCachedUrl(fileId, isCalendar);
    setState({ url: cached, isLoading: enabled && !cached && !!fileId });
  }

  useEffect(() => {
    if (!fileId || !enabled) return;
    let active = true;
    let failed = false;
    let release = () => {};
    let cancelResume = () => {};
    const load = () => {
      failed = false;
      release();
      cancelResume();
      const acquired = acquireObjectUrl(
        fileId, revision.fileId === fileId && revision.count > 0, calendarRef,
      );
      release = acquired.release;
      acquired.promise.then((url) => {
        if (!active) return;
        failed = !url;
        const show = () => {
          if (active) setState({ url, isLoading: false });
        };
        const calendar = calendarRef?.current?.closest<HTMLElement>(
          '[data-route-swipe-horizontal-owner="true"]'
        );
        if (calendar?.dataset.calendarMediaPaused === 'true') {
          calendar.addEventListener('mosaic-calendar-media-resume', show, { once: true });
          cancelResume = () => calendar.removeEventListener('mosaic-calendar-media-resume', show);
        } else {
          show();
        }
      });
    };
    const retry = () => {
      if (failed && !document.hidden) load();
    };
    load();
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    return () => {
      active = false;
      cancelResume();
      release();
      window.removeEventListener('online', retry);
      window.removeEventListener('focus', retry);
    };
  }, [fileId, enabled, revision, calendarRef]);

  const retryImage = () => {
    setState({ url: null, isLoading: true });
    setRevision((value) => ({ fileId, count: value.fileId === fileId ? value.count + 1 : 1 }));
  };
  const handleImageError = () => {
    if (revision.fileId === fileId && revision.count > 0) {
      setState({ url: null, isLoading: false });
    } else {
      retryImage();
    }
  };
  return { imageUrl: state.url, isLoading: state.isLoading, retryImage, handleImageError };
}
