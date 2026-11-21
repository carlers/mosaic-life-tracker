import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmblaCarouselType } from 'embla-carousel';
import { useEmblaTrackpadNavigation } from '../../src/hooks/useEmblaTrackpadNavigation';

async function makeHarness() {
  const viewport = document.createElement('div');
  let selected = 30;
  const scrollTo = vi.fn((index: number) => { selected = index; });
  const api = { rootNode: () => viewport, scrollTo, selectedScrollSnap: () => selected } as unknown as EmblaCarouselType;
  function Harness() {
    useEmblaTrackpadNavigation(api);
    return <div>Calendar</div>;
  }
  render(<Harness />);
  // The wheel recognizer is an optional lazy chunk, not eager Home startup JS.
  await act(async () => { await import('../../src/lib/horizontalTrackpadSnap'); });
  const wheel = (deltaX: number, deltaY = 0, ctrlKey = false) => {
    const event = new WheelEvent('wheel', {
      cancelable: true, bubbles: true, deltaMode: 0, deltaX, deltaY, ctrlKey,
    });
    // Happy DOM's WheelEvent does not reliably expose the MouseEvent
    // modifier value; real browsers do.
    Object.defineProperty(event, 'ctrlKey', { value: ctrlKey });
    return viewport.dispatchEvent(event);
  };
  return { wheel, scrollTo };
}

afterEach(() => vi.useRealTimers());

describe('Embla horizontal wheel navigation', () => {
  it('leaves vertical scrolling and zoom alone, and snaps once per horizontal burst', async () => {
    vi.useFakeTimers();
    const { wheel, scrollTo } = await makeHarness();
    wheel(10, 100);
    wheel(80, 0, true);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(wheel(32)).toBe(false);
    expect(wheel(36)).toBe(false);
    expect(wheel(100)).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(144));
    expect(scrollTo).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(scrollTo).toHaveBeenCalledOnce();
    expect(scrollTo).toHaveBeenCalledWith(31, undefined);
  });

  it('allows the opposite direction on a new gesture after the idle gap', async () => {
    vi.useFakeTimers();
    const { wheel, scrollTo } = await makeHarness();
    expect(wheel(70)).toBe(false);
    act(() => vi.advanceTimersByTime(320));
    expect(wheel(-70)).toBe(false);
    act(() => vi.advanceTimersByTime(145));
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenNthCalledWith(2, 30, undefined);
  });
});
