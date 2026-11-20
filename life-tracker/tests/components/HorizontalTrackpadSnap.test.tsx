import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachHorizontalTrackpadNavigation, attachNativeHorizontalTrackpadNavigation } from '../../src/lib/horizontalTrackpadSnap';

function wheel(target: Element, deltaX: number, deltaY = 0, options: WheelEventInit = {}) {
  const event = new WheelEvent('wheel', {
    bubbles: true, cancelable: true, deltaMode: 0, deltaX, deltaY, ...options,
  });
  // Happy DOM ignores WheelEventInit.ctrlKey; preserve the real-browser
  // modifier contract explicitly in this unit fixture.
  if (options.ctrlKey !== undefined) Object.defineProperty(event, 'ctrlKey', { value: options.ctrlKey });
  target.dispatchEvent(event);
  return event;
}

describe('horizontal trackpad period ownership', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

  it('waits for the last wheel delta, then moves one period, never snapping mid-burst', () => {
    const viewport = document.createElement('div');
    const track = document.createElement('div');
    viewport.append(track);
    document.body.append(viewport);
    const navigate = vi.fn();
    const remove = attachHorizontalTrackpadNavigation(viewport, navigate);
    expect(wheel(viewport, 42).defaultPrevented).toBe(true);
    expect(track.style.translate).toBe('-42px 0px');
    vi.advanceTimersByTime(120);
    expect(navigate).not.toHaveBeenCalled();
    wheel(viewport, 30);
    expect(track.style.translate).toBe('-72px 0px');
    vi.advanceTimersByTime(144);
    expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('next');
    expect(track.style.translate).toBe('');
    // The same inertial tail cannot turn one horizontal gesture into days.
    wheel(viewport, 115);
    vi.advanceTimersByTime(180);
    expect(navigate).toHaveBeenCalledTimes(1);
    remove();
  });

  it('previews subthreshold wheel travel, then settles back without changing a period', () => {
    const viewport = document.createElement('div');
    const track = document.createElement('div');
    viewport.append(track);
    document.body.append(viewport);
    const navigate = vi.fn();
    const remove = attachHorizontalTrackpadNavigation(viewport, navigate);
    wheel(viewport, 28);
    expect(track.style.translate).toBe('-28px 0px');
    vi.advanceTimersByTime(145);
    expect(navigate).not.toHaveBeenCalled();
    expect(track.style.translate).toBe('');
    remove();
  });

  it('bounds compositor displacement to the viewport even for large deltas', () => {
    const viewport = document.createElement('div');
    const track = document.createElement('div');
    viewport.append(track);
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 300 });
    document.body.append(viewport);
    const remove = attachHorizontalTrackpadNavigation(viewport, vi.fn());
    wheel(viewport, 900);
    expect(track.style.translate).toBe('-270px 0px');
    remove();
    expect(track.style.translate).toBe('');
  });

  it('respects signed direction and canceling/reversing travel before release', () => {
    const viewport = document.createElement('div');
    const track = document.createElement('div');
    viewport.append(track);
    document.body.append(viewport);
    const navigate = vi.fn();
    const remove = attachHorizontalTrackpadNavigation(viewport, navigate);
    wheel(viewport, 50);
    expect(track.style.translate).toBe('-50px 0px');
    vi.advanceTimersByTime(60);
    wheel(viewport, -40);
    expect(track.style.translate).toBe('-10px 0px');
    vi.advanceTimersByTime(200);
    expect(navigate).not.toHaveBeenCalled();
    wheel(viewport, -90);
    vi.advanceTimersByTime(145);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('prev');
    // Opposite direction is a valid new gesture even inside momentum guard.
    wheel(viewport, 90);
    vi.advanceTimersByTime(145);
    expect(navigate).toHaveBeenNthCalledWith(2, 'next');
    remove();
  });

  it('ignores vertical, modifier, zoom-lane and editable wheel input without stealing it', () => {
    const viewport = document.createElement('div');
    const input = document.createElement('input');
    const zoomLane = document.createElement('div');
    zoomLane.dataset.calendarZoomLane = 'true';
    viewport.append(input, zoomLane);
    document.body.append(viewport);
    const navigate = vi.fn();
    const remove = attachHorizontalTrackpadNavigation(viewport, navigate);
    for (const event of [
      wheel(viewport, 12, 100), wheel(viewport, 100, 0, { ctrlKey: true }),
      wheel(input, 140), wheel(zoomLane, 140),
    ]) expect(event.defaultPrevented).toBe(false);
    vi.advanceTimersByTime(500);
    expect(navigate).not.toHaveBeenCalled();
    remove();
  });

  it('cancels queued snaps on pointer down, lock, and unmount', () => {
    const viewport = document.createElement('div');
    const track = document.createElement('div');
    viewport.append(track);
    document.body.append(viewport);
    const navigate = vi.fn();
    let enabled = true;
    const remove = attachHorizontalTrackpadNavigation(viewport, navigate, () => enabled);
    wheel(viewport, 90);
    expect(track.style.translate).toBe('-90px 0px');
    viewport.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(track.style.translate).toBe('');
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    vi.advanceTimersByTime(170);
    expect(navigate).not.toHaveBeenCalled();
    wheel(viewport, 90);
    enabled = false;
    vi.advanceTimersByTime(170);
    expect(navigate).not.toHaveBeenCalled();
    enabled = true;
    wheel(viewport, 90);
    remove();
    vi.advanceTimersByTime(500);
    expect(navigate).not.toHaveBeenCalled();
  });
});


