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
  onMove: (signedPixels: number, recentVelocityPxPerMs: number) => void;
  onCommit: (signedPixels: number, recentVelocityPxPerMs: number) => void;
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
  let recentVelocity = 0;
  const samples: Array<{ time: number; distance: number }> = [];

  const clearTimer = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  };
  const cancel = () => {
    clearTimer();
    distance = 0;
    active = false;
    samples.length = 0;
    recentVelocity = 0;
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
      samples.length = 0;
      recentVelocity = 0;
      options.onStart?.();
    }
    if (horizontal) {
      distance = Math.max(-1600, Math.min(1600, distance + event.deltaX));
      const time = event.timeStamp;
      const earliest = samples.find(sample => time - sample.time <= 85);
      if (earliest && time > earliest.time) {
        recentVelocity = Math.max(-3, Math.min(3,
          (distance - earliest.distance) / (time - earliest.time)));
      }
      samples.push({ time, distance });
      if (samples.length > 8) samples.shift();
      options.onMove(distance, recentVelocity);
    }
    clearTimer();
    timer = window.setTimeout(() => {
      timer = null;
      if (!active || disposed) return;
      active = false;
      const total = distance;
      const exitVelocity = recentVelocity;
      distance = 0;
      samples.length = 0;
      recentVelocity = 0;
      if (options.canNavigate && !options.canNavigate()) {
        options.onCancel?.();
        return;
      }
      options.onCommit(total, exitVelocity);
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

/**
 * The CSS overflow-axis computed-value rule converts overflow-x:visible to
 * auto when overflow-y:auto. Such vertical page scrollers are NOT horizontal
 * gesture owners merely because a row spills by a few pixels. Preserve real
 * horizontal carousels and explicitly marked native lanes.
 */
export function hasNestedHorizontalGestureOwner(target: Element, boundary: Element): boolean {
  for (let node: Element | null = target; node && node !== boundary; node = node.parentElement) {
    if (node.matches('.swiper, .embla, [data-route-swipe-horizontal-owner]')) return true;
    const style = getComputedStyle(node);
    if (!/auto|scroll/.test(style.overflowX) || node.scrollWidth <= node.clientWidth + 2) continue;
    if (node.matches('.overflow-x-auto, .overflow-x-scroll, [data-native-horizontal-scroller]') ||
        (node.scrollWidth - node.clientWidth > 24 &&
          node.scrollHeight <= node.clientHeight + 2)) return true;
  }
  return false;
}
