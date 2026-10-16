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
    if (objectUrlCache.get(fileId) === entry) objectUrlCache.delete(fileId);
  }, REVOKE_DELAY_MS);
}

function acquireObjectUrl(fileId: string, refreshFromCloud = false): {
  promise: Promise<string | null>;
  release: () => void;
} {
  let entry = objectUrlCache.get(fileId);
  // Retain old leases while a damaged local blob is replaced from the cloud.
  if (refreshFromCloud && entry) {
    objectUrlCache.delete(fileId);
    entry = undefined;
  }
  if (!entry) {
    entry = { url: null, promise: null, refCount: 0, revokeTimer: null };
    objectUrlCache.set(fileId, entry);
  }
  const e = entry;
  if (e.revokeTimer) {
    clearTimeout(e.revokeTimer);
    e.revokeTimer = null;
  }
  e.refCount++;
  if (!e.promise) {
    e.promise = (refreshFromCloud ? getLocalImageUrl(fileId, true) : getLocalImageUrl(fileId))
      .catch((error) => {
        console.error('[useTaskImage] Failed to acquire image:', error);
        return null;
      })
      .then((url) => {
        if (objectUrlCache.get(fileId) !== e) {
          if (url) URL.revokeObjectURL(url);
          return null;
        }
        e.url = url;
        // A failed/offline acquisition should not poison this shared file ID
        // forever. Reacquire on the next visibility/connection opportunity.
        if (!url) e.promise = null;
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

// Test-only escape hatch. The module-level `objectUrlCache` persists across
// test files in the same worker, which can cause confusing cross-test state
// if two tests happen to use the same fileId. Calling this in `beforeEach`
// gives each test a clean slate. Production code never calls this.
export function resetTaskImageCacheForTests(): void {
  for (const entry of objectUrlCache.values()) {
    if (entry.revokeTimer) {
      clearTimeout(entry.revokeTimer);
      entry.revokeTimer = null;
    }
    if (entry.url) {
      URL.revokeObjectURL(entry.url);
    }
  }
  objectUrlCache.clear();
}

export function useTaskImage(fileId: string | undefined, enabled = true) {
  const [tracked, setTracked] = useState({ fileId, enabled });
  const [revision, setRevision] = useState({ fileId, count: 0 });
  const [state, setState] = useState<ImageState>(() => {
    const cached = readCachedUrl(fileId);
    return { url: cached, isLoading: enabled && !cached && !!fileId };
  });

  if (fileId !== tracked.fileId || enabled !== tracked.enabled) {
    setTracked({ fileId, enabled });
    if (fileId !== tracked.fileId) setRevision({ fileId, count: 0 });
    const cached = readCachedUrl(fileId);
    setState({ url: cached, isLoading: enabled && !cached && !!fileId });
  }

  useEffect(() => {
    if (!fileId || !enabled) return;
    let active = true;
    let failed = false;
    let release = () => {};
    const load = () => {
      failed = false;
      release();
      const acquired = acquireObjectUrl(fileId, revision.fileId === fileId && revision.count > 0);
      release = acquired.release;
      acquired.promise.then((url) => {
        if (!active) return;
        failed = !url;
        setState({ url, isLoading: false });
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
      release();
      window.removeEventListener('online', retry);
      window.removeEventListener('focus', retry);
    };
  }, [fileId, enabled, revision]);

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
