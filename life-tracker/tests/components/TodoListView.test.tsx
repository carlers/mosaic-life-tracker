import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';

vi.mock('../../src/components/home/views/DayViewSheet', () => ({
  DayViewSheet: ({
    selectedDate,
    onDateChange,
    renderMode,
  }: {
    selectedDate: Date;
    onDateChange?: (date: Date) => void;
    renderMode?: 'sheet' | 'inline';
  }) => (
    <div
      data-testid="inline-day-view-mock"
      data-render-mode={renderMode}
      data-selected-date={`${selectedDate.getFullYear()}-${String(
        selectedDate.getMonth() + 1
      ).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`}
    >
      <button
        type="button"
        onClick={() => onDateChange?.(new Date(2026, 9, 1))}
      >
        Swipe to October 1
      </button>
    </div>
  ),
}));

import { TodoListView } from '../../src/components/home/views/TodoListView';

const tasks: TaskDocument[] = [
  {
    id: 'task_1',
    title: 'Plan release',
    completed: false,
    categoryId: 'work',
    date: '2026-09-15',
    createdAt: '2026-09-01T00:00:00.000Z',
    completedAt: '',
    updatedAt: '2026-09-01T00:00:00.000Z',
    userId: 'user_1',
    isDeleted: false,
    visibility: 'private',
  },
];

describe('TodoListView', () => {
  // Regression: PROJECT_REFERENCE.md §2 — Todo List view.
  it('keeps the compact calendar color-only and renders the selected day through the inline DayView surface', () => {
    render(
      <TodoListView
        focusDate={new Date(2026, 8, 15)}
        tasks={tasks}
        categoriesMap={{ work: { color: '#3B82F6', name: 'Work' } }}
        onFocusDateChange={() => {}}
      />
    );

    const grid = screen.getByRole('grid', {
      name: 'September 2026 todo calendar',
    });
    const selectedDay = within(grid).getByRole('gridcell', {
      name: 'Tuesday, September 15, 2026, 1 task',
    });
    expect(within(selectedDay).queryByText('Plan release')).toBeNull();

    fireEvent.click(selectedDay);

    expect(
      screen.getByRole('heading', { name: 'Tuesday, September 15' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('inline-day-view-mock')).toHaveAttribute(
      'data-render-mode',
      'inline'
    );
    expect(screen.getByTestId('inline-day-view-mock')).toHaveAttribute(
      'data-selected-date',
      '2026-09-15'
    );
  });

  // Regression: PROJECT_REFERENCE.md §7 — nested carousel gesture ownership.
  it('marks the whole Todo List as a parent-Swiper no-swiping region', () => {
    const { container } = render(
      <TodoListView
        focusDate={new Date(2026, 8, 15)}
        tasks={tasks}
        categoriesMap={{ work: { color: '#3B82F6', name: 'Work' } }}
        onFocusDateChange={() => {}}
      />
    );

    expect(container.firstElementChild).toHaveClass('swiper-no-swiping');
  });

  it('moves the selected day into the displayed month after month navigation', () => {
    const { rerender } = render(
      <TodoListView
        focusDate={new Date(2026, 8, 15)}
        tasks={tasks}
        categoriesMap={{ work: { color: '#3B82F6', name: 'Work' } }}
        onFocusDateChange={() => {}}
      />
    );

    rerender(
      <TodoListView
        focusDate={new Date(2026, 9, 15)}
        tasks={tasks}
        categoriesMap={{ work: { color: '#3B82F6', name: 'Work' } }}
        onFocusDateChange={() => {}}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Thursday, October 15' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('inline-day-view-mock')).toHaveAttribute(
      'data-selected-date',
      '2026-10-15'
    );
  });

  // Regression: PROJECT_REFERENCE.md §2/§7 — inline day swipes own their date navigation.
  it('updates the visible month when the inline day view swipes across a month boundary', () => {
    const onFocusDateChange = vi.fn();
    render(
      <TodoListView
        focusDate={new Date(2026, 8, 30)}
        tasks={tasks}
        categoriesMap={{ work: { color: '#3B82F6', name: 'Work' } }}
        onFocusDateChange={onFocusDateChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Swipe to October 1' }));

    expect(
      screen.getByRole('heading', { name: 'Thursday, October 1' })
    ).toBeInTheDocument();
    expect(onFocusDateChange).toHaveBeenCalledWith(new Date(2026, 9, 1));
  });
});
