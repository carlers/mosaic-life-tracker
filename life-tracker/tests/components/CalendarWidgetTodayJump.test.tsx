import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { format } from 'date-fns';

const daySheetState = vi.fn();

vi.mock('../../src/components/home/views/CalendarCarousel', () => ({
  CalendarCarousel: ({ onDayClick }: { onDayClick: (date: Date) => void }) => (
    <div>
      <div data-calendar-slide-index="0" role="region" aria-label="Month calendar scroll">
        <button data-calendar-day="2026-11-23" onClick={() => onDayClick(new Date(2026, 10, 23))}>
          November 23
        </button>
      </div>
    </div>
  ),
}));
vi.mock('../../src/components/home/views/DayViewSheet', () => ({
  DayPanelWallpaper: () => null,
  DayViewSheet: (props: { isOpen: boolean; selectedDate: Date }) => {
    if (props.isOpen) daySheetState(props);
    return props.isOpen ? <div data-testid="today-day-view">{format(props.selectedDate, 'yyyy-MM-dd')}</div> : null;
  },
}));
// CalendarBody's owner-only workout observer is intentionally inert in this geometry suite.
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'owner' } }),
}));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../src/hooks/useTasksByDate', () => ({
  useTasksByDate: () => new Map(),
}));
vi.mock('../../src/hooks/useHorizontalArrowNavigation', () => ({
  useHorizontalArrowNavigation: vi.fn(),
}));

import { CalendarBody } from '../../src/components/home/views/CalendarBody';

afterEach(() => {
  daySheetState.mockReset();
});

describe('Widgets Today → owned Calendar Day View', () => {
  it('opens the existing Day View for today, consumes exactly once, and keeps the Calendar mounted', async () => {
    const date = new Date(2026, 10, 23);
    const consumed = vi.fn();
    const request = { key: 21, date };
    const props = {
      viewMode: 'month' as const,
      slides: [date],
      activeIndex: 0,
      renderStart: 0,
      renderEnd: 0,
      emblaRef: vi.fn(),
      tasks: [],
      categoriesMap: {},
      variant: 'me' as const,
      currentUserId: 'owner',
      isActive: true,
      onPrev: vi.fn(),
      onNext: vi.fn(),
      openDateRequest: request,
      onOpenDateConsumed: consumed,
    };
    const { rerender } = render(<CalendarBody {...props} />);
    expect(await screen.findByTestId('today-day-view')).toHaveTextContent('2026-11-23');
    expect(screen.getByRole('button', { name: 'November 23' })).toBeInTheDocument();
    expect(consumed).toHaveBeenCalledExactlyOnceWith(21);
    expect(daySheetState.mock.calls.at(-1)?.[0]).toMatchObject({ isOpen: true, selectedDate: date });

    rerender(<CalendarBody {...props} />);
    expect(consumed).toHaveBeenCalledTimes(1);
    expect(daySheetState.mock.calls.at(-1)?.[0].selectedDate).toEqual(date);
  });

  it('ignores a widget request on a friend or inactive calendar', async () => {
    const onConsumed = vi.fn();
    const date = new Date(2026, 10, 23);
    const base = {
      viewMode: 'month' as const,
      slides: [date],
      activeIndex: 0,
      renderStart: 0,
      renderEnd: 0,
      emblaRef: vi.fn(),
      tasks: [],
      categoriesMap: {},
      currentUserId: 'owner',
      onPrev: vi.fn(),
      onNext: vi.fn(),
      openDateRequest: { key: 22, date },
      onOpenDateConsumed: onConsumed,
    };
    const { rerender } = render(<CalendarBody {...base} variant="me" isActive={false} />);
    await waitFor(() => expect(onConsumed).not.toHaveBeenCalled());
    rerender(<CalendarBody {...base} variant="friend" isActive />);
    await waitFor(() => expect(onConsumed).not.toHaveBeenCalled());
    expect(screen.queryByTestId('today-day-view')).not.toBeInTheDocument();
  });

  it('still allows a native calendar-day tap to open a different date', async () => {
    const date = new Date(2026, 10, 23);
    render(<CalendarBody viewMode="month" slides={[date]} activeIndex={0}
      renderStart={0} renderEnd={0} emblaRef={vi.fn()} tasks={[]} categoriesMap={{}}
      variant="me" currentUserId="owner" isActive onPrev={vi.fn()} onNext={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'November 23' }));
    expect(await screen.findByTestId('today-day-view')).toHaveTextContent('2026-11-23');
  });
});
