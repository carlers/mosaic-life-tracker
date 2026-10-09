// Regression: §16 (calendar swipes avoid React state work on Embla's per-frame scroll event).
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    rootNode: vi.fn(() => document.createElement('div')),
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
  beforeEach(() => {
    emblaFixture.reset();
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
});
