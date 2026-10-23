import React from 'react';

// A single viewport observer keeps hundreds of far-below-fold Todo rows
// rendered and accessible without registering every drag/drop target at mount.
// Offscreen registration resumes before a row enters the touch viewport.
const listeners = new Map<Element, (near: boolean) => void>();
let observer: IntersectionObserver | null = null;

function observe(node: Element, callback: (near: boolean) => void) {
  if (!observer) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) listeners.get(entry.target)?.(entry.isIntersecting);
    }, { rootMargin: '800px 0px 800px 0px' });
  }
  listeners.set(node, callback);
  observer.observe(node);
}

function unobserve(node: Element) {
  observer?.unobserve(node);
  listeners.delete(node);
  if (listeners.size === 0) {
    observer?.disconnect();
    observer = null;
  }
}

/**
 * Keeps the first visible rows immediately draggable. Outside that group,
 * register when the row approaches the viewport. When IntersectionObserver is
 * unavailable, conservatively register everything to preserve gestures.
 * The callback ref avoids state updates for every offscreen row on mount.
 */
export function useTaskReorderProximity(eager: boolean) {
  const [near, setNear] = React.useState(() =>
    eager || typeof IntersectionObserver === 'undefined'
  );
  const current = React.useRef<HTMLDivElement | null>(null);
  const ref = React.useCallback((node: HTMLDivElement | null) => {
    if (current.current && !eager && typeof IntersectionObserver !== 'undefined') {
      unobserve(current.current);
    }
    current.current = node;
    if (node && !eager && typeof IntersectionObserver !== 'undefined') {
      observe(node, setNear);
    }
  }, [eager]);
  React.useEffect(() => () => {
    if (current.current && !eager && typeof IntersectionObserver !== 'undefined') {
      unobserve(current.current);
    }
  }, [eager]);
  return { ref, registered: eager || near };
}
