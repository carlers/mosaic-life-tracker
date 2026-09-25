// Regression: UIFIX-11 — expanded calendar cells must remain vertically reachable.
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';
import { CalendarCarousel } from '../../src/components/home/views/CalendarCarousel';

const focusDate = new Date(2026, 8, 1);
const task: TaskDocument = {
  id: 'task_1',
  title: 'A task that makes the cell grow',
  completed: false,
  categoryId: 'cat_1',
  date: '2026-09-01',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  userId: 'user_1',
  isDeleted: false,
  visibility: '',
};

describe('Calendar overflow layout', () => {
  it('keeps horizontal carousel clipping while exposing vertical overflow', () => {
    const { container } = render(
      <CalendarCarousel
        slides={[focusDate]}
        renderStart={0}
        renderEnd={0}
        emblaRef={vi.fn()}
        viewMode="month"
        onDayClick={vi.fn()}
        tasksByDate={new Map([['2026-09-01', [task]]])}
        categoriesMap={{ cat_1: { color: '#3B82F6', name: 'Work' } }}
      />
    );

    const viewport = container.firstElementChild;
    expect(viewport).toHaveClass('overflow-x-hidden', 'overflow-y-scroll');

    const emblaViewport = container.querySelector('.swiper-no-swiping');
    expect(emblaViewport).not.toBeNull();
    expect(emblaViewport).toHaveClass('overflow-hidden');

    const calendarGrid = container.querySelector('[role="rowgroup"]');
    expect(calendarGrid).not.toBeNull();
    expect(calendarGrid).toHaveClass('auto-rows-[minmax(min-content,1fr)]');
  });
});
