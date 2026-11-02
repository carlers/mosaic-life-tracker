// Regression: §16 (calendar swipes avoid React state work on Embla's per-frame scroll event).
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const emblaFixture = vi.hoisted(() => {
  const handlers = new Map<string, Set<() => void>>();
  const viewport = document.createElement('div');
  let slideOffset = 0;
  let engineLocation = -48000;
  viewport.getBoundingClientRect = vi.fn(() => ({ left: 0 } as DOMRect));
  // Real Embla has 61 distinct flex slides. On resize, their actual measured
  // spacing changes before the engine location is updated. Reusing one fake
  // node for every slide masked this geometry-dependent regression.
  const slides = Array.from({ length: 61 }, (_, index) => {
    const slide = document.createElement('div');
    slide.getBoundingClientRect = vi.fn(() => ({
      left: engineLocation + index * ((48000 + slideOffset) / 30),
    } as DOMRect));
    return slide;
  });
  const engine = {
    animation: { stop: vi.fn() },
    location: {
      get: vi.fn(() => engineLocation),
      set: vi.fn((value: number) => { engineLocation = value; }),
    },
    offsetLocation: { set: vi.fn() },
    previousLocation: { set: vi.fn() },
    target: { set: vi.fn() },
    translate: { to: vi.fn() },
  };
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
    rootNode: vi.fn(() => viewport),
    slideNodes: vi.fn(() => slides),
    internalEngine: vi.fn(() => engine),
    scrollProgress: vi.fn(() => progress),
    selectedScrollSnap: vi.fn(() => selectedIndex),
    scrollTo: vi.fn(),
    reInit: vi.fn(),
    scrollPrev: vi.fn(),
    scrollNext: vi.fn(),
  };

  return {
    api,
    engine,
    setSlideOffset(value: number) { slideOffset = value; },
    reset() {
      slideOffset = 0;
      engineLocation = -48000;
      engine.animation.stop.mockClear();
      engine.location.set.mockClear();
      engine.offsetLocation.set.mockClear();
      engine.previousLocation.set.mockClear();
      engine.target.set.mockClear();
      engine.translate.to.mockClear();
      handlers.clear();
      selectedIndex = 30;
      progress = 0.5;
      api.on.mockClear();
      api.off.mockClear();
      api.scrollProgress.mockClear();
      api.selectedScrollSnap.mockClear();
      api.scrollTo.mockClear();
      api.reInit.mockClear();
      api.scrollPrev.mockClear();
      api.scrollNext.mockClear();
    },
    setSelectedIndex(value: number) { selectedIndex = value; },
    setProgress(value: number) {
      progress = value;
    },
    emit(event: string) {
      for (const handler of handlers.get(event) ?? []) handler();
    },
  };
});

const weekControl = vi.hoisted(() => ({ enabled: true }));
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: () => weekControl.enabled,
}));
vi.mock('../../src/lib/featureControls', () => ({
  isFeatureEnabled: () => weekControl.enabled,
}));

vi.mock('embla-carousel-react', () => ({
  default: () => [vi.fn(), emblaFixture.api],
}));

import { useCalendarState } from '../../src/components/home/views/useCalendarState';

describe('useCalendarState render window', () => {
  it('pauses Week view without losing selected mode, and ignores stale toggles', () => {
    const { result, rerender } = renderHook(() => useCalendarState());
    act(() => result.current.handleToggle());
    expect(result.current.viewMode).toBe('week');
    weekControl.enabled = false;
    rerender();
    expect(result.current.viewMode).toBe('month');
    act(() => result.current.handleToggle());
    expect(result.current.viewMode).toBe('month');
    weekControl.enabled = true;
    rerender();
    expect(result.current.viewMode).toBe('week');
  });

  beforeEach(() => {
    emblaFixture.reset();
    weekControl.enabled = true;
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
  it('restores the focused month even when Embla temporarily selects a neighboring snap after a left split', async () => {
    const { result } = renderHook(() => useCalendarState());
    // A resize can leave Embla reporting an adjacent slide, while the header
    // still correctly shows the focused month. Never use that stale snap.
    emblaFixture.setSelectedIndex(29);
    emblaFixture.setSlideOffset(412);
    act(() => result.current.resnapAfterResize());
    await waitFor(() => expect(emblaFixture.api.reInit).toHaveBeenCalledWith({ startIndex: 30 }));
    expect(emblaFixture.engine.animation.stop).toHaveBeenCalled();
    expect(emblaFixture.engine.location.set).toHaveBeenCalledWith(-48412);
    expect(emblaFixture.engine.target.set).toHaveBeenCalledWith(-48412);
    expect(emblaFixture.engine.translate.to).toHaveBeenCalledWith(-48412);
    // Once the optional module has loaded, every resize correction must run
    // synchronously in ResizeObserver before the next paint. An import().then()
    // on each frame applied stale widths and made the month visibly jump.
    emblaFixture.setSlideOffset(90);
    act(() => { void result.current.resnapAfterResize(true); });
    expect(emblaFixture.engine.translate.to).toHaveBeenLastCalledWith(-48090);
  });
});
