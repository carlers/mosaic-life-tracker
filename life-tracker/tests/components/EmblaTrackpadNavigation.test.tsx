import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmblaCarouselType } from 'embla-carousel';
import { useEmblaTrackpadNavigation } from '../../src/hooks/useEmblaTrackpadNavigation';

function makeHarness() {
  const viewport = document.createElement('div');
  const scrollNext = vi.fn();
  const scrollPrev = vi.fn();
  const api = { rootNode: () => viewport, scrollNext, scrollPrev } as unknown as EmblaCarouselType;
  function Harness() {
    useEmblaTrackpadNavigation(api);
    return <div>Calendar</div>;
  }
  render(<Harness />);
  const wheel = (deltaX: number, deltaY = 0, ctrlKey = false) =>
    viewport.dispatchEvent(new WheelEvent('wheel', {
      cancelable: true, bubbles: true, deltaMode: 0, deltaX, deltaY, ctrlKey,
    }));
  return { wheel, scrollNext, scrollPrev };
}

afterEach(() => vi.useRealTimers());

describe('Embla horizontal wheel navigation', () => {
  it('leaves vertical scrolling and zoom alone, and snaps once per horizontal burst', () => {
    vi.useFakeTimers();
    const { wheel, scrollNext, scrollPrev } = makeHarness();
    expect(wheel(10, 100)).toBe(true);
    expect(wheel(80, 0, true)).toBe(true);
    expect(scrollNext).not.toHaveBeenCalled();
    expect(wheel(32)).toBe(false);
    expect(wheel(36)).toBe(false);
    expect(wheel(100)).toBe(false);
    expect(scrollNext).toHaveBeenCalledOnce();
    expect(scrollPrev).not.toHaveBeenCalled();
  });

  it('allows the opposite direction on a new gesture after the idle gap', () => {
    vi.useFakeTimers();
    const { wheel, scrollNext, scrollPrev } = makeHarness();
    expect(wheel(70)).toBe(false);
    act(() => vi.advanceTimersByTime(320));
    expect(wheel(-70)).toBe(false);
    expect(scrollNext).toHaveBeenCalledOnce();
    expect(scrollPrev).toHaveBeenCalledOnce();
  });
});
