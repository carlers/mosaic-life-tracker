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
  if (e.revokeTimer) {
    clearTimeout(e.revokeTimer);
    e.revokeTimer = null;
  }
  e.refCount++;
  if (!e.promise) {
    e.promise = getLocalImageUrl(fileId)
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
  const [trackedFileId, setTrackedFileId] = useState<string | undefined>(fileId);
  const [trackedEnabled, setTrackedEnabled] = useState(enabled);
  const [state, setState] = useState<ImageState>(() => {
    const cached = readCachedUrl(fileId);
    return { url: cached, isLoading: enabled && !cached && !!fileId };
  });

  if (fileId !== trackedFileId || enabled !== trackedEnabled) {
    setTrackedFileId(fileId);
    setTrackedEnabled(enabled);
    const cached = readCachedUrl(fileId);
    setState({ url: cached, isLoading: enabled && !cached && !!fileId });
  }

  useEffect(() => {
    if (!fileId || !enabled) return;
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
  }, [fileId, enabled]);

  return { imageUrl: state.url, isLoading: state.isLoading };
}
