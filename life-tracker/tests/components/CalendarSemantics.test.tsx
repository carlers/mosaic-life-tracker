import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DayCell } from '../../src/components/home/views/DayCell';
import { MonthView } from '../../src/components/home/views/MonthView';
import { WeekView } from '../../src/components/home/views/WeekView';
import { TodoCalendarGrid } from '../../src/components/home/views/TodoCalendarGrid';

vi.mock('embla-carousel-react', () => ({
  default: () => [vi.fn(), null],
}));

const emptyTasks = new Map();

describe('calendar accessibility semantics', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes month view as a labelled seven-column grid without changing day actions', () => {
    const onDayClick = vi.fn();
    render(
      <MonthView
        focusDate={new Date(2026, 8, 15)}
        onDayClick={onDayClick}
        tasksByDate={emptyTasks}
        categoriesMap={{}}
      />
    );

    const grid = screen.getByRole('grid', { name: 'September 2026 calendar' });
    const headers = within(grid).getAllByRole('columnheader');
    const cells = within(grid).getAllByRole('gridcell');
    const rows = within(grid).getAllByRole('row');

    expect(headers).toHaveLength(7);
    expect(headers[0]).toHaveAccessibleName('Sunday');
    expect(headers[6]).toHaveAccessibleName('Saturday');
    expect(cells).toHaveLength(35);
    expect(rows).toHaveLength(6);
    // Regression: calendar row height is based on the tallest cell in that row,
    // rather than a single shared grid track height.
    const monthRows = rows.slice(1);
    expect(monthRows).toHaveLength(5);
    expect(monthRows.every((row) => row.classList.contains('grid'))).toBe(true);
    expect(monthRows.every((row) => row.classList.contains('grid-cols-7'))).toBe(true);
    expect(monthRows.every((row) => row.classList.contains('contents'))).toBe(false);

    const day = within(grid).getByRole('button', {
      name: 'Tuesday, September 15, 2026, no tasks',
    });
    expect(within(day).getByText('15')).toHaveClass('text-sm');
    expect(day).toHaveClass('min-h-[4.25rem]');
    fireEvent.click(day);
    expect(onDayClick).toHaveBeenCalledWith(new Date(2026, 8, 15));
  });

  it('exposes week view as one labelled row with full weekday header names', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0));

    render(
      <WeekView
        focusDate={new Date(2026, 8, 23)}
        onDayClick={() => {}}
        tasksByDate={emptyTasks}
        categoriesMap={{}}
      />
    );

    const grid = screen.getByRole('grid', {
      name: 'Week of September 20, 2026',
    });
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(7);
    expect(within(grid).getAllByRole('row')).toHaveLength(2);
    const weekRow = within(grid).getAllByRole('row')[1];
    expect(weekRow).toHaveClass('grid', 'grid-cols-7');
    expect(weekRow).not.toHaveClass('contents');
    expect(
      within(grid).getByRole('button', {
        name: 'Wednesday, September 23, 2026, no tasks',
      })
    ).toBeEnabled();
  });

  // Regression: PROJECT_REFERENCE.md §2 — week-start preference applies to Calendar and Todo grids.
  it('starts month, week, and Todo calendars on Monday when Sunday-start is disabled', () => {
    const month = render(
      <MonthView
        focusDate={new Date(2026, 8, 15)}
        onDayClick={() => {}}
        tasksByDate={emptyTasks}
        categoriesMap={{}}
        weekStartsOn={1}
      />
    );
    let grid = screen.getByRole('grid', { name: 'September 2026 calendar' });
    let headers = within(grid).getAllByRole('columnheader');
    expect(headers[0]).toHaveAccessibleName('Monday');
    expect(headers[6]).toHaveAccessibleName('Sunday');
    month.unmount();

    const week = render(
      <WeekView
        focusDate={new Date(2026, 8, 23)}
        onDayClick={() => {}}
        tasksByDate={emptyTasks}
        categoriesMap={{}}
        weekStartsOn={1}
      />
    );
    grid = screen.getByRole('grid', {
      name: 'Week of September 21, 2026',
    });
    headers = within(grid).getAllByRole('columnheader');
    expect(headers[0]).toHaveAccessibleName('Monday');
    expect(headers[6]).toHaveAccessibleName('Sunday');
    week.unmount();

    render(
      <TodoCalendarGrid
        focusDate={new Date(2026, 8, 15)}
        selectedDate={new Date(2026, 8, 15)}
        tasks={[]}
        categories={[]}
        categoriesMap={{}}
        onDateSelect={() => {}}
        onMonthChange={() => {}}
        weekStartsOn={1}
      />
    );
    grid = screen.getByRole('grid', {
      name: 'September 2026 todo calendar',
    });
    headers = within(grid).getAllByRole('columnheader');
    expect(headers[0]).toHaveTextContent('M');
    expect(headers[6]).toHaveTextContent('S');
    expect(
      within(grid).getByRole('gridcell', {
        name: 'Monday, August 31, 2026, 0 tasks',
      })
    ).toBeInTheDocument();
  });

  it('marks today as the current date and noninteractive days as disabled', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 21, 12, 0, 0));

    const { rerender } = render(
      <DayCell
        date={new Date(2026, 8, 21)}
        tasks={[]}
        categories={{}}
        onDayClick={() => {}}
      />
    );

    const today = screen.getByRole('button', {
      name: 'Monday, September 21, 2026, today, no tasks',
    });
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(today).toHaveAttribute('aria-disabled', 'false');

    rerender(
      <DayCell
        date={new Date(2026, 8, 22)}
        tasks={[]}
        categories={{}}
      />
    );

    const disabled = screen.getByRole('button', {
      name: 'Tuesday, September 22, 2026, no tasks',
    });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
  });
});
