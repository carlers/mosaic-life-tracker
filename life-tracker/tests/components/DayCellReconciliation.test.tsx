import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DayCell } from '../../src/components/home/views/DayCell';
import type { TaskDocument } from '../../src/db/schema';

const taskRender = vi.hoisted(() => vi.fn());
vi.mock('../../src/components/home/views/TaskBlock', () => ({
  TaskBlock: ({ task, categoryColor, isShared }: {
    task: TaskDocument; categoryColor?: string; isShared?: boolean;
  }) => {
    taskRender(task.id, task.title, task.completed, categoryColor, isShared);
    return <span data-testid={`task-block-${task.id}`} data-completed={String(task.completed)}>
      {task.title}
    </span>;
  },
}));

const date = new Date(2026, 9, 18);
const categories = { cat: { name: 'Personal', color: '#F43F5E' } };
const onDayClick = vi.fn();
const mkTask = (id: string, title = id): TaskDocument => ({
  id, title, categoryId: 'cat', userId: 'user_1', order: 0,
  date: '2026-10-18', completed: false, completedAt: '',
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
  isDeleted: false, visibility: 'private',
});
const view = (tasks: TaskDocument[], overrides: Record<string, unknown> = {}) => (
  <DayCell date={date} tasks={tasks} categories={categories}
    onDayClick={onDayClick} {...overrides} />
);

describe('Calendar DayCell selective reconciliation', () => {
  beforeEach(() => {
    taskRender.mockClear();
    onDayClick.mockClear();
  });

  it('skips task subtree reconciliation when only its array was recreated', () => {
    const unchanged = mkTask('stable');
    const { rerender } = render(view([unchanged]));
    expect(taskRender).toHaveBeenCalledTimes(1);
    rerender(view([unchanged]));
    expect(taskRender).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('task-block-stable')).toHaveTextContent('stable');
    fireEvent.click(screen.getByRole('button', { name: /Sunday, October 18, 2026/ }));
    expect(onDayClick).toHaveBeenCalledWith(date);
  });

  it('re-renders a changed RxDB document, preserves completion and ordering', () => {
    const first = mkTask('a', 'Original');
    const second = mkTask('b', 'Second');
    const { rerender } = render(view([first, second]));
    expect(taskRender).toHaveBeenCalledTimes(2);
    const changed = { ...first, title: 'Edited', completed: true, updatedAt: '2026-10-18T03:00:00.000Z' };
    rerender(view([changed, second]));
    expect(taskRender).toHaveBeenCalledTimes(4);
    expect(screen.getByTestId('task-block-a')).toHaveTextContent('Edited');
    expect(screen.getByTestId('task-block-a')).toHaveAttribute('data-completed', 'true');
    expect([...screen.getByRole('button', { name: /2 tasks/ })
      .querySelectorAll('[data-testid^="task-block-"]')].map(element => element.getAttribute('data-testid')))
      .toEqual(['task-block-a', 'task-block-b']);
  });

  it('notices addition, deletion, and changed order despite fresh arrays', () => {
    const first = mkTask('first');
    const second = mkTask('second');
    const { rerender } = render(view([first]));
    rerender(view([first, second]));
    expect(screen.getAllByTestId(/task-block-/)).toHaveLength(2);
    rerender(view([second, first]));
    expect([...screen.getAllByTestId(/task-block-/)].map(element => element.textContent))
      .toEqual(['second', 'first']);
    rerender(view([second]));
    expect(screen.queryByTestId('task-block-first')).toBeNull();
    expect(screen.getByRole('button', { name: /1 task$/ })).toBeEnabled();
  });

  it('re-renders when category mapping or owned shared-task markers change', () => {
    const task = mkTask('share');
    const { rerender } = render(view([task]));
    const count = taskRender.mock.calls.length;
    rerender(view([task], { categories: { cat: { name: 'Personal', color: '#00FF00' } } }));
    expect(taskRender.mock.calls.length).toBeGreaterThan(count);
    expect(taskRender.mock.lastCall?.[3]).toBe('#00FF00');
    rerender(view([task], { ownedSharedTaskIds: new Set(['share']) }));
    expect(taskRender.mock.lastCall?.[4]).toBe(true);
  });

  it('re-renders when holiday and friend-shared content changes', () => {
    const task = mkTask('ordinary');
    const { rerender } = render(view([task]));
    rerender(view([task], { holidays: [{ id: 'holiday', title: 'Holiday' }] }));
    expect(screen.getByText('Holiday')).toBeInTheDocument();
    rerender(view([task], { sharedItems: [{ id: 'shared', title: 'Friend task' }] }));
    expect(screen.getByText('Friend task')).toBeInTheDocument();
  });
});
