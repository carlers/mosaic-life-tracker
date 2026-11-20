import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachHorizontalTrackpadNavigation } from '../../src/lib/horizontalTrackpadSnap';

function wheel(target: Element, deltaX: number, deltaY = 0, options: WheelEventInit = {}) {
  const event = new WheelEvent('wheel', {
    bubbles: true, cancelable: true, deltaMode: 0, deltaX, deltaY, ...options,
  });
  target.dispatchEvent(event);
  return event;
}

describe('horizontal trackpad period ownership', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

  it('waits for the last wheel delta, then moves one period, never snapping mid-burst', () => {
    const viewport = document.createElement('div');
    document.body.append(viewport);
    const navigate = vi.fn();
    const remove = attachHorizontalTrackpadNavigation(viewport, navigate);
    expect(wheel(viewport, 42).defaultPrevented).toBe(true);
    vi.advanceTimersByTime(120);
    expect(navigate).not.toHaveBeenCalled();
    wheel(viewport, 30);
    vi.advanceTimersByTime(144);
    expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('next');
    // The same inertial tail cannot turn one horizontal gesture into days.
    wheel(viewport, 115);
    vi.advanceTimersByTime(180);
    expect(navigate).toHaveBeenCalledTimes(1);
    remove();
  });

  it('respects signed direction and canceling/reversing travel before release', () => {
    const viewport = document.createElement('div');
    document.body.append(viewport);
    const navigate = vi.fn();
    const remove = attachHorizontalTrackpadNavigation(viewport, navigate);
    wheel(viewport, 50);
    vi.advanceTimersByTime(60);
    wheel(viewport, -40);
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
    document.body.append(viewport);
    const navigate = vi.fn();
    let enabled = true;
    const remove = attachHorizontalTrackpadNavigation(viewport, navigate, () => enabled);
    wheel(viewport, 90);
    viewport.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
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
