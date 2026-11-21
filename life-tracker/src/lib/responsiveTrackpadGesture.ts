/**
 * Shared desktop trackpad-wheel recognizer.
 *
 * The browser exposes wheel deltas (including OS momentum) but not a portable
 * finger-up notification. The quiet timer deliberately selects responsiveness
 * over a guessed physical release. Surfaces own rendering and logical paging;
 * this module owns input arbitration, accumulation and cancellation.
 */
export const RESPONSIVE_TRACKPAD_QUIET_MS = 82;
export const RESPONSIVE_TRACKPAD_SETTLE_MS = 140;

export interface ResponsiveTrackpadGestureOptions {
  canNavigate?: () => boolean;
  accepts?: (event: WheelEvent, target: Element) => boolean;
  onStart?: () => void;
  onMove: (signedPixels: number) => void;
  onCommit: (signedPixels: number) => void;
  onCancel?: () => void;
}

export function attachResponsiveTrackpadGesture(
  viewport: HTMLElement,
  options: ResponsiveTrackpadGestureOptions,
): () => void {
  let distance = 0;
  let active = false;
  let pointerHeld = false;
  let disposed = false;
  let timer: number | null = null;

  const clearTimer = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  };
  const cancel = () => {
    clearTimer();
    distance = 0;
    active = false;
    options.onCancel?.();
  };
  const onWheel = (event: WheelEvent) => {
    if (disposed || !event.cancelable || event.defaultPrevented ||
        event.deltaMode !== 0 || event.ctrlKey || event.metaKey ||
        event.altKey || event.shiftKey ||
        !(event.target instanceof Element) ||
        event.target.closest('input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"]), [data-calendar-zoom-lane]')) return;

    const horizontal = Math.abs(event.deltaX) >= 1 &&
      Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.35;
    // Small inertial tail deltas can extend an active gesture without
    // initiating a new, accidental navigation.
    if (!horizontal && (!active || Math.abs(event.deltaX) < 0.1 ||
        Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 0.5)) return;
    if (options.accepts && !options.accepts(event, event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    if (pointerHeld || (options.canNavigate && !options.canNavigate())) {
      cancel();
      return;
    }
    if (!active) {
      active = true;
      distance = 0;
      options.onStart?.();
    }
    if (horizontal) {
      distance = Math.max(-1600, Math.min(1600, distance + event.deltaX));
      options.onMove(distance);
    }
    clearTimer();
    timer = window.setTimeout(() => {
      timer = null;
      if (!active || disposed) return;
      active = false;
      const total = distance;
      distance = 0;
      if (options.canNavigate && !options.canNavigate()) {
        options.onCancel?.();
        return;
      }
      options.onCommit(total);
    }, RESPONSIVE_TRACKPAD_QUIET_MS);
  };
  const onPointerDown = () => {
    pointerHeld = true;
    cancel();
  };
  const onPointerUp = () => { pointerHeld = false; };

  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('pointercancel', onPointerUp, true);
  return () => {
    disposed = true;
    clearTimer();
    // Completed visual settles belong to their surface and may outlive an
    // effect refresh; only cancel an unfinished wheel session.
    if (active) options.onCancel?.();
    viewport.removeEventListener('wheel', onWheel);
    viewport.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerUp, true);
  };
}