describe('native horizontal trackpad release semantics', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

  function mounted() {
    const viewport = document.createElement('div');
    const track = document.createElement('div');
    viewport.append(track);
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 320 });
    document.body.append(viewport);
    const navigate = vi.fn();
    const remove = attachNativeHorizontalTrackpadNavigation(viewport, navigate);
    return { viewport, track, navigate, remove };
  }

  it('does not infer finger release from wheel inactivity, regardless of duration', () => {
    const { viewport, track, navigate, remove } = mounted();
    expect(viewport.scrollLeft).toBe(640);
    expect(track.style.translate).toBe('640px 0px');
    const event = wheel(viewport, 180);
    expect(event.defaultPrevented).toBe(false); // Native scrolling keeps OS inertia.
    viewport.scrollLeft = 860;
    vi.advanceTimersByTime(60_000);
    expect(navigate).not.toHaveBeenCalled();
    // Chromium scrollend fires after native gesture + inertial snap have ended.
    viewport.scrollLeft = 960;
    viewport.dispatchEvent(new Event('scrollend'));
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('next', true);
    expect(viewport.scrollLeft).toBe(640);
    remove();
    expect(track.style.translate).toBe('');
    expect(viewport.querySelector('[data-trackpad-snap-rail]')).toBeNull();
  });

  it('preserves a native inertial runway beyond the first neighbor before selecting exactly once', () => {
    const { viewport, navigate, remove } = mounted();
    const rail = viewport.querySelector<HTMLElement>('[data-trackpad-snap-rail]');
    expect(rail?.style.width).toBe('500%');
    expect(Array.from(rail?.children ?? []).map(node =>
      (node as HTMLElement).style.scrollSnapStop)).toEqual(['normal', 'normal', 'normal']);
    // A fast fling can travel past the next page's 960px snap point,
    // decelerate in the extra runway, then natively settle back to 960px.
    wheel(viewport, 900);
    viewport.scrollLeft = 1120;
    viewport.dispatchEvent(new Event('scroll'));
    expect(viewport.scrollLeft).toBe(1120); // No JS clamp or velocity loss.
    expect(navigate).not.toHaveBeenCalled();
    viewport.scrollLeft = 960;
    viewport.dispatchEvent(new Event('scrollend'));
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('next', true);
    expect(viewport.scrollLeft).toBe(640);
    remove();
  });

  it('keeps Day View native momentum with a smaller recoil runway', () => {
    const viewport = document.createElement('div');
    viewport.dataset.testid = 'day-swiper';
    const track = document.createElement('div');
    viewport.append(track);
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 320 });
    document.body.append(viewport);
    const navigate = vi.fn();
    const remove = attachNativeHorizontalTrackpadNavigation(viewport, navigate);
    const rail = viewport.querySelector<HTMLElement>('[data-trackpad-snap-rail]');
    expect(rail?.style.width).toBe('360%');
    expect(viewport.scrollLeft).toBeCloseTo(416);
    const stops = Array.from(rail?.children ?? []) as HTMLElement[];
    expect(stops).toHaveLength(3);
    for (const [index, stop] of stops.entries()) {
      expect(parseFloat(stop.style.left)).toBeCloseTo(100 * (index + 0.3) / 3.6);
    }
    const event = wheel(viewport, 900);
    expect(event.defaultPrevented).toBe(false);
    // The scroll snap's physical recoil can now be at most 0.3 widths.
    const nextStop = 320 * 2.3;
    const physicalEnd = 320 * 2.6;
    expect(physicalEnd - nextStop).toBeCloseTo(96);
    viewport.scrollLeft = physicalEnd;
    vi.advanceTimersByTime(60_000);
    expect(navigate).not.toHaveBeenCalled();
    viewport.scrollLeft = nextStop;
    viewport.dispatchEvent(new Event('scrollend'));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('next', true);
    expect(viewport.scrollLeft).toBeCloseTo(416);
    remove();
  });

  it('returns a short gesture to center without logical navigation', () => {
    const { viewport, navigate, remove } = mounted();
    wheel(viewport, 30);
    viewport.scrollLeft = 640; // Browser settles to the middle snap.
    viewport.dispatchEvent(new Event('scrollend'));
    expect(navigate).not.toHaveBeenCalled();
    remove();
  });

  it('keeps pointer drags, modifier wheels, vertical scroll and disabled states separate', () => {
    const { viewport, navigate, remove } = mounted();
    expect(wheel(viewport, 130, 0, { ctrlKey: true }).defaultPrevented).toBe(false);
    viewport.dispatchEvent(new Event('scrollend'));
    expect(navigate).not.toHaveBeenCalled();
    wheel(viewport, 30, 300);
    viewport.dispatchEvent(new Event('scrollend'));
    expect(navigate).not.toHaveBeenCalled();
    wheel(viewport, -320);
    viewport.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    viewport.scrollLeft = 320;
    viewport.dispatchEvent(new Event('scrollend'));
    expect(navigate).not.toHaveBeenCalled();
    window.dispatchEvent(new PointerEvent('pointerup'));
    wheel(viewport, -320);
    viewport.scrollLeft = 320;
    viewport.dispatchEvent(new Event('scrollend'));
    expect(navigate).toHaveBeenCalledWith('prev', true);
    remove();
  });
});
