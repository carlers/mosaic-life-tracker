import { attachResponsiveTrackpadGesture, RESPONSIVE_TRACKPAD_SETTLE_MS } from './responsiveTrackpadGesture';

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

/**
 * Desktop Calendar and Day View must not use an independent scroll-snap
 * rail on top of their Embla/Swiper transforms: the two can end on different
 * visual pages and expose empty content. Instead, animate only the *actual*
 * carousel track inside its clipped viewport. Wheel deltas include OS inertial
 * movement, and a short compositor settle finishes before another fast swipe.
 * No parent scrollLeft is ever changed, so Calendar grid/panel alignment and
 * the existing mouse, touch and keyboard owners remain intact.
 *
 * As with any WheelEvent-based implementation, a stationary finger is not
 * observable: the small quiet interval is a pragmatic UX tradeoff.
 */
export function attachResponsiveTrackpadNavigation(
  viewport: HTMLElement,
  navigate: (direction: TrackpadDirection, immediate?: boolean) => void,
  canNavigate: () => boolean = () => true,
  canCommit: (direction: TrackpadDirection) => boolean = () => true,
  accepts: (event: WheelEvent, target: Element) => boolean = () => true,
): () => void {
  const track = viewport.firstElementChild;
  if (!(track instanceof HTMLElement)) return () => {};
  let origin = 0;
  const interrupt = () => {
    const prior = settling.get(track);
    if (!prior) return Number.parseFloat(track.style.translate) || 0;
    const computed = Number.parseFloat(getComputedStyle(track).translate);
    settling.delete(track);
    prior.cancel();
    const painted = Number.isFinite(computed) ? computed : 0;
    track.style.translate = `${painted}px 0px`;
    return painted;
  };
  const animateToRest = (duration: number) => {
    const from = track.style.translate;
    if (!from || !Number.parseFloat(from) ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
        typeof track.animate !== 'function') {
      track.style.translate = '';
      return;
    }
    const animation = track.animate(
      [{ translate: from }, { translate: '0px 0px' }],
      { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
    );
    track.style.translate = '';
    settling.set(track, animation);
    animation.onfinish = () => {
      if (settling.get(track) !== animation) return;
      settling.delete(track);
      animation.cancel();
    };
  };
  const width = () => viewport.clientWidth || viewport.getBoundingClientRect().width || 800;
  const clamp = (pixels: number) =>
    Math.max(-width() * 0.94, Math.min(width() * 0.94, pixels));

  return attachResponsiveTrackpadGesture(viewport, {
    canNavigate,
    accepts,
    onStart: () => { origin = interrupt(); },
    onMove: signedPixels => {
      track.style.translate = `${clamp(origin - signedPixels)}px 0px`;
    },
    onCommit: signedPixels => {
      const from = clamp(origin - signedPixels);
      origin = 0;
      const threshold = Math.max(48, width() * 0.12);
      const dir = Math.abs(signedPixels) >= threshold
        ? (signedPixels > 0 ? 'next' : 'prev') : null;
      const allowed = dir !== null && canCommit(dir);
      // Advance the logical slide in the same paint as an equal full-slide
      // translation. Only the compensated 140ms compositor settle is visible.
      track.style.translate = `${from + (allowed ? (dir === 'next' ? width() : -width()) : 0)}px 0px`;
      if (allowed && dir) navigate(dir, true);
      animateToRest(allowed ? RESPONSIVE_TRACKPAD_SETTLE_MS : 95);
    },
    onCancel: () => {
      const prior = settling.get(track);
      if (prior) {
        settling.delete(track);
        prior.cancel();
      }
      origin = 0;
      track.style.translate = '';
    },
  });
}

/**
 * A JS wheel-idle timeout cannot observe a trackpad finger lift: a resting
 * finger emits no wheel events. The native browser scroller *can* await the
 * complete physical gesture and preserve OS inertial scrolling. Use a native
 * three-stop CSS snap rail with inertial overrun on each end in the existing
 * Embla/Swiper viewport, while the
 * carousel still owns its transform and all mouse/touch/keyboard gestures.
 *
 * The rail is inserted imperatively in this lazy chunk. No extra React wrapper
 * or startup/Home bundle is introduced and the carousel's first child stays
 * its own track. Native scrollLeft and the compensating CSS 'translate'
 * visually cancel at the center. When native scrollend arrives (not a timer),
 * one immediate logical selection + rail recenter occur in a single frame.
 */
export function attachNativeHorizontalTrackpadNavigation(
  viewport: HTMLElement,
  navigate: (direction: TrackpadDirection, immediate?: boolean) => void,
  canNavigate: () => boolean = () => true,
  scrollHost: HTMLElement = viewport,
): () => void {
  const track = viewport.firstElementChild;
  if (!(track instanceof HTMLElement)) return () => {};
  // Calendar's Embla viewport must remain scrollLeft=0 for grid/panel
  // alignment; scroll its existing outer host instead. Swiper scrolls itself.
  const carrier = scrollHost === viewport ? track : viewport;
  const original = {
    position: scrollHost.style.position,
    overflowX: scrollHost.style.overflowX,
    overflowY: scrollHost.style.overflowY,
    scrollSnapType: scrollHost.style.scrollSnapType,
    overscrollBehaviorX: scrollHost.style.overscrollBehaviorX,
    scrollbarWidth: scrollHost.style.scrollbarWidth,
    translate: carrier.style.translate,
    scrollLeft: scrollHost.scrollLeft,
  };
  let width = scrollHost.clientWidth || scrollHost.getBoundingClientRect().width;
  if (!width) return () => {};
  // Calendar retains its full inertial runway. Day View uses a tighter
  // physical runway so fast flings have less spring-back distance before
  // the browser completes its native scroll snap.
  const runwayPages = viewport.matches('[data-testid="day-swiper"]') ? 0.3 : 1;
  const railPages = 3 + runwayPages * 2;
  const center = () => width * (1 + runwayPages);
  let armed = false;
  let pointerHeld = false;
  let disposed = false;

  // The three stop destinations are always one page apart; only the
  // physical overrun beyond them varies by surface. Native momentum remains
  // intact, while Day View has a shorter spring-back distance than Calendar.
  // The absolute anchors never enter the carousel's slide inventory.
  const rail = document.createElement('div');
  rail.dataset.trackpadSnapRail = 'true';
  Object.assign(rail.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${railPages * 100}%`,
    height: '1px',
    pointerEvents: 'none',
  });
  for (let page = 0; page < 3; page += 1) {
    const stop = document.createElement('div');
    Object.assign(stop.style, {
      position: 'absolute',
      top: '0',
      left: `${100 * (page + runwayPages) / railPages}%`,
      width: '1px',
      height: '1px',
      scrollSnapAlign: 'start',
      scrollSnapStop: 'normal',
    });
    rail.append(stop);
  }
  scrollHost.style.position = 'relative';
  scrollHost.style.overflowX = 'auto';
  scrollHost.style.overflowY = 'hidden';
  scrollHost.style.scrollSnapType = 'x mandatory';
  scrollHost.style.overscrollBehaviorX = 'contain';
  scrollHost.style.scrollbarWidth = 'none';
  scrollHost.append(rail);
  // Native scrollLeft=center (two pages) and CSS translate=center cancel.
  // This preserves the existing visual track geometry and pointer targets.
  carrier.style.translate = `${center()}px 0px`;
  scrollHost.scrollLeft = center();

  const resetCenter = () => {
    armed = false;
    scrollHost.scrollLeft = center();
  };
  const onWheel = (event: WheelEvent) => {
    const target = event.target;
    const excluded = target instanceof Element && Boolean(target.closest(
      'input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"]), [data-calendar-zoom-lane]'
    ));
    if (event.defaultPrevented || event.ctrlKey || event.metaKey ||
        event.altKey || event.shiftKey || excluded ||
        Math.abs(event.deltaX) < 1 ||
        Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.35) return;
    if (pointerHeld || !canNavigate()) {
      event.preventDefault();
      resetCenter();
      return;
    }
    armed = true;
    // Do NOT preventDefault: that would forfeit native trackpad release and
    // inertia. Keep the horizontal wheel owned by this viewport, not the
    // outer route/friend carousel.
    event.stopPropagation();
  };
  const onScrollEnd = () => {
    if (!armed || disposed) return;
    armed = false;
    if (pointerHeld || !canNavigate()) {
      scrollHost.scrollLeft = center();
      return;
    }
    // scrollend waits for a *real* UA gesture completion, including momentum
    // and a stationary finger. A wheel-idle pause is never a release signal.
    const offset = scrollHost.scrollLeft - center();
    const direction = offset > width * 0.3 ? 'next'
      : offset < -width * 0.3 ? 'prev' : null;
    if (direction) navigate(direction, true);
    // Callback's immediate Embla/Swiper movement and this recenter execute
    // before painting, preserving the native snapped visual position.
    scrollHost.scrollLeft = center();
  };
  const onPointerDown = () => { pointerHeld = true; resetCenter(); };
  const onPointerUp = () => { pointerHeld = false; };
  const onResize = () => {
    const next = scrollHost.clientWidth || scrollHost.getBoundingClientRect().width;
    if (!next || Math.abs(next - width) < 1) return;
    width = next;
    armed = false;
    carrier.style.translate = `${center()}px 0px`;
    scrollHost.scrollLeft = center();
  };
  const observer = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(onResize) : null;
  observer?.observe(scrollHost);
  viewport.addEventListener('wheel', onWheel, { passive: false });
  scrollHost.addEventListener('scrollend', onScrollEnd);
  viewport.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('pointercancel', onPointerUp, true);
  return () => {
    disposed = true;
    observer?.disconnect();
    viewport.removeEventListener('wheel', onWheel);
    scrollHost.removeEventListener('scrollend', onScrollEnd);
    viewport.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerUp, true);
    rail.remove();
    scrollHost.style.position = original.position;
    scrollHost.style.overflowX = original.overflowX;
    scrollHost.style.overflowY = original.overflowY;
    scrollHost.style.scrollSnapType = original.scrollSnapType;
    scrollHost.style.overscrollBehaviorX = original.overscrollBehaviorX;
    scrollHost.style.scrollbarWidth = original.scrollbarWidth;
    scrollHost.scrollLeft = original.scrollLeft;
    carrier.style.translate = original.translate || '';
  };
}


export function attachHorizontalTrackpadNavigation(
  viewport: HTMLElement,
  navigate: (direction: TrackpadDirection, immediate?: boolean) => void,
  canNavigate: () => boolean = () => true,
): () => void {
  // Native scroll-snap + scrollend is the only web path that waits through
  // a stationary finger and lets the operating system carry fling momentum.
  // Keep the timer-based recognizer for older browsers with no scrollend.
  const isFullCalendar = viewport.matches('[data-route-swipe-horizontal-owner="true"]');
  const isDayView = viewport.matches('[data-testid="day-swiper"]');
  // Compact Todo/Diary grids keep their existing gesture implementation and
  // layout; a native host around them would move unrelated month headers.
  // A separate native scroll rail can desynchronize from an instant Embla
  // or Swiper selection. Own the actual clipped carousel track instead.
  if ((isDayView || isFullCalendar) &&
      window.matchMedia?.('(any-pointer: fine)').matches) {
    return attachResponsiveTrackpadNavigation(viewport, navigate, canNavigate);
  }
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
    element.style.translate = '';
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
      element.style.translate = '';
      return;
    }
    // Animate only the independent translate property. A native Embla/Swiper
    // period snap animates its transform at the same time, so a held -80px
    // preview continues seamlessly toward the neighboring full-width slide.
    const animation = element.animate(
      [{ translate: from }, { translate: '0px 0px' }],
      { duration: SETTLE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
    );
    element.style.translate = '';
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
