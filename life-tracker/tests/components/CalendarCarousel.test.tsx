import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarCarousel } from '../../src/components/home/views/CalendarCarousel';

vi.mock('../../src/components/home/views/CalendarSlide', () => ({
  CalendarSlide: () => <div>calendar-slide</div>,
}));

// Regression: stable calendar scrolling uses per-slide vertical scrolling with a fixed Embla viewport; [verify:full].
describe('CalendarCarousel behavior', () => {
  const baseProps = {
    slides: [new Date('2026-01-01')],
    renderStart: 0,
    renderEnd: 0,
    emblaRef: vi.fn(),
    viewMode: 'month' as const,
    onDayClick: vi.fn(),
    tasksByDate: new Map(),
    categoriesMap: {},
  };

  it('exposes the Embla swipe target without swallowing the parent pointer lifecycle', () => {
    const parentPointerDown = vi.fn();
    let swipeTarget: HTMLElement | null = null;
    const emblaRef = (node: HTMLElement | null) => {
      swipeTarget = node;
    };

    render(
      <div onPointerDown={parentPointerDown}>
        <CalendarCarousel {...baseProps} emblaRef={emblaRef} />
      </div>
    );

    expect(swipeTarget).toBeInstanceOf(HTMLElement);
    fireEvent.pointerDown(swipeTarget!);
    fireEvent.pointerMove(swipeTarget!);
    fireEvent.pointerUp(swipeTarget!);
    expect(parentPointerDown).toHaveBeenCalledTimes(1);
  });

  it('keeps the same height observer across adjacent month selections', () => {
    const original = globalThis.ResizeObserver;
    const observer = vi.fn();
    const disconnect = vi.fn();
    class MockResizeObserver {
      observe = observer;
      disconnect = disconnect;
    }
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    try {
      const nav = document.createElement('nav');
      nav.setAttribute('aria-label', 'Main');
      document.body.append(nav);
      const { rerender, unmount } = render(
        <CalendarCarousel {...baseProps} activeIndex={0} />
      );
      expect(observer).toHaveBeenCalled();
      const initialObservations = observer.mock.calls.length;
      rerender(<CalendarCarousel {...baseProps} activeIndex={1} />);
      expect(observer.mock.calls.length).toBe(initialObservations);
      expect(disconnect).not.toHaveBeenCalled();
      unmount();
      expect(disconnect).toHaveBeenCalled();
      nav.remove();
    } finally {
      globalThis.ResizeObserver = original;
    }
  });

  // Regression: only the active render window mounts expensive calendar content.
  it('mounts calendar content only for the requested render window', () => {
    const slides = Array.from(
      { length: 5 },
      (_, index) => new Date(2026, index, 1)
    );

    const { getAllByText } = render(
      <CalendarCarousel
        {...baseProps}
        slides={slides}
        renderStart={1}
        renderEnd={3}
      />
    );

    expect(getAllByText('calendar-slide')).toHaveLength(3);
  });
});
