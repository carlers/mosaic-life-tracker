import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
const weekHeaderFlag = vi.hoisted(() => ({ enabled: true }));
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: () => weekHeaderFlag.enabled,
}));
import { CalendarHeader } from '../../src/components/home/views/CalendarHeader';

describe('CalendarHeader zoom gesture ownership', () => {
  it('hides the optional week toggle without hiding calendar navigation', () => {
    weekHeaderFlag.enabled = false;
    const props = { title: 'October 2026', viewMode: 'month' as const,
      activeView: 'calendar' as const, onViewChange: vi.fn(),
      onToggleMode: vi.fn(), onPrev: vi.fn(), onNext: vi.fn() };
    const { rerender } = render(<CalendarHeader {...props} />);
    expect(screen.queryByRole('button', { name: 'Switch to week view' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled();
    weekHeaderFlag.enabled = true;
    rerender(<CalendarHeader {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to week view' }));
    expect(props.onToggleMode).toHaveBeenCalledTimes(1);
  });

  it('swipes the title to a neighbor month without accidentally going to today', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onToday = vi.fn();
    render(<CalendarHeader title="October 2026" viewMode="month"
      activeView="calendar" onViewChange={vi.fn()}
      onToggleMode={vi.fn()} onPrev={onPrev} onNext={onNext}
      onTitleClick={onToday} enableTitleSwipe />);
    const title = screen.getByRole('button', { name: 'Go to today' });
    fireEvent.touchStart(title, { touches: [{ clientX: 180, clientY: 35 }] });
    fireEvent.touchEnd(title, { changedTouches: [{ clientX: 90, clientY: 36 }] });
    fireEvent.click(title);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
    expect(onToday).not.toHaveBeenCalled();

    // A subsequent normal tap remains a working Go to today action.
    fireEvent.touchStart(title, { touches: [{ clientX: 90, clientY: 35 }] });
    fireEvent.touchEnd(title, { changedTouches: [{ clientX: 90, clientY: 35 }] });
    fireEvent.click(title);
    expect(onToday).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('leaves the seven-day default header touch behavior unchanged', () => {
    const onNext = vi.fn();
    const onToday = vi.fn();
    render(<CalendarHeader title="October 2026" viewMode="month"
      activeView="calendar" onViewChange={vi.fn()}
      onToggleMode={vi.fn()} onPrev={vi.fn()} onNext={onNext}
      onTitleClick={onToday} />);
    const title = screen.getByRole('button', { name: 'Go to today' });
    fireEvent.touchStart(title, { touches: [{ clientX: 180, clientY: 35 }] });
    fireEvent.touchEnd(title, { changedTouches: [{ clientX: 90, clientY: 35 }] });
    expect(onNext).not.toHaveBeenCalled();
    fireEvent.click(title);
    expect(onToday).toHaveBeenCalledTimes(1);
  });
});
