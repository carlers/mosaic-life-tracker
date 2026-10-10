import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DatePickerSheet } from '../../src/components/home/views/DatePickerSheet';
import { BulkDatePickerSheet } from '../../src/components/home/views/BulkDatePickerSheet';

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));

describe('task date actions open a calendar by default', () => {
  it('normal tasks select a date in the visible calendar then confirm', () => {
    const onDateChange = vi.fn();
    render(<DatePickerSheet isOpen onClose={vi.fn()}
      task={{ id: 'task_a', date: '2026-10-10' }}
      onDateChange={onDateChange} />);
    expect(screen.getByRole('group', { name: 'Calendar dates' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'October 20, 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Date' }));
    expect(onDateChange).toHaveBeenCalledWith('2026-10-20');
  });
  it('bulk changes open that same calendar immediately', () => {
    const onSave = vi.fn();
    render(<BulkDatePickerSheet isOpen count={2} onClose={vi.fn()} onSave={onSave} />);
    expect(screen.getByRole('group', { name: 'Calendar dates' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Jump to date'),
      { target: { value: '2026-11-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Date' }));
    expect(onSave).toHaveBeenCalledWith('2026-11-20');
  });
});
