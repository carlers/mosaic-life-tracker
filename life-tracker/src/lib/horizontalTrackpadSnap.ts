/** Trackpad wheels have no finger-up event. Render the partial swipe on the
 * existing carousel compositor track while pixels arrive, and only ask Embla
 * or Swiper to commit a period after the wheel stream has gone quiet.
 * CSS's individual translate composes with (never replaces) their transform.
 */
const QUIET_MS = 145;
const MIN_TRAVEL_PX = 64;
const MOMENTUM_GUARD_MS = 280;
const SETTLE_MS = 280;
const settling = new WeakMap<HTMLElement, Animation>();

export type TrackpadDirection = 'next' | 'prev';

export function attachHorizontalTrackpadNavigation(
  viewport: HTMLElement,
  navigate: (direction: TrackpadDirection) => void,
  canNavigate: () => boolean = () => true,
): () => void {
  let travel = 0;
  let origin = 0;
  let timer: number | null = null;
  let guardUntil = 0;
  let lastCommittedDirection = 0;
  let pointerHeld = false;

  // Embla's container and Swiper's wrapper are each the viewport's direct
  // child. Neither library needs to receive a synthetic drag/slide event.
  const track = () => viewport.firstElementChild instanceof HTMLElement
    ? viewport.firstElementChild : null;
  const cancelVisual = () => {
    const element = track();
    if (!element) return;
    const animation = settling.get(element);
    if (animation) {
      settling.delete(element);
      animation.cancel();
    }
    element.style.removeProperty('translate');
  };
  const reset = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    travel = 0;
    origin = 0;
    cancelVisual();
  };
  const preview = () => {
    const element = track();
    if (!element) return;
    // Follow the finger in screen pixels, without navigating more than one
    // pre-rendered neighbor or stretching the calendar's native scroll lane.
    const width = viewport.clientWidth || viewport.getBoundingClientRect().width || 800;
    const limit = Math.max(32, width * 0.9);
    const pixels = Math.max(-limit, Math.min(limit, origin - travel));
    element.style.translate = `${pixels}px 0px`;
  };
  const interruptSettle = () => {
    const element = track();
    if (!element) return 0;
    const animation = settling.get(element);
    if (!animation) return Number.parseFloat(element.style.translate) || 0;
    // Retarget from the *painted* offset, not the old gesture's endpoint,
    // when the user deliberately reverses during a running snap.
    const painted = Number.parseFloat(getComputedStyle(element).translate) || 0;
    settling.delete(element);
    animation.cancel();
    element.style.translate = `${painted}px 0px`;
    return painted;
  };
  const settleVisual = () => {
    const element = track();
    if (!element) return;
    const from = element.style.translate;
    if (!from || from === '0px 0px' ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
        typeof element.animate !== 'function') {
      element.style.removeProperty('translate');
      return;
    }
    // Animate only the independent translate property. A native Embla/Swiper
    // period snap animates its transform at the same time, so a held -80px
    // preview continues seamlessly toward the neighboring full-width slide.
    const animation = element.animate(
      [{ translate: from }, { translate: '0px 0px' }],
      { duration: SETTLE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
    );
    element.style.removeProperty('translate');
    settling.set(element, animation);
    animation.onfinish = () => {
      if (settling.get(element) !== animation) return;
      settling.delete(element);
      animation.cancel();
    };
  };
  const onWheel = (event: WheelEvent) => {
    if (event.defaultPrevented || !event.cancelable || event.deltaMode !== 0 ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        Math.abs(event.deltaX) < 1 ||
        Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.35 ||
        (event.target instanceof Element && event.target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-calendar-zoom-lane]'
        ))) return;
    event.preventDefault();
    event.stopPropagation();
    if (pointerHeld || !canNavigate()) { reset(); return; }
    const direction = Math.sign(event.deltaX);
    // An inertial same-direction tail is still the preceding wheel gesture.
    // A genuine reverse can immediately take ownership of the painted track.
    if (Date.now() < guardUntil && direction === lastCommittedDirection) return;
    if (timer === null) origin = interruptSettle();
    travel = Math.max(-2000, Math.min(2000, travel + event.deltaX));
    preview();
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      const accumulated = travel;
      travel = 0;
      origin = 0;
      if (!canNavigate()) { cancelVisual(); return; }
      settleVisual();
      if (Math.abs(accumulated) < MIN_TRAVEL_PX) return;
      lastCommittedDirection = Math.sign(accumulated);
      guardUntil = Date.now() + MOMENTUM_GUARD_MS;
      navigate(lastCommittedDirection > 0 ? 'next' : 'prev');
    }, QUIET_MS);
  };
  const onPointerDown = () => { pointerHeld = true; reset(); };
  const onPointerUp = () => { pointerHeld = false; };
  viewport.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('pointercancel', onPointerUp, true);
  viewport.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    if (timer !== null) reset();
    // Leave an already-committed compositor settle alive if React recreates
    // the listener as the active day/month changes; the animation self-cleans.
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerUp, true);
    viewport.removeEventListener('pointerdown', onPointerDown, true);
    viewport.removeEventListener('wheel', onWheel);
  };
}
