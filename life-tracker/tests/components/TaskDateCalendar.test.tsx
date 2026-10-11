import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TaskDateCalendar } from '../../src/components/home/views/TaskDateCalendar';

describe('task date calendar parity', () => {
  it('immediately displays a calendar, selects a date, and changes months', () => {
    const change = vi.fn();
    render(<TaskDateCalendar value="2026-10-10" onChange={change} />);
    expect(screen.getByRole('group', { name: 'Calendar dates' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'October 15, 2026' }));
    expect(change).toHaveBeenCalledWith('2026-10-15');
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('button', { name: 'November 15, 2026' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Jump to date'),
      { target: { value: '2027-03-20' } });
    expect(change).toHaveBeenCalledWith('2027-03-20');
  });
});
