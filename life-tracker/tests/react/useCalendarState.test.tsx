// Regression: PROJECT_REFERENCE.md §16 — calendar swipes must not dispatch React state work from Embla's per-frame scroll event.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const emblaFixture = vi.hoisted(() => {
  const handlers = new Map<string, Set<() => void>>();
  let selectedIndex = 30;
  let progress = 0.5;

  const api = {
    on: vi.fn((event: string, handler: () => void) => {
      const set = handlers.get(event) ?? new Set<() => void>();
      set.add(handler);
      handlers.set(event, set);
      return api;
    }),
    off: vi.fn((event: string, handler: () => void) => {
      handlers.get(event)?.delete(handler);
      return api;
    }),
    scrollProgress: vi.fn(() => progress),
    selectedScrollSnap: vi.fn(() => selectedIndex),
    scrollTo: vi.fn(),
    scrollPrev: vi.fn(),
    scrollNext: vi.fn(),
  };

  return {
    api,
    reset() {
      handlers.clear();
      selectedIndex = 30;
      progress = 0.5;
      api.on.mockClear();
      api.off.mockClear();
      api.scrollProgress.mockClear();
      api.selectedScrollSnap.mockClear();
      api.scrollTo.mockClear();
      api.scrollPrev.mockClear();
      api.scrollNext.mockClear();
    },
    setProgress(value: number) {
      progress = value;
    },
    setSelectedIndex(value: number) {
      selectedIndex = value;
    },
    emit(event: string) {
      for (const handler of handlers.get(event) ?? []) handler();
    },
  };
});

vi.mock('embla-carousel-react', () => ({
  default: () => [vi.fn(), emblaFixture.api],
}));

import { useCalendarState } from '../../src/components/home/views/useCalendarState';

describe('useCalendarState render window', () => {
  let idleCallback: IdleRequestCallback | null = null;

  beforeEach(() => {
    emblaFixture.reset();
    idleCallback = null;
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
      idleCallback = callback;
      return 1;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the three-slide render window stable during per-frame scroll events', () => {
    const { result } = renderHook(() => useCalendarState());

    expect(result.current.renderStart).toBe(29);
    expect(result.current.renderEnd).toBe(31);

    act(() => {
      emblaFixture.setProgress(31 / 60);
      emblaFixture.emit('scroll');
    });

    expect(result.current.renderStart).toBe(29);
    expect(result.current.renderEnd).toBe(31);
  });

  it('updates fast consecutive swipe targets immediately while deferring heavy window shifts until settle', () => {
    const { result } = renderHook(() => useCalendarState());
    const initialTitle = result.current.title;

    act(() => {
      idleCallback?.({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
    });

    expect(result.current.renderStart).toBe(28);
    expect(result.current.renderEnd).toBe(32);

    act(() => {
      emblaFixture.setSelectedIndex(31);
      emblaFixture.emit('select');
    });

    const firstSwipeTitle = result.current.title;
    expect(firstSwipeTitle).not.toBe(initialTitle);
    expect(result.current.renderStart).toBe(28);
    expect(result.current.renderEnd).toBe(32);

    act(() => {
      emblaFixture.setSelectedIndex(32);
      emblaFixture.emit('select');
    });

    expect(result.current.title).not.toBe(firstSwipeTitle);
    expect(result.current.renderStart).toBe(28);
    expect(result.current.renderEnd).toBe(32);

    act(() => {
      emblaFixture.emit('settle');
    });

    expect(result.current.renderStart).toBe(30);
    expect(result.current.renderEnd).toBe(34);
  });
});
