import React, { useCallback, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MonthView } from '../../src/components/home/views/MonthView';
import { WeekView } from '../../src/components/home/views/WeekView';
import { useCalendarGridKeyboard } from '../../src/components/home/views/useCalendarGridKeyboard';
import type { CalendarViewMode } from '../../src/components/home/views/useCalendarState';

const MONTH_SLIDES = [
  new Date(2026, 8, 15),
  new Date(2026, 9, 15),
  new Date(2026, 10, 15),
];
const WEEK_SLIDES = [
  new Date(2026, 9, 11),
  new Date(2026, 9, 18),
  new Date(2026, 9, 25),
];
const openDay = vi.fn();

function Harness({ mode = 'month', enabled = true }: { mode?: CalendarViewMode; enabled?: boolean }) {
  const [index, setIndex] = useState(1);
  const slides = mode === 'month' ? MONTH_SLIDES : WEEK_SLIDES;
  const onPrev = useCallback(() => setIndex(i => Math.max(0, i - 1)), []);
  const onNext = useCallback(() => setIndex(i => Math.min(2, i + 1)), []);
  const { rootRef, onKeyDown, onFocusCapture, activeKey } = useCalendarGridKeyboard({
    enabled, slides, activeIndex: index, viewMode: mode,
    weekStartsOn: 0, onPrev, onNext,
  });
  const View = mode === 'month' ? MonthView : WeekView;
  return <div ref={rootRef} onKeyDown={onKeyDown}
    onFocusCapture={onFocusCapture}>
    <label>Other input<input aria-label="Other input" /></label>
    <button type="button">Outside grid</button>
    <div data-calendar-slide-index={index} data-testid="active-calendar-slide">
      <View focusDate={slides[index]} keyboardActive keyboardFocusDay={activeKey}
        tasksByDate={new Map()} categoriesMap={{}} onDayClick={openDay} />
    </div>
  </div>;
}

function day(value: string) {
  const target = document.querySelector<HTMLButtonElement>(`button[data-calendar-day="${value}"]`);
  if (!target) throw new Error(`Missing day ${value}`);
  return target;
}

describe('Home calendar keyboard navigation', () => {
  it('exposes just one date in the active month to Tab and moves focus by arrows', () => {
    render(<Harness />);
    const days = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-calendar-day]'));
    expect(days.filter(button => button.tabIndex === 0)).toHaveLength(1);
    const initial = day('2026-10-15');
    expect(initial).toHaveAttribute('tabindex', '0');
    initial.focus();
    expect(fireEvent.keyDown(initial, { key: 'ArrowRight' })).toBe(false);
    expect(day('2026-10-16')).toHaveFocus();
    fireEvent.keyDown(day('2026-10-16'), { key: 'ArrowDown' });
    expect(day('2026-10-23')).toHaveFocus();
    fireEvent.keyDown(day('2026-10-23'), { key: 'Home' });
    expect(day('2026-10-18')).toHaveFocus();
    fireEvent.keyDown(day('2026-10-18'), { key: 'End' });
    expect(day('2026-10-24')).toHaveFocus();
    expect(days.filter(button => button.tabIndex === 0)).toHaveLength(1);
  });

  it('moves to the next month across the boundary and places focus on the right date', async () => {
    render(<Harness />);
    const first = day('2026-10-15');
    first.focus();
    fireEvent.keyDown(first, { key: 'PageDown' });
    await waitFor(() => expect(day('2026-11-15')).toHaveFocus());
    expect(screen.getByRole('grid', { name: 'November 2026 calendar' })).toBeInTheDocument();
    fireEvent.keyDown(day('2026-11-15'), { key: 'PageUp' });
    await waitFor(() => expect(day('2026-10-15')).toHaveFocus());
    day('2026-10-31').focus();
    fireEvent.keyDown(day('2026-10-31'), { key: 'ArrowRight' });
    await waitFor(() => expect(day('2026-11-01')).toHaveFocus());
  });

  it('supports week-mode up/down and PageDown with the same roving Tab stop', async () => {
    render(<Harness mode="week" />);
    const initial = day('2026-10-18');
    expect(initial.tabIndex).toBe(0);
    initial.focus();
    fireEvent.keyDown(initial, { key: 'ArrowRight' });
    expect(day('2026-10-19')).toHaveFocus();
    fireEvent.keyDown(day('2026-10-19'), { key: 'PageDown' });
    await waitFor(() => expect(day('2026-10-26')).toHaveFocus());
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-calendar-day]'));
    expect(buttons.filter(button => button.tabIndex === 0)).toHaveLength(1);
  });

  it('preserves text inputs, modified browser keys and native day activation', () => {
    openDay.mockClear();
    render(<Harness />);
    const start = day('2026-10-15');
    const input = screen.getByRole('textbox', { name: 'Other input' });
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(input).toHaveFocus();
    start.focus();
    fireEvent.keyDown(start, { key: 'ArrowLeft', ctrlKey: true });
    expect(start).toHaveFocus();
    fireEvent.click(start);
    expect(openDay).toHaveBeenCalledTimes(1);
    expect(openDay.mock.calls[0][0].getDate()).toBe(15);
  });

  it('avoids implicit ancestor scrolling while moving focus across calendar periods', async () => {
    const scrollSpy = vi.fn();
    const prior = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true, value: scrollSpy,
    });
    try {
      render(<Harness />);
      const first = day('2026-10-15');
      first.focus();
      fireEvent.keyDown(first, { key: 'PageDown' });
      await waitFor(() => expect(day('2026-11-15')).toHaveFocus());
      fireEvent.keyDown(day('2026-11-15'), { key: 'ArrowDown' });
      expect(day('2026-11-22')).toHaveFocus();
      expect(scrollSpy).not.toHaveBeenCalled();
    } finally {
      if (prior) Object.defineProperty(Element.prototype, 'scrollIntoView', prior);
      else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    }
  });

  it('supports G to focus the active grid but not from an editor or disabled pane', async () => {
    const { rerender } = render(<Harness />);
    const outside = screen.getByRole('button', { name: 'Outside grid' });
    outside.focus();
    act(() => fireEvent.keyDown(window, { key: 'g' }));
    await waitFor(() => expect(day('2026-10-15')).toHaveFocus());
    const input = screen.getByRole('textbox', { name: 'Other input' });
    input.focus();
    fireEvent.keyDown(input, { key: 'g' });
    expect(input).toHaveFocus();
    rerender(<Harness enabled={false} />);
    outside.focus();
    fireEvent.keyDown(window, { key: 'g' });
    expect(outside).toHaveFocus();
  });
});
