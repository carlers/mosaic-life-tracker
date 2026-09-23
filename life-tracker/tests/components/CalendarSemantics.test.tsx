import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DayCell } from '../../src/components/home/views/DayCell';
import { MonthView } from '../../src/components/home/views/MonthView';
import { WeekView } from '../../src/components/home/views/WeekView';

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
    expect(within(day).getByText('15')).toHaveClass('text-sm');
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
