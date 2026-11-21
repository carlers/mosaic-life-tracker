import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  attachResponsiveTrackpadGesture,
  RESPONSIVE_TRACKPAD_QUIET_MS,
  RESPONSIVE_TRACKPAD_SETTLE_MS,
} from '../../src/lib/responsiveTrackpadGesture';

function wheel(target: Element, x: number, y = 0, ctrlKey = false) {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true,
    deltaMode: 0, deltaX: x, deltaY: y });
  // Happy DOM has an incomplete WheelEvent modifier implementation.
  Object.defineProperty(event, 'ctrlKey', { value: ctrlKey });
  return target.dispatchEvent(event);
}

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('reusable responsive trackpad wheel recognizer', () => {
  it('tracks signed pixels live and commits only after the 82ms quiet window', () => {
    vi.useFakeTimers();
    const surface = document.createElement('div');
    document.body.append(surface);
    const moves: number[] = [];
    const onCommit = vi.fn();
    const detach = attachResponsiveTrackpadGesture(surface, {
      onMove: pixels => moves.push(pixels), onCommit,
    });
    expect(RESPONSIVE_TRACKPAD_QUIET_MS).toBe(82);
    expect(RESPONSIVE_TRACKPAD_SETTLE_MS).toBe(140);
    expect(wheel(surface, 38)).toBe(false);
    vi.advanceTimersByTime(60);
    expect(wheel(surface, 37)).toBe(false);
    vi.advanceTimersByTime(81);
    expect(onCommit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(moves).toEqual([38, 75]);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(75);
    expect(wheel(surface, -64)).toBe(false);
    vi.advanceTimersByTime(82);
    expect(onCommit).toHaveBeenCalledWith(-64);
    detach();
  });

  it('preserves vertical/zoom/editor/scroll-owner lanes', () => {
    vi.useFakeTimers();
    const surface = document.createElement('div');
    const editor = document.createElement('input');
    surface.append(editor);
    document.body.append(surface);
    const onCommit = vi.fn();
    const detach = attachResponsiveTrackpadGesture(surface, {
      accepts: (_event, target) => target !== editor, onMove: vi.fn(), onCommit,
    });
    expect(wheel(surface, 30, 90)).toBe(true);
    expect(wheel(surface, 90, 0, true)).toBe(true);
    expect(wheel(editor, 90)).toBe(true);
    expect(wheel(surface, 90)).toBe(false);
    vi.advanceTimersByTime(82);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(90);
    detach();
  });

  it('cancels held-pointer sessions, stale timers and listeners on detach', () => {
    vi.useFakeTimers();
    const surface = document.createElement('div');
    document.body.append(surface);
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const detach = attachResponsiveTrackpadGesture(surface, {
      onMove: vi.fn(), onCommit, onCancel,
    });
    wheel(surface, 100);
    surface.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(200);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
    window.dispatchEvent(new Event('pointerup'));
    wheel(surface, -80);
    detach();
    vi.advanceTimersByTime(200);
    expect(onCommit).not.toHaveBeenCalled();
    expect(wheel(surface, 120)).toBe(true);
  });
});
