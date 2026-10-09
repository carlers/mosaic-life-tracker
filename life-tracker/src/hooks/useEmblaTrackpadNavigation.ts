import { useEffect } from 'react';
import type { EmblaCarouselType } from 'embla-carousel';

const WHEEL_GESTURE_GAP_MS = 280;
const WHEEL_SNAP_THRESHOLD_PX = 64;

/**
 * Route gestures and nested carousels must not compete for wheel ownership.
 * Keep wheel input on Embla's own viewport and let Embla animate the snap.
 * Unlike touch dragging, browser WheelEvent does not identify finger release.
 */
export function useEmblaTrackpadNavigation(api: EmblaCarouselType | undefined) {
  useEffect(() => {
    if (!api) return;
    const viewport = api.rootNode();
    let lastEvent = -Infinity;
    let distance = 0;
    let direction = 0;
    let committed = false;
    const handleWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || !event.cancelable || event.deltaMode !== 0 ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        Math.abs(event.deltaX) < 1 ||
        Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.35) return;

      const nextDirection = Math.sign(event.deltaX);
      const elapsed = Date.now() - lastEvent;
      if (elapsed > WHEEL_GESTURE_GAP_MS || nextDirection !== direction) {
        distance = 0;
        committed = false;
        direction = nextDirection;
      }
      lastEvent = Date.now();
      // Embla owns the visible carousel; do not leak this horizontal wheel
      // to a parent route/back recognizer or the browser's horizontal scroll.
      event.preventDefault();
      event.stopPropagation();
      if (committed) return;
      distance += Math.abs(event.deltaX);
      if (distance < WHEEL_SNAP_THRESHOLD_PX) return;
      committed = true;
      if (direction > 0) api.scrollNext();
      else api.scrollPrev();
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [api]);
}
