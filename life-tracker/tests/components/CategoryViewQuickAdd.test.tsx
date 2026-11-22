import React from 'react';
import { addDays, format } from 'date-fns';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { localTodayDateKey } from '../../src/lib/categoryLifecycle';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';
import { CategoryView } from '../../src/components/home/views/CategoryView';

const mocks = vi.hoisted(() => ({
  addTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  toggleTaskCompletion: vi.fn(),
  removeTaskPhoto: vi.fn(),
  replaceTaskPhoto: vi.fn(),
  setSetting: vi.fn(),
}));
vi.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({
    addTask: mocks.addTask,
    updateTask: mocks.updateTask,
    deleteTask: mocks.deleteTask,
    toggleTaskCompletion: mocks.toggleTaskCompletion,
    removeTaskPhoto: mocks.removeTaskPhoto,
    replaceTaskPhoto: mocks.replaceTaskPhoto,
  }),
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: (_key: string, fallback: unknown) => fallback,
    setSetting: mocks.setSetting,
  }),
}));
vi.mock('../../src/components/home/views/TaskItem', () => ({
  TaskItem: ({ task }: { task: TaskDocument }) => <div data-testid="category-task">{task.title}</div>,
}));
vi.mock('../../src/components/home/views/CategoryTaskActions', () => ({
  CategoryTaskActions: () => null,
}));
const category: CategoryDocument = {
  id: 'school', name: 'School', color: '#10B981', order: 0,
  visibility: 'private', userId: 'owner', isDeleted: false,
  updatedAt: '2026-11-22T00:00:00Z',
};
const makeTask = (date: string): TaskDocument => ({
  id: 't-' + date, title: 'School task', date, categoryId: category.id,
  userId: 'owner', order: 0, completed: false, visibility: '', isDeleted: false,
  createdAt: '2026-11-22T00:00:00Z', updatedAt: '2026-11-22T00:00:00Z',
});
const offsetKey = (key: string, offset: number) =>
  format(addDays(new Date(key + 'T12:00:00'), offset), 'yyyy-MM-dd');

describe('Category View compact timeline and quick add (#2278)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addTask.mockResolvedValue('new-task');
    mocks.setSetting.mockResolvedValue(undefined);
  });

  it('omits empty Today and Past dates headings, but lets shortcuts select dates and create tasks', async () => {
    const today = localTodayDateKey();
    const yesterday = offsetKey(today, -1);
    const tomorrow = offsetKey(today, 1);
    const { container } = render(<CategoryView tasks={[makeTask(yesterday)]}
      categories={[category]} userId="owner" />);
    expect(container.querySelector('[data-category-date="' + today + '"]')).toBeNull();
    expect(screen.queryByText(/Past dates/i)).toBeNull();
    expect(screen.queryByText(/No matching tasks today/i)).toBeNull();

    const form = screen.getByRole('form', { name: 'Quick add category task' });
    const dateInput = within(form).getByLabelText('New task date') as HTMLInputElement;
    expect(dateInput.value).toBe(today);
    const shortcut = (label: string) => within(form).getByRole('button', { name: label });
    expect(shortcut('Today')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(shortcut('Tomorrow'));
    expect(dateInput.value).toBe(tomorrow);
    expect(shortcut('Tomorrow')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(shortcut('Yesterday'));
    expect(dateInput.value).toBe(yesterday);
    expect(shortcut('Yesterday')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(within(form).getByLabelText('New task title'), { target: { value: 'Plan homework' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(mocks.addTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Plan homework', date: yesterday, categoryId: 'school' })
    ));
  });

  it('retains a Today group only when Today has matching tasks', () => {
    const today = localTodayDateKey();
    const { container, rerender } = render(<CategoryView tasks={[makeTask(today)]}
      categories={[category]} userId="owner" />);
    expect(container.querySelector('[data-category-date="' + today + '"]')).not.toBeNull();
    expect(screen.getByText('School task')).toBeInTheDocument();
    rerender(<CategoryView tasks={[]} categories={[category]} userId="owner" />);
    expect(container.querySelector('[data-category-date="' + today + '"]')).toBeNull();
  });

  it('keeps category date-range validation for date shortcuts', () => {
    const today = localTodayDateKey();
    const untilToday = { ...category, startedOn: today, retiredOn: today };
    render(<CategoryView tasks={[]} categories={[untilToday]} userId="owner" />);
    const form = screen.getByRole('form', { name: 'Quick add category task' });
    fireEvent.click(within(form).getByRole('button', { name: 'Tomorrow' }));
    expect(within(form).getByText('This category is not active on the selected date.')).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Add' })).toBeDisabled();
  });
});
