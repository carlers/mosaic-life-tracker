import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TaskTimelineList } from '../../src/components/home/views/TaskTimelineList';

const categories = [
  { id: 'work', name: 'Work', color: '#3B82F6' },
  { id: 'personal', name: 'Personal', color: '#F59E0B' },
] as React.ComponentProps<typeof TaskTimelineList>['categories'];

function renderTimeline() {
  const onAddTask = vi.fn();
  const onSortBasisChange = vi.fn();
  const onDirectionChange = vi.fn();
  render(
    <TaskTimelineList
      dateStr="2026-10-20"
      tasks={[]}
      categories={categories}
      currentUserId="owner"
      editingTaskId={null}
      editValue=""
      onToggleTask={vi.fn()}
      onAddTask={onAddTask}
      onOpenActions={vi.fn()}
      onOpenMemo={vi.fn()}
      onEditTask={vi.fn()}
      onViewImage={vi.fn()}
      onEditChange={vi.fn()}
      onEditSave={vi.fn()}
      onEditCancel={vi.fn()}
      direction="desc"
      sortBasis="completion"
      onSortBasisChange={onSortBasisChange}
      onDirectionChange={onDirectionChange}
      timestampDisplay={{ showCreated: false, showCompleted: false, labelStyle: 'icons' }}
    />
  );
  return { onAddTask, onSortBasisChange, onDirectionChange };
}

describe('Timeline category menus', () => {
  it('filters using the accessible custom category menu', async () => {
    renderTimeline();
    fireEvent.click(screen.getByRole('combobox', { name: 'Filter timeline by category: All categories' }));
    const menu = await screen.findByRole('listbox', { name: 'Filter timeline by category' });
    expect(menu).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Work' }));
    expect(screen.getByRole('combobox', { name: 'Filter timeline by category: Work' })).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Filter timeline by category' })).toBeNull());
  });

  it('opens by keyboard and closes with Escape without changing category', async () => {
    renderTimeline();
    const trigger = screen.getByRole('combobox', { name: 'New task category: Work' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const menu = await screen.findByRole('listbox', { name: 'New task category' });
    expect(menu).toBeInTheDocument();
    fireEvent.keyDown(menu, { key: 'End' });
    expect(screen.getByRole('option', { name: 'Personal' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: 'New task category' })).toBeNull();
    expect(trigger).toHaveFocus();
    expect(screen.getByRole('combobox', { name: 'New task category: Work' })).toBeInTheDocument();
  });

  it('uses the chosen category when adding a task and keeps the category picker available', async () => {
    const { onAddTask } = renderTimeline();
    fireEvent.click(screen.getByRole('combobox', { name: 'New task category: Work' }));
    await screen.findByRole('listbox', { name: 'New task category' });
    fireEvent.click(screen.getByRole('option', { name: 'Personal' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New timeline task title' }), {
      target: { value: '  Pay rent  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add timeline task' }));
    expect(onAddTask).toHaveBeenCalledWith('Pay rent', 'personal', '2026-10-20');
    expect(screen.getByRole('textbox', { name: 'New timeline task title' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'New task category: Personal' })).toBeInTheDocument();
  });

  it('keeps the direction control in the timeline sorting group', () => {
    const { onDirectionChange } = renderTimeline();
    const sorting = screen.getByRole('group', { name: 'Timeline sorting' });
    const direction = screen.getByRole('button', { name: 'Timeline newest first; switch to oldest' });
    expect(sorting).toContainElement(direction);
    fireEvent.click(direction);
    expect(onDirectionChange).toHaveBeenCalledWith('asc');
    expect(screen.getByRole('button', { name: 'Completed first' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps timeline sorting basis as an independent state choice', () => {
    const { onSortBasisChange } = renderTimeline();
    fireEvent.click(screen.getByRole('button', { name: 'Creation date' }));
    expect(onSortBasisChange).toHaveBeenCalledWith('creation');
    expect(screen.getByRole('button', { name: 'Completed first' })).toHaveAttribute('aria-pressed', 'true');
  });
});
