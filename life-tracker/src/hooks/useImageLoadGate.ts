import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react';

interface ImageLoadGateOptions {
  eager?: boolean;
  rootMargin?: string;
}

const DEFAULT_ROOT_MARGIN = '200px';

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
  const observerRef = useRef<IntersectionObserver | null>(null);

  const targetRef = useCallback<RefCallback<T>>(
    (node) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node || shouldLoad) return;
      if (eager || typeof IntersectionObserver === 'undefined') {
        setShouldLoad(true);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          setShouldLoad(true);
          observer.disconnect();
        },
        { rootMargin, threshold: 0.01 }
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [eager, rootMargin, shouldLoad]
  );

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    },
    []
  );

  return { targetRef, shouldLoad };
}
