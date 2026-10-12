import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCalendarState } from '../../src/components/home/views/useCalendarState';

const fake = vi.hoisted(() => ({
  selected: 30,
  nextCalls: 0,
  callbacks: new Map<string, Set<() => void>>(),
}));
vi.mock('embla-carousel-react', () => {
  const emit = (event: string) => fake.callbacks.get(event)?.forEach((cb) => cb());
  const api = {
    on: (event: string, cb: () => void) => {
      if (!fake.callbacks.has(event)) fake.callbacks.set(event, new Set());
      fake.callbacks.get(event)?.add(cb);
    },
    off: (event: string, cb: () => void) => { fake.callbacks.get(event)?.delete(cb); },
    selectedScrollSnap: () => fake.selected,
    canScrollNext: () => true,
    canScrollPrev: () => true,
    scrollNext: () => {
      fake.selected += 1;
      fake.nextCalls += 1;
      emit('select');
    },
    scrollPrev: () => { fake.selected -= 1; emit('select'); },
    scrollTo: (index: number) => { fake.selected = index; emit('select'); },
  };
  return { default: () => [() => {}, api] };
});
vi.mock('../../src/hooks/useEmblaTrackpadNavigation', () => ({
  useEmblaTrackpadNavigation: () => {},
}));

describe('zoomed calendar period navigation responsiveness', () => {
  let frames: FrameRequestCallback[];
  beforeEach(() => {
    fake.selected = 30;
    fake.nextCalls = 0;
    fake.callbacks.clear();
    frames = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a second swipe after the destination paints, without waiting for Embla settle', () => {
    const { result } = renderHook(() => useCalendarState());
    act(() => { expect(result.current.handleZoomNavigate('next')).toBe(true); });
    expect(result.current.isZoomTransitioning).toBe(true);
    act(() => { expect(result.current.handleZoomNavigate('next')).toBe(false); });
    expect(fake.nextCalls).toBe(1);
    // No 'settle' event: two frames suffice to make the next month interactive.
    act(() => { frames.shift()?.(16); frames.shift()?.(32); });
    expect(result.current.isZoomTransitioning).toBe(false);
    act(() => { expect(result.current.handleZoomNavigate('next')).toBe(true); });
    expect(fake.nextCalls).toBe(2);
  });
});
