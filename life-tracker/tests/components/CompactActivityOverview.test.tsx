import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CompactActivityOverview } from '../../src/components/home/views/CompactActivityOverview';

describe('CompactActivityOverview', () => {
  it('renders six accessible month drill-ins and actual activity counts', () => {
    const onMonthSelect = vi.fn();
    render(<CompactActivityOverview focusDate={new Date(2026, 1, 11)} zoom="half-year"
      counts={new Map([['2026-02-01', 1], ['2026-02-28', 2]])}
      weekStartsOn={1} onMonthSelect={onMonthSelect} noun="task" />);

    expect(screen.getAllByRole('button')).toHaveLength(6);
    const february = screen.getByRole('button', { name: 'Open February 2026, 3 tasks' });
    expect(february).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(february);
    expect(onMonthSelect).toHaveBeenCalledTimes(1);
    expect(onMonthSelect.mock.calls[0][0]).toEqual(new Date(2026, 1, 1));
    expect(screen.getByRole('group', { name: 'Six-month activity overview' })).toBeInTheDocument();
  });

  it('renders twelve months for a leap year with correct diary-entry pluralization', () => {
    render(<CompactActivityOverview focusDate={new Date(2024, 11, 5)} zoom="year"
      counts={new Map([['2024-02-29', 2]])}
      weekStartsOn={0} onMonthSelect={() => {}} noun="entry" />);
    expect(screen.getAllByRole('button')).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'Open February 2024, 2 entries' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open December 2024, 0 entries' })).toBeInTheDocument();
  });
});
