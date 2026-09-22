import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TodoListView } from '../../src/components/home/views/TodoListView';
import type { TaskDocument } from '../../src/db/schema';

const tasks: TaskDocument[] = [
  {
    id: 'task_1', title: 'Plan release', completed: false, categoryId: 'work', date: '2026-09-15',
    createdAt: '2026-09-01T00:00:00.000Z', completedAt: '', updatedAt: '2026-09-01T00:00:00.000Z',
    userId: 'user_1', isDeleted: false, visibility: 'private',
  },
];

describe('TodoListView', () => {
  // Regression: PROJECT_REFERENCE.md §2 — Todo List view.
  it('uses a color-only day grid and reveals the selected day task list', () => {
    const onToggleTask = vi.fn();
    render(
      <TodoListView
        focusDate={new Date(2026, 8, 15)}
        tasks={tasks}
        categoriesMap={{ work: { color: '#3B82F6', name: 'Work' } }}
        onToggleTask={onToggleTask}
      />
    );

    const grid = screen.getByRole('grid', { name: 'September 2026 todo calendar' });
    const selectedDay = within(grid).getByRole('gridcell', {
      name: 'Tuesday, September 15, 2026, 1 task',
    });
    expect(within(selectedDay).queryByText('Plan release')).toBeNull();

    fireEvent.click(selectedDay);
    expect(screen.getByRole('heading', { name: 'Tuesday, September 15' })).toBeInTheDocument();
    expect(screen.getByText('Plan release')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Plan release complete' }));
    expect(onToggleTask).toHaveBeenCalledWith(tasks[0]);
  });

  it('moves the selected day into the displayed month after month navigation', () => {
    const { rerender } = render(
      <TodoListView
        focusDate={new Date(2026, 8, 15)}
        tasks={tasks}
        categoriesMap={{ work: { color: '#3B82F6', name: 'Work' } }}
        onToggleTask={() => {}}
      />
    );

    rerender(
      <TodoListView
        focusDate={new Date(2026, 9, 15)}
        tasks={tasks}
        categoriesMap={{ work: { color: '#3B82F6', name: 'Work' } }}
        onToggleTask={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Thursday, October 15' })).toBeInTheDocument();
    expect(screen.getByText('No tasks for this day.')).toBeInTheDocument();
  });

  it('keeps incomplete tasks before completed tasks in the selected-day list', () => {
    const completed = { ...tasks[0], id: 'task_2', title: 'Completed task', completed: true };
    render(
      <TodoListView
        focusDate={new Date(2026, 8, 15)}
        tasks={[completed, tasks[0]]}
        categoriesMap={{ work: { color: '#3B82F6', name: 'Work' } }}
        onToggleTask={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('gridcell', { name: 'Tuesday, September 15, 2026, 2 tasks' }));
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Plan release'),
      expect.stringContaining('Completed task'),
    ]);
  });
});
