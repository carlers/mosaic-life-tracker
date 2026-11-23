import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CompactActivityOverview } from '../../src/components/home/views/CompactActivityOverview';

describe('CompactActivityOverview', () => {
  it('renders six accessible month drill-ins and actual activity counts', async () => {
    const onMonthSelect = vi.fn();
    render(<CompactActivityOverview focusDate={new Date(2026, 1, 11)} zoom="half-year"
      counts={new Map([['2026-02-01', 1], ['2026-02-28', 2]])}
      weekStartsOn={1} onMonthSelect={onMonthSelect} noun="task" />);

    expect(await screen.findAllByRole('button')).toHaveLength(6);
    const february = await screen.findByRole('button', { name: 'Open February 2026, 3 tasks' });
    expect(february).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(february);
    expect(onMonthSelect).toHaveBeenCalledTimes(1);
    expect(onMonthSelect.mock.calls[0][0]).toEqual(new Date(2026, 1, 1));
    expect(screen.getByRole('group', { name: 'Six-month activity overview' })).toBeInTheDocument();
  });

  it('renders twelve months for a leap year with correct diary-entry pluralization', async () => {
    render(<CompactActivityOverview focusDate={new Date(2024, 11, 5)} zoom="year"
      counts={new Map([['2024-02-29', 2]])}
      weekStartsOn={0} onMonthSelect={() => {}} noun="entry" />);
    expect(await screen.findAllByRole('button')).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'Open February 2024, 2 entries' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open December 2024, 0 entries' })).toBeInTheDocument();
  });
  it('shows exact task totals on occupied tiles only when enabled, clipping large labels without changing date data', async () => {
    const counts = new Map([
      ['2026-02-01', 3], ['2026-02-02', 105], ['2026-02-04', 1],
    ]);
    const base = {
      focusDate: new Date(2026, 1, 11), zoom: 'half-year' as const,
      counts, weekStartsOn: 1 as const, onMonthSelect: vi.fn(), noun: 'task',
    };
    const view = render(<CompactActivityOverview {...base} />);
    const february = await screen.findByRole('button', { name: 'Open February 2026, 109 tasks' });
    expect(february.querySelector('[title="Feb 1: 3"]')).toBeEmptyDOMElement();
    expect(february.querySelector('[title="Feb 2: 105"]')).toBeEmptyDOMElement();

    view.rerender(<CompactActivityOverview {...base} showTaskCounts />);
    expect(february.querySelector('[title="Feb 1: 3"]')).toHaveTextContent('3');
    expect(february.querySelector('[title="Feb 2: 105"]')).toHaveTextContent('99+');
    expect(february.querySelector('[title="Feb 3: 0"]')).toBeEmptyDOMElement();
    expect(february.querySelector('[title="Feb 4: 1"]')).toHaveTextContent('1');
    expect(base.onMonthSelect).not.toHaveBeenCalled();
    view.rerender(<CompactActivityOverview {...base} />);
    expect(february.querySelector('[title="Feb 1: 3"]')).toBeEmptyDOMElement();
  });

  it('never renders task-count numerals on Diary overview even if count display was enabled', async () => {
    render(<CompactActivityOverview focusDate={new Date(2024, 1, 1)} zoom="year"
      counts={new Map([['2024-02-29', 8]])}
      weekStartsOn={0} onMonthSelect={() => {}} noun="entry" showTaskCounts />);
    const february = await screen.findByRole('button', { name: 'Open February 2024, 8 entries' });
    expect(february.querySelector('[title="Feb 29: 8"]')).toBeEmptyDOMElement();
  });

});
