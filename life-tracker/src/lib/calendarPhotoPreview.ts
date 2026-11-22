import { getCachedCalendarPreview, cacheCalendarPreview, deleteCachedCalendarPreview } from './imageCache';
import { getLocalImageUrl } from './storage';
import { isPendingImageId } from './pendingImages';

// Calendar alone may mount hundreds of photo previews. Limit simultaneous
// download/decode work so it cannot saturate the main thread during gestures.
const MAX_ACTIVE = 2;
const queue: Array<{
  fileId: string; refresh: boolean; node: HTMLElement | null;
  signal: AbortSignal; resolve: (url: string | null) => void;
  started: boolean; released: boolean; onAbort: () => void;
}> = [];
let active = 0;
const waitingRoots = new WeakSet<HTMLElement>();

function calendarRoot(node: HTMLElement | null): HTMLElement | null {
  return node?.closest<HTMLElement>('[data-route-swipe-horizontal-owner="true"]') ?? null;
}

function waitForSwipe(root: HTMLElement | null, signal: AbortSignal): Promise<void> {
  if (root?.dataset.calendarMediaPaused !== 'true' || signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => {
      root.removeEventListener('mosaic-calendar-media-resume', finish);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    root.addEventListener('mosaic-calendar-media-resume', finish, { once: true });
    signal.addEventListener('abort', finish, { once: true });
  });
}

async function loadPreview(
  fileId: string, refresh: boolean, node: HTMLElement | null, signal: AbortSignal,
): Promise<string | null> {
  if (signal.aborted) return null;
  // Pending offline originals are owner-scoped elsewhere. Never persist an
  // extra device-wide thumbnail of an upload that has not been synced.
  const pending = isPendingImageId(fileId);
  if (refresh && !pending) await deleteCachedCalendarPreview(fileId).catch(() => {});
  else if (!pending) {
    const cached = await getCachedCalendarPreview(fileId).catch(() => undefined);
    if (cached) return signal.aborted ? null : URL.createObjectURL(cached);
  }
  await waitForSwipe(calendarRoot(node), signal);
  if (signal.aborted) return null;
  const original = await getLocalImageUrl(fileId, refresh);
  if (!original) return null;
  if (signal.aborted) {
    URL.revokeObjectURL(original);
    return null;
  }
  // Browsers without OffscreenCanvas retain the original well-tested image
  // rendering path. Never make photo viewing contingent on thumbnail support.
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
    return original;
  }
  let thumbnail: Blob | null = null;
  try {
    await waitForSwipe(calendarRoot(node), signal);
    if (signal.aborted) {
      URL.revokeObjectURL(original);
      return null;
    }
    const response = await fetch(original);
    const originalBlob = await response.blob();
    const bitmap = await createImageBitmap(originalBlob, {
      resizeWidth: 192, resizeQuality: 'medium',
    });
    try {
      if (!signal.aborted) {
        const canvas = new OffscreenCanvas(192, 96);
        const context = canvas.getContext('2d');
        if (context) {
          const scale = Math.max(192 / bitmap.width, 96 / bitmap.height);
          const w = bitmap.width * scale;
          const h = bitmap.height * scale;
          context.drawImage(bitmap, (192 - w) / 2, (96 - h) / 2, w, h);
          thumbnail = await canvas.convertToBlob({ type: 'image/webp', quality: 0.72 });
        }
      }
    } finally {
      bitmap.close();
    }
  } catch {
    // A non-decodable local image continues through the normal error/retry
    // presentation path. Do not discard the original or force cloud access.
  }
  if (!thumbnail) {
    if (signal.aborted) URL.revokeObjectURL(original);
    return signal.aborted ? null : original;
  }
  URL.revokeObjectURL(original);
  if (signal.aborted) return null;
  if (!pending) await cacheCalendarPreview(fileId, thumbnail).catch(() => {});
  return signal.aborted ? null : URL.createObjectURL(thumbnail);
}

function priority(job: (typeof queue)[number]): number {
  const root = calendarRoot(job.node);
  const selected = Number(root?.dataset.calendarActiveSnap);
  const slide = Number(job.node?.closest<HTMLElement>('[data-calendar-slide-index]')
    ?.dataset.calendarSlideIndex);
  return root?.dataset.calendarActiveSnap !== undefined &&
    Number.isFinite(selected) && Number.isFinite(slide)
    ? Math.abs(selected - slide) : 99;
}

function drain() {
  while (active < MAX_ACTIVE && queue.length) {
    // After a gesture, prioritize the currently selected month over stale
    // requests from a previous, still-mounted neighboring grid. Attributes
    // are read without layout measurement or React updates.
    let winner = 0;
    for (let i = 1; i < queue.length; i++)
      if (priority(queue[i]) < priority(queue[winner])) winner = i;
    const next = queue[winner];
    if (next.signal.aborted) {
      queue.splice(winner, 1);
      next.resolve(null);
      continue;
    }
    const root = calendarRoot(next.node);
    if (root?.dataset.calendarMediaPaused === 'true') {
      if (!waitingRoots.has(root)) {
        waitingRoots.add(root);
        root.addEventListener('mosaic-calendar-media-resume', () => {
          waitingRoots.delete(root);
          drain();
        }, { once: true });
      }
      return;
    }
    queue.splice(winner, 1);
    next.started = true;
    active++;
    void loadPreview(next.fileId, next.refresh, next.node, next.signal)
      .then(next.resolve, () => next.resolve(null))
      .finally(() => {
        next.signal.removeEventListener('abort', next.onAbort);
        if (!next.released) active--;
        drain();
      });
  }
}

/** The caller aborts when a Calendar task leaves the render window. Requests
 * already sent by the Appwrite SDK may finish, but their results are dropped
 * and no further thumbnail decode is started after abort.
 */
export function requestCalendarPreview(
  fileId: string, refresh: boolean, node: HTMLElement | null, signal: AbortSignal,
): Promise<string | null> {
  if (signal.aborted) return Promise.resolve(null);
  return new Promise(resolve => {
    const job = {
      fileId, refresh, node, signal, resolve, started: false,
      released: false,
      onAbort: () => {
        if (job.started) {
          // Appwrite may not cancel an already-sent download. Free the
          // visible-preview slot immediately; the orphan's signal prevents
          // its late image decode/publication.
          if (!job.released) {
            job.released = true;
            active--;
            drain();
          }
          return;
        }
        const index = queue.indexOf(job);
        if (index >= 0) queue.splice(index, 1);
        signal.removeEventListener('abort', job.onAbort);
        resolve(null);
        drain();
      },
    };
    signal.addEventListener('abort', job.onAbort, { once: true });
    queue.push(job);
    drain();
  });
}
