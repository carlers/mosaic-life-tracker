import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react';

interface ImageLoadGateOptions {
  eager?: boolean;
  rootMargin?: string;
}

const DEFAULT_ROOT_MARGIN = '200px';

// Photo-heavy month grids contain many gates. Pool browser observers by
// proximity margin without changing the per-image visibility latch.
interface ObserverGroup {
  observer: IntersectionObserver;
  callbacks: Map<Element, () => void>;
  pending: Map<Element, { root: HTMLElement; resume: () => void }>;
}
const groups = new Map<string, ObserverGroup>();

function watchProximity(node: Element, rootMargin: string, onVisible: () => void): () => void {
  let group = groups.get(rootMargin);
  if (!group) {
    const callbacks = new Map<Element, () => void>();
    const pending = new Map<Element, { root: HTMLElement; resume: () => void }>();
    let observer: IntersectionObserver;

    const clearPending = (target: Element) => {
      const waiting = pending.get(target);
      if (!waiting) return;
      waiting.root.removeEventListener('mosaic-calendar-media-resume', waiting.resume);
      pending.delete(target);
    };
    const finish = (target: Element) => {
      const notify = callbacks.get(target);
      if (!notify) return;
      clearPending(target);
      callbacks.delete(target);
      observer.unobserve(target);
      notify();
      if (!callbacks.size) {
        observer.disconnect();
        if (groups.get(rootMargin)?.observer === observer) groups.delete(rootMargin);
      }
    };
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!callbacks.has(entry.target)) continue;
        if (!entry.isIntersecting) {
          // A swiped-away month must not load its images after settlement.
          clearPending(entry.target);
          continue;
        }
        const calendar = entry.target.closest<HTMLElement>(
          '[data-route-swipe-horizontal-owner="true"]'
        );
        if (calendar?.dataset.calendarMediaPaused === 'true') {
          if (!pending.has(entry.target)) {
            const resume = () => finish(entry.target);
            pending.set(entry.target, { root: calendar, resume });
            calendar.addEventListener('mosaic-calendar-media-resume', resume, { once: true });
          }
          continue;
        }
        finish(entry.target);
      }
    }, { rootMargin, threshold: 0.01 });
    group = { observer, callbacks, pending };
    groups.set(rootMargin, group);
  }
  const owner = group;
  owner.callbacks.set(node, onVisible);
  owner.observer.observe(node);
  return () => {
    if (!owner.callbacks.delete(node)) return;
    const waiting = owner.pending.get(node);
    if (waiting) {
      waiting.root.removeEventListener('mosaic-calendar-media-resume', waiting.resume);
      owner.pending.delete(node);
    }
    owner.observer.unobserve(node);
    if (!owner.callbacks.size) {
      owner.observer.disconnect();
      if (groups.get(rootMargin) === owner) groups.delete(rootMargin);
    }
  };
}

export function useImageLoadGate<T extends Element = HTMLElement>({
  eager = false,
  rootMargin = DEFAULT_ROOT_MARGIN,
}: ImageLoadGateOptions = {}): {
  targetRef: RefCallback<T>;
  shouldLoad: boolean;
} {
  const [shouldLoad, setShouldLoad] = useState(
    () => eager || typeof IntersectionObserver === 'undefined'
  );
  const unwatchRef = useRef<(() => void) | null>(null);

  const targetRef = useCallback<RefCallback<T>>(
    (node) => {
      unwatchRef.current?.();
      unwatchRef.current = null;
      if (!node || shouldLoad) return;
      if (eager || typeof IntersectionObserver === 'undefined') {
        setShouldLoad(true);
        return;
      }

      unwatchRef.current = watchProximity(node, rootMargin, () => setShouldLoad(true));
    },
    [eager, rootMargin, shouldLoad]
  );

  useEffect(
    () => () => {
      unwatchRef.current?.();
      unwatchRef.current = null;
    },
    []
  );

  return { targetRef, shouldLoad };
}
