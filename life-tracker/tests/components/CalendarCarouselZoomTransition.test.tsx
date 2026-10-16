import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarCarousel } from '../../src/components/home/views/CalendarCarousel';

describe('zoomed Calendar period handoff', () => {
  it('starts the next month at weekday zero, and the previous at the last visible weekday', () => {
    const slides = [new Date(2026, 8, 1), new Date(2026, 9, 1), new Date(2026, 10, 1)];
    const onZoomNavigate = vi.fn(() => true);
    const props = {
      slides, renderStart: 0, renderEnd: 2, activeIndex: 1,
      emblaRef: vi.fn(), viewMode: 'month' as const, zoomDays: 3 as const,
      onZoomNavigate, onDayClick: vi.fn(),
      tasksByDate: new Map(), categoriesMap: {},
    };
    const view = render(<CalendarCarousel {...props} />);
    const lane = (index: number) => {
      const node = view.container.querySelector<HTMLDivElement>(
        `[data-calendar-slide-index="${index}"] [data-calendar-zoom-lane]`,
      );
      if (!node) throw new Error(`Slide ${index} is not mounted`);
      Object.defineProperties(node, {
        clientWidth: { configurable: true, value: 300 },
        scrollWidth: { configurable: true, value: 700 },
      });
      return node;
    };
    const previous = lane(0);
    const current = lane(1);
    const next = lane(2);
    current.scrollLeft = 400;
    next.scrollLeft = 400; // would be the wrong start of the incoming month
    fireEvent.scroll(current);
    fireEvent.touchStart(current, { touches: [{ clientX: 190, clientY: 30 }] });
    fireEvent.touchEnd(current, { changedTouches: [{ clientX: 70, clientY: 30 }] });
    expect(onZoomNavigate).toHaveBeenCalledTimes(1);
    expect(onZoomNavigate).toHaveBeenCalledWith('next');
    expect(next.scrollLeft).toBe(0);

    // Outgoing native scroll/snap events and another swipe cannot compete with
    // the in-flight month transition or overwrite the desired incoming offset.
    current.scrollLeft = 330;
    fireEvent.scroll(current);
    fireEvent.touchStart(current, { touches: [{ clientX: 190, clientY: 30 }] });
    fireEvent.touchEnd(current, { changedTouches: [{ clientX: 70, clientY: 30 }] });
    expect(onZoomNavigate).toHaveBeenCalledTimes(1);
    view.rerender(<CalendarCarousel {...props} activeIndex={2} isZoomTransitioning />);
    expect(next.scrollLeft).toBe(0);
    view.rerender(<CalendarCarousel {...props} activeIndex={2}
      renderStart={1} renderEnd={2} isZoomTransitioning={false} />);
    expect(next.scrollLeft).toBe(0);
    expect(current.scrollLeft).toBe(0);

    // The reverse handoff presents the last available 3-day page.
    current.scrollLeft = 0;
    next.scrollLeft = 0;
    fireEvent.scroll(next);
    fireEvent.touchStart(next, { touches: [{ clientX: 60, clientY: 30 }] });
    fireEvent.touchEnd(next, { changedTouches: [{ clientX: 160, clientY: 30 }] });
    expect(onZoomNavigate).toHaveBeenCalledWith('prev');
    expect(current.scrollLeft).toBe(400);
    expect(previous).toBeDefined();
  });
});
