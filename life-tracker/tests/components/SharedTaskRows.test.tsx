import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SharedTaskRows } from '../../src/components/home/views/SharedTaskRows';
import type { SharedTaskItem } from '../../src/lib/taskShareQueue';

vi.mock('../../src/hooks/useFriends', () => ({
  useOptionalFriendList: () => [{ friendId: 'owner_A', friendDisplayName: 'Alex' }],
}));
vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));

const row: SharedTaskItem = {
  id: 'shr_a', taskId: 'task_a', ownerId: 'owner_A', status: 'accepted',
  grantEpoch: 'grant_a', membershipRevision: 'm1', completionRevision: 'r1',
  completed: false, title: 'Shared presentation', date: '2026-10-11',
  allowTitleEdit: true, allowDateEdit: false,
};
const categories = [{
  id: 'cat_B', name: 'Personal planning', color: '#ffffff', order: 0,
  userId: 'user_B', isDeleted: false, visibility: 'private' as const, updatedAt: 'now',
}];
const baseProps = { items: [row], categories,
  pendingFor: () => undefined, onSetCompleted: vi.fn(), onLeave: vi.fn(),
};
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('received shared task interactions', () => {
  it('opens the task actions on title activation without three-dot or grip controls', async () => {
    const assign = vi.fn(async () => {});
    const copy = vi.fn(async () => {});
    render(<SharedTaskRows {...baseProps} categoryFor={() => ''}
      onAssignCategory={assign} onCopy={copy} />);
    expect(screen.queryByRole('button', { name: /manage shared task/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /drag shared task/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Shared presentation' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Assign shared task to my category' }),
      { target: { value: 'cat_B' } });
    await waitFor(() => expect(assign).toHaveBeenCalledWith(row, 'cat_B'));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith(row, 'cat_B'));
  });

  it('keeps the checkbox independent from title interactions', () => {
    const toggle = vi.fn();
    render(<SharedTaskRows {...baseProps} onSetCompleted={toggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }));
    expect(toggle).toHaveBeenCalledWith(row, true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('uses the familiar inline title editor only when the owner granted permission', async () => {
    const edit = vi.fn(async () => {});
    const date = vi.fn(async () => {});
    render(<SharedTaskRows {...baseProps} onEditTitle={edit} onChangeDate={date} />);
    fireEvent.click(screen.getByRole('button', { name: 'Shared presentation' }));
    expect(screen.getByRole('button', { name: /Change Date/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const input = await screen.findByRole('textbox', { name: 'Shared task title' });
    fireEvent.change(input, { target: { value: 'Updated by participant' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(edit).toHaveBeenCalledWith(row, 'Updated by participant'));
    expect(date).not.toHaveBeenCalled();
  });

  it('enforces owner-only editing without blocking an independent copy', () => {
    const disabledItem = { ...row, allowTitleEdit: false, allowDateEdit: false };
    render(<SharedTaskRows {...baseProps} items={[disabledItem]} onCopy={vi.fn(async () => {})} />);
    fireEvent.click(screen.getByRole('button', { name: 'Shared presentation' }));
    expect(screen.getByRole('button', { name: 'Edit · owner only' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Duplicate' })).not.toBeDisabled();
  });

  it('handles pointer double-tap as edit, rather than opening actions', async () => {
    const edit = vi.fn(async () => {});
    render(<SharedTaskRows {...baseProps} onEditTitle={edit} />);
    vi.useFakeTimers();
    const button = screen.getByRole('button', { name: 'Shared presentation' });
    for (let i = 0; i < 2; i++) {
      fireEvent.pointerDown(button, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 10 });
      fireEvent.pointerUp(button, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 10 });
      await act(async () => { vi.advanceTimersByTime(50); });
    }
    expect(screen.getByRole('textbox', { name: 'Shared task title' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
