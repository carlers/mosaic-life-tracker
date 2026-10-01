// Regression: §2 (memo opens read-first, then exposes explicit edit controls).
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}));

import { MemoSheet } from '../../src/components/home/views/MemoSheet';

const task: TaskDocument = {
  id: 'task_1',
  title: 'Task',
  completed: false,
  categoryId: 'work',
  order: 0,
  date: '2026-09-23',
  memo: 'Visible memo text',
  createdAt: '2026-09-23T00:00:00.000Z',
  updatedAt: '2026-09-23T00:00:00.000Z',
  userId: 'user_1',
  isDeleted: false,
  visibility: '',
};

describe('MemoSheet', () => {
  it('opens existing memo in read mode and enters edit mode when tapped again', () => {
    render(
      <MemoSheet isOpen onClose={vi.fn()} task={task} onSave={vi.fn()} initialMode="view" />
    );

    expect(screen.getByRole('button', { name: 'Edit memo' })).toHaveTextContent('Visible memo text');
    expect(screen.queryByRole('textbox', { name: 'Memo' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit memo' }));

    expect(screen.getByRole('textbox', { name: 'Memo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Visible to me only' })).toBeInTheDocument();
  });

  it('can open directly in edit mode and save private visibility from the toggle', () => {
    const onSave = vi.fn();
    render(
      <MemoSheet isOpen onClose={vi.fn()} task={task} onSave={onSave} initialMode="edit" />
    );

    fireEvent.click(screen.getByRole('switch', { name: 'Visible to me only' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onSave).toHaveBeenCalledWith('Visible memo text', 'private');
  });
});
