import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBubbleGestures } from '../../src/hooks/useBubbleGestures';

function pointerEvent(pointerId: number): React.PointerEvent {
  return {
    pointerId,
    pointerType: 'touch',
    button: 0,
    clientX: 10,
    clientY: 10,
    currentTarget: {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    },
  } as unknown as React.PointerEvent;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useBubbleGestures', () => {
  it('defers a triple-tap action until the originating pointer sequence settles', () => {
    vi.useFakeTimers();
    const onTripleTap = vi.fn();
    let frameCallback: FrameRequestCallback | null = null;
    const requestFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        frameCallback = callback;
        return 1;
      });

    const { result, unmount } = renderHook(() =>
      useBubbleGestures({
        onTripleTap,
        doubleTapWindow: 200,
        deferTripleTap: true,
      })
    );

    for (let pointerId = 1; pointerId <= 3; pointerId += 1) {
      act(() => {
        result.current.onPointerDown(pointerEvent(pointerId));
        result.current.onPointerUp(pointerEvent(pointerId));
        vi.advanceTimersByTime(50);
      });
    }

    expect(onTripleTap).not.toHaveBeenCalled();
    expect(frameCallback).not.toBeNull();

    act(() => {
      frameCallback?.(performance.now());
    });

    expect(onTripleTap).toHaveBeenCalledTimes(1);

    requestFrame.mockRestore();
    unmount();
    vi.useRealTimers();
  });

  it('reports the originating pointer only after the long-press threshold', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useBubbleGestures({ onLongPress, longPressThreshold: 500 })
    );

    act(() => {
      result.current.onPointerDown(pointerEvent(9));
      vi.advanceTimersByTime(499);
    });
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onLongPress).toHaveBeenCalledWith({
      pointerId: 9,
      pointerType: 'touch',
      clientX: 10,
      clientY: 10,
    });
  });

  it('cancels long-press recognition when vertical movement takes over', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useBubbleGestures({ onLongPress, longPressThreshold: 500 })
    );
    const down = pointerEvent(10);
    const moved = { ...down, clientY: 60 } as React.PointerEvent;

    act(() => {
      result.current.onPointerDown(down);
      result.current.onPointerMove(moved);
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });
});
