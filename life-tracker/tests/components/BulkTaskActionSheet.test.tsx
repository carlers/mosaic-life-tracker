import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BulkTaskActionSheet } from '../../src/components/home/views/BulkTaskActionSheet';

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen:boolean; children:React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));

describe('bulk task Change Date', () => {
  it('opens a visible app calendar on the same tap, without another sheet', async () => {
    const save = vi.fn(async () => {});
    const close = vi.fn();
    render(<BulkTaskActionSheet isOpen count={2} onClose={close}
      onMoveCategory={vi.fn()} onChangeDate={save}
      onDoToday={vi.fn()} onDoTomorrow={vi.fn()} onVisibility={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change Date' }));
    expect(screen.getByRole('group', { name: 'Calendar dates' })).toBeTruthy();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Jump to date'), { target: { value: '2026-10-27' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Date' }));
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith('2026-10-27'));
    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });
});
