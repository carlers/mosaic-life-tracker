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
    const day = within(grid).getByRole('button', {
      name: 'Tuesday, September 15, 2026, no tasks',
    });
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
    expect(
      within(grid).getByRole('button', {
        name: 'Wednesday, September 23, 2026, no tasks',
      })
    ).toBeEnabled();
  });

  it('keeps every weekday in one horizontally scrollable month grid at 3-day zoom', () => {
    const onDayClick = vi.fn();
    render(
      <MonthView
        focusDate={new Date(2026, 8, 15)}
        zoomDays={3}
        onDayClick={onDayClick}
        tasksByDate={emptyTasks}
        categoriesMap={{}}
      />
    );
    const lane = screen.getByRole('region', { name: 'Scrollable calendar weekdays' });
    const grid = within(lane).getByRole('grid', { name: 'September 2026 calendar' });
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(35);
    const day15 = within(grid).getByRole('button', {
      name: 'Tuesday, September 15, 2026, no tasks',
    });
    const day16 = within(grid).getByRole('button', {
      name: 'Wednesday, September 16, 2026, no tasks',
    });
    day15.focus();
    fireEvent.keyDown(day15, { key: 'ArrowRight' });
    expect(day16).toHaveFocus();
    fireEvent.click(day16);
    expect(onDayClick).toHaveBeenCalledWith(new Date(2026, 8, 16));
  });

  it('retains full weekday semantics in the 4-day week zoom and preserves 7-day default', () => {
    const week = render(
      <WeekView focusDate={new Date(2026, 8, 23)} zoomDays={4}
        onDayClick={() => {}} tasksByDate={emptyTasks} categoriesMap={{}} />
    );
    const lane = screen.getByRole('region', { name: 'Scrollable calendar weekdays' });
    expect(within(lane).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(lane).getAllByRole('gridcell')).toHaveLength(7);
    week.unmount();
    render(
      <WeekView focusDate={new Date(2026, 8, 23)}
        onDayClick={() => {}} tasksByDate={emptyTasks} categoriesMap={{}} />
    );
    expect(screen.queryByRole('region', { name: 'Scrollable calendar weekdays' })).toBeNull();
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
  });

  it('pins and horizontally aligns the weekday headings without duplicating grid semantics', () => {
    const month = render(
      <MonthView focusDate={new Date(2026, 8, 15)} zoomDays={3}
        stickyWeekdayHeader weekStartsOn={1}
        onDayClick={() => {}} tasksByDate={emptyTasks} categoriesMap={{}} />
    );
    const grid = screen.getByRole('grid', { name: 'September 2026 calendar' });
    const headings = within(grid).getAllByRole('columnheader');
    expect(headings).toHaveLength(7);
    expect(headings[0]).toHaveAccessibleName('Monday');
    const pinned = grid.querySelector('[data-sticky-weekday-header]');
    expect(pinned).toBeInTheDocument();
    const lane = screen.getByRole('region', { name: 'Scrollable calendar weekdays' });
    expect(within(lane).queryAllByRole('columnheader')).toHaveLength(0);
    expect(within(lane).getAllByRole('gridcell')).toHaveLength(35);
    Object.defineProperty(lane, 'scrollLeft', { configurable: true, writable: true, value: 90 });
    fireEvent.scroll(lane);
    expect(pinned?.querySelector('[role="row"]')).toHaveStyle({
      transform: 'translate3d(-90px, 0, 0)',
    });
    month.unmount();

    render(
      <WeekView focusDate={new Date(2026, 8, 23)} zoomDays={4}
        stickyWeekdayHeader onDayClick={() => {}}
        tasksByDate={emptyTasks} categoriesMap={{}} />
    );
    const weekGrid = screen.getByRole('grid', { name: 'Week of September 20, 2026' });
    expect(within(weekGrid).getAllByRole('columnheader')).toHaveLength(7);
    expect(weekGrid.querySelector('[data-sticky-weekday-header]')).toBeInTheDocument();
    expect(within(weekGrid).getAllByRole('gridcell')).toHaveLength(7);
  });

  // Regression: §2 (week-start preference applies to Calendar and Todo grids).
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

  // Regression: §2 (holiday overlay is visible and announced without becoming a task).
  it('announces a holiday separately from the task count', () => {
    // Freeze the clock so CI never changes this holiday's accessible name.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 12, 0, 0));
    render(
      <DayCell
        date={new Date(2026, 10, 2)}
        tasks={[]}
        categories={{}}
        holidays={[
          {
            id: 'PH:2026-11-02:All Souls Day',
            date: '2026-11-02',
            title: 'All Souls Day',
            countryCode: 'PH',
            types: ['Observance'],
          },
        ]}
        onDayClick={() => {}}
      />
    );

    expect(
      screen.getByRole('button', {
        name: /^Monday, November 2, 2026, (?:today, )?holiday: All Souls Day, no tasks$/,
      })
    ).toBeEnabled();
    expect(screen.getByText('All Souls Day')).toBeInTheDocument();
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
