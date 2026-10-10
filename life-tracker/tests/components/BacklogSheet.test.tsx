import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BacklogSheet } from '../../src/components/home/views/BacklogSheet';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));

const categories: CategoryDocument[] = [{
  id: 'cat_work', name: 'Work', color: '#3B82F6', order: 0,
  visibility: 'public', userId: 'user_me', isDeleted: false,
}];
function task(id: string, completed = false): TaskDocument {
  return {
    id, title: id, date: '', categoryId: 'cat_work', completed, order: 0,
    createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z',
    userId: 'user_me', visibility: 'public', isDeleted: false,
  };
}

describe('Backlog owner actions', () => {
  it('creates a private date-free task with an existing category', async () => {
    const onAddTask = vi.fn().mockResolvedValue(undefined);
    render(<BacklogSheet isOpen onClose={() => {}} tasks={[]} categories={categories}
      onAddTask={onAddTask} onUpdateTask={vi.fn()} onToggleTask={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Add a task'), { target: { value: 'Book tickets' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Backlog' }));
    await waitFor(() => expect(onAddTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Book tickets', date: '', categoryId: 'cat_work', visibility: 'private' })
    ));
  });

  it('schedules the same task ID and can display completed tasks', async () => {
    const onUpdateTask = vi.fn().mockResolvedValue(undefined);
    const onToggleTask = vi.fn().mockResolvedValue(undefined);
    render(<BacklogSheet isOpen onClose={() => {}} tasks={[task('open_task'), task('done_task', true)]}
      categories={categories} onAddTask={vi.fn()} onUpdateTask={onUpdateTask}
      onToggleTask={onToggleTask} />);
    expect(screen.getByText('open_task')).toBeTruthy();
    expect(screen.queryByText('done_task')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    await waitFor(() => expect(onUpdateTask).toHaveBeenCalledWith('open_task', {
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    }));
    fireEvent.click(screen.getByRole('button', { name: /Show completed/ }));
    expect(screen.getByText('done_task')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete open_task' }));
    await waitFor(() => expect(onToggleTask).toHaveBeenCalledWith('open_task', true));
  });
});
