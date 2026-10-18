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

  it('first mounts just the focused owner month, then prepares neighbors after a paint opportunity', async () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextId = 0;
    const raf = vi.spyOn(window, 'requestAnimationFrame')
      .mockImplementation(callback => { frames.set(++nextId, callback); return nextId; });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(id => { frames.delete(id); });
    try {
      const { result, rerender } = renderHook(
        ({ ownerDataReady }) => useCalendarState({ deferNeighbors: true, ownerDataReady }),
        { initialProps: { ownerDataReady: false } },
      );
      expect([result.current.renderStart, result.current.renderEnd]).toEqual([30, 30]);
      rerender({ ownerDataReady: true });
      expect([result.current.renderStart, result.current.renderEnd]).toEqual([30, 30]);
      await act(async () => {
        const first = frames.get(1);
        if (!first) throw new Error('Missing first paint frame');
        first(16);
        const second = frames.get(2);
        if (!second) throw new Error('Missing second paint frame');
        second(32);
      });
      expect([result.current.renderStart, result.current.renderEnd]).toEqual([29, 31]);
    } finally {
      raf.mockRestore();
      cancel.mockRestore();
    }
  });

  it('mounts neighbors immediately when the user navigates before owner data is ready', () => {
    const { result } = renderHook(() => useCalendarState({
      deferNeighbors: true,
      ownerDataReady: false,
    }));
    expect([result.current.renderStart, result.current.renderEnd]).toEqual([30, 30]);
    act(() => result.current.handleNext());
    expect(emblaFixture.api.scrollNext).toHaveBeenCalledOnce();
    expect([result.current.renderStart, result.current.renderEnd]).toEqual([29, 31]);
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
