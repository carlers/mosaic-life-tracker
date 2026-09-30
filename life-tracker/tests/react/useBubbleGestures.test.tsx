import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
});
