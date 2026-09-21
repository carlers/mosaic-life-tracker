import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarCarousel } from '../../src/components/home/views/CalendarCarousel';

vi.mock('../../src/components/home/views/CalendarSlide', () => ({
  CalendarSlide: () => <div>calendar-slide</div>,
}));

describe('CalendarCarousel gesture ownership', () => {
  const props = {
    slides: [new Date('2026-01-01')],
    renderStart: 0,
    renderEnd: 0,
    emblaRef: vi.fn(),
    viewMode: 'month' as const,
    onDayClick: vi.fn(),
    tasksByDate: new Map(),
    categoriesMap: {},
  };

  it('marks the calendar as a parent-Swiper no-swiping region without intercepting its pointer lifecycle', () => {
    const parentPointerDown = vi.fn();
    const { container } = render(
      <div onPointerDown={parentPointerDown}>
        <CalendarCarousel {...props} />
      </div>
    );

    const viewport = container.querySelector('.flex-1');
    expect(viewport).not.toBeNull();
    expect(viewport).toHaveClass('swiper-no-swiping');

    fireEvent.pointerDown(viewport!);
    fireEvent.pointerMove(viewport!);
    fireEvent.pointerUp(viewport!);

    // The calendar no longer cancels DOM propagation itself. Swiper's
    // no-swiping selector owns parent isolation, leaving Embla's pointer
    // sequence intact; the real nested behavior is pinned by Playwright.
    expect(parentPointerDown).toHaveBeenCalledTimes(1);
  });

  it('keeps the calendar carousel swipe target mounted for Embla', () => {
    const { container } = render(<CalendarCarousel {...props} />);
    const viewport = container.querySelector('.flex-1');

    expect(viewport).not.toBeNull();
    expect(viewport).toContainElement(container.querySelector('.flex.min-h-full.items-start'));
  });
});
