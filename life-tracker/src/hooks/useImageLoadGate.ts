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
}
const groups = new Map<string, ObserverGroup>();

function watchProximity(node: Element, rootMargin: string, onVisible: () => void): () => void {
  let group = groups.get(rootMargin);
  if (!group) {
    const callbacks = new Map<Element, () => void>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const notify = callbacks.get(entry.target);
        if (!notify) continue;
        callbacks.delete(entry.target);
        observer.unobserve(entry.target);
        notify();
      }
      if (!callbacks.size) {
        observer.disconnect();
        if (groups.get(rootMargin)?.observer === observer) groups.delete(rootMargin);
      }
    }, { rootMargin, threshold: 0.01 });
    group = { observer, callbacks };
    groups.set(rootMargin, group);
  }
  const owner = group;
  owner.callbacks.set(node, onVisible);
  owner.observer.observe(node);
  return () => {
    if (!owner.callbacks.delete(node)) return;
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
