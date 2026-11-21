import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachResponsiveTrackpadGesture } from '../../src/lib/responsiveTrackpadGesture';
import { attachResponsiveTrackpadNavigation } from '../../src/lib/horizontalTrackpadSnap';

let viewport: HTMLDivElement;
let track: HTMLDivElement;
let animations: Array<{ cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }>;
let animate: ReturnType<typeof vi.fn>;
let detach: (() => void) | null;

function wheel(dx: number, timestamp: number, dy = 0): void {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaMode: WheelEvent.DOM_DELTA_PIXEL,
    deltaX: dx,
    deltaY: dy,
  });
  Object.defineProperty(event, 'timeStamp', { value: timestamp });
  viewport.dispatchEvent(event);
}

describe('responsive trackpad navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    animations = [];
    detach = null;
    document.documentElement.dataset.reduceMotion = 'false';
    viewport = document.createElement('div');
    track = document.createElement('div');
    viewport.append(track);
    document.body.append(viewport);
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 400 });
    animate = vi.fn((_frames: Keyframe[], _options?: KeyframeAnimationOptions) => {
      const animation = { cancel: vi.fn(), onfinish: null };
      animations.push(animation);
      return animation as unknown as Animation;
    });
    Object.defineProperty(track, 'animate', { configurable: true, value: animate });
  });

  afterEach(() => {
    detach?.();
    viewport.remove();
    document.documentElement.dataset.reduceMotion = 'false';
    vi.useRealTimers();
  });

  it('does not compensate or navigate past the logical carousel boundary', () => {
    const navigate = vi.fn();
    detach = attachResponsiveTrackpadNavigation(
      viewport, navigate, () => true, direction => direction === 'prev',
    );
    wheel(130, 0);
    expect(track.style.translate).toBe('0px 0px');
    vi.advanceTimersByTime(85);
    expect(navigate).not.toHaveBeenCalled();
    expect(track.style.translate).toBe('');

    wheel(-130, 200);
    vi.advanceTimersByTime(85);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('prev', true);
  });

  it('keeps bounded visual motion alive during a fast wheel quiet gap', () => {
    const navigate = vi.fn();
    detach = attachResponsiveTrackpadNavigation(viewport, navigate);
    wheel(50, 10);
    vi.advanceTimersByTime(10);
    wheel(55, 20);
    vi.advanceTimersByTime(19);
    expect(animate).toHaveBeenCalledTimes(1);
    const frames = animate.mock.calls[0][0] as Array<{ translate: string }>;
    expect(frames[0].translate).not.toEqual(frames[1].translate);
    vi.advanceTimersByTime(82);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('next', true);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animations[0].cancel).toHaveBeenCalled();
  });

  it('honors Mosaic in-app reduced motion and cancels pending input on pointer down', () => {
    const navigate = vi.fn();
    document.documentElement.dataset.reduceMotion = 'true';
    detach = attachResponsiveTrackpadNavigation(viewport, navigate);
    wheel(60, 10);
    vi.advanceTimersByTime(10);
    wheel(60, 20);
    vi.advanceTimersByTime(100);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(animate).not.toHaveBeenCalled();

    wheel(90, 200);
    viewport.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(100);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('reports short-window wheel velocity without consuming vertical wheels', () => {
    const onMove = vi.fn();
    const onCommit = vi.fn();
    detach = attachResponsiveTrackpadGesture(viewport, { onMove, onCommit });
    wheel(0, 10, 150);
    expect(onMove).not.toHaveBeenCalled();

    wheel(45, 20);
    vi.advanceTimersByTime(12);
    wheel(50, 32);
    expect(onMove).toHaveBeenLastCalledWith(95, expect.any(Number));
    expect(onMove.mock.lastCall?.[1]).toBeGreaterThan(0);
    vi.advanceTimersByTime(85);
    expect(onCommit).toHaveBeenCalledWith(95, expect.any(Number));
  });
});
