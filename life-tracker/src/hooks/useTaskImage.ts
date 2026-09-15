import { useState, useEffect } from 'react';
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
}

// Module-level cache of object URLs keyed by fileId. Multiple hook
// instances for the same fileId (a task whose date appears in the
// leading/trailing days of two adjacent month slides, a day sheet and
// its calendar cell rendered simultaneously, etc.) share one IndexedDB
// read and one object URL instead of each mounting their own. Revoke is
// deferred by REVOKE_DELAY_MS so a quick unmount/remount — React
// StrictMode double-mount, Month↔Week toggle, sheet open/close, slide
// re-entering the render window — reuses the URL rather than tearing it
// down and re-reading.
const objectUrlCache = new Map<string, CacheEntry>();
const REVOKE_DELAY_MS = 1500;

function readCachedUrl(fileId: string | undefined): string | null {
  if (!fileId) return null;
  return objectUrlCache.get(fileId)?.url ?? null;
}

function scheduleEviction(fileId: string, entry: CacheEntry): void {
  if (entry.revokeTimer) clearTimeout(entry.revokeTimer);
  entry.revokeTimer = setTimeout(() => {
    entry.revokeTimer = null;
    if (entry.refCount > 0) return;
    if (entry.url) {
      URL.revokeObjectURL(entry.url);
    }
    objectUrlCache.delete(fileId);
  }, REVOKE_DELAY_MS);
}

function acquireObjectUrl(fileId: string): {
  promise: Promise<string | null>;
  release: () => void;
} {
  let entry = objectUrlCache.get(fileId);
  if (!entry) {
    entry = { url: null, promise: null, refCount: 0, revokeTimer: null };
    objectUrlCache.set(fileId, entry);
  }
  const e = entry;

  // A remount within the revoke window reuses the entry and cancels the
  // pending eviction.
  if (e.revokeTimer) {
    clearTimeout(e.revokeTimer);
    e.revokeTimer = null;
  }

  e.refCount++;

  if (!e.promise) {
    e.promise = getLocalImageUrl(fileId).then((url) => {
      // If the entry was evicted while the fetch was in flight, revoke
      // the URL we just created and hand back null — nobody is
      // subscribed to it any more.
      if (objectUrlCache.get(fileId) !== e) {
        if (url) URL.revokeObjectURL(url);
        return null;
      }
      e.url = url;
      return url;
    });
  }

  const release = () => {
    e.refCount--;
    if (e.refCount <= 0) {
      scheduleEviction(fileId, e);
    }
  };

  return { promise: e.promise, release };
}

export function useTaskImage(fileId: string | undefined) {
  const [trackedFileId, setTrackedFileId] = useState<string | undefined>(fileId);
  const [state, setState] = useState<ImageState>(() => {
    const cached = readCachedUrl(fileId);
    return { url: cached, isLoading: !cached && !!fileId };
  });

  // Render-body reset pattern (§9). The cache is consulted synchronously
  // so a fileId change that hits the cache produces no isLoading frame.
  if (fileId !== trackedFileId) {
    setTrackedFileId(fileId);
    const cached = readCachedUrl(fileId);
    setState({ url: cached, isLoading: !cached && !!fileId });
  }

  useEffect(() => {
    if (!fileId) return;
    let isMounted = true;
    const { promise, release } = acquireObjectUrl(fileId);
    promise.then((url) => {
      if (!isMounted) return;
      setState((prev) => {
        if (prev.url === url && !prev.isLoading) return prev;
        return { url, isLoading: false };
      });
    });
    return () => {
      isMounted = false;
      release();
    };
  }, [fileId]);

  return { imageUrl: state.url, isLoading: state.isLoading };
}
