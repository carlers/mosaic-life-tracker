import { useState, useEffect, type RefObject } from 'react';
import type { TaskImageLeaseEntry } from '../lib/taskImageLease';

interface ImageState {
  url: string | null;
  isLoading: boolean;
}

// The tiny synchronous lookup remains on the Home path so reversing into an
// already warm thumbnail never flashes empty. All network, URL leasing,
// revocation and decode scheduling is lazy on first actual photo demand.
const objectUrlCache = new Map<string, TaskImageLeaseEntry>();
const idleCalendarUrls = new Map<string, TaskImageLeaseEntry>();

function readCachedUrl(fileId: string | undefined, calendar: boolean): string | null {
  if (!fileId) return null;
  return objectUrlCache.get(calendar ? `calendar:${fileId}` : fileId)?.url ?? null;
}

// Test-only escape hatch to isolate URL leases between test cases.
export function resetTaskImageCacheForTests(): void {
  for (const entry of objectUrlCache.values()) {
    entry.controller?.abort();
    if (entry.revokeTimer) clearTimeout(entry.revokeTimer);
    if (entry.url) URL.revokeObjectURL(entry.url);
  }
  objectUrlCache.clear();
  idleCalendarUrls.clear();
}

export function useTaskImage(
  fileId: string | undefined, enabled = true,
  isCalendar = false,
  calendarRef?: RefObject<HTMLElement | null>,
) {
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
      void import('../lib/taskImageLease').then(({ acquireTaskImageUrl }) => {
        if (!active) return;
        const acquired = acquireTaskImageUrl(
          objectUrlCache, idleCalendarUrls, fileId,
          revision.fileId === fileId && revision.count > 0, calendarRef,
        );
        release = acquired.release;
        void acquired.promise.then(url => {
          if (!active) return;
          failed = !url;
          const show = () => { if (active) setState({ url, isLoading: false }); };
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
      }).catch(error => {
        console.error('[useTaskImage] Failed to acquire image:', error);
        if (active) setState({ url: null, isLoading: false });
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
    setRevision(value => ({ fileId, count: value.fileId === fileId ? value.count + 1 : 1 }));
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
