/** A trackpad exposes wheel events, not a finger-up signal. Hold the snap until
 * the horizontal wheel burst actually goes quiet, then commit at most one
 * logical period. No React work or transforms run on individual wheel frames. */
const QUIET_MS = 145;
const MIN_TRAVEL_PX = 64;
const MOMENTUM_GUARD_MS = 280;

export type TrackpadDirection = 'next' | 'prev';

export function attachHorizontalTrackpadNavigation(
  viewport: HTMLElement,
  navigate: (direction: TrackpadDirection) => void,
  canNavigate: () => boolean = () => true,
): () => void {
  let travel = 0;
  let timer: number | null = null;
  let guardUntil = 0;
  let lastCommittedDirection = 0;
  const reset = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    travel = 0;
  };
  const onWheel = (event: WheelEvent) => {
    if (event.defaultPrevented || !event.cancelable || event.deltaMode !== 0 ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        Math.abs(event.deltaX) < 1 ||
        Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.35 ||
        (event.target instanceof Element && event.target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-calendar-zoom-lane]'
        ))) return;
    // Claim horizontal scrolling before any parent route or browser Back
    // navigation can respond, even while the gesture is below threshold.
    event.preventDefault();
    event.stopPropagation();
    if (!canNavigate()) { reset(); return; }
    const direction = Math.sign(event.deltaX);
    // After a snap, inertial wheel tails must not trigger extra pages. A
    // deliberate opposite-direction gesture can immediately reverse it.
    if (Date.now() < guardUntil && direction === lastCommittedDirection) return;
    travel = Math.max(-2000, Math.min(2000, travel + event.deltaX));
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      const accumulated = travel;
      travel = 0;
      if (Math.abs(accumulated) < MIN_TRAVEL_PX || !canNavigate()) return;
      lastCommittedDirection = Math.sign(accumulated);
      guardUntil = Date.now() + MOMENTUM_GUARD_MS;
      navigate(lastCommittedDirection > 0 ? 'next' : 'prev');
    }, QUIET_MS);
  };
  // A new direct-manipulation drag takes precedence over any queued wheel snap.
  viewport.addEventListener('pointerdown', reset, true);
  viewport.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    reset();
    viewport.removeEventListener('pointerdown', reset, true);
    viewport.removeEventListener('wheel', onWheel);
  };
}
