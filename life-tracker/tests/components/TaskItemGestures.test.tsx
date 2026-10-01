// Regression: §2 (owner Day View gesture and memo contracts).
// Gesture assertions advance the 200ms disambiguation timer before checking deferred callbacks.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';

vi.mock('../../src/hooks/useImageLoadGate', () => ({
  useImageLoadGate: () => ({ targetRef: { current: null }, shouldLoad: false }),
}));
vi.mock('../../src/hooks/useTaskImage', () => ({
  useTaskImage: () => ({ imageUrl: null, isLoading: false }),
}));

import { TaskItem } from '../../src/components/home/views/TaskItem';

const task: TaskDocument = {
  id: 'task_1',
  title: 'Write release notes',
  completed: false,
  categoryId: 'work',
  order: 0,
  date: '2026-09-23',
  memo: 'Mention the migration.',
  createdAt: '2026-09-23T00:00:00.000Z',
  updatedAt: '2026-09-23T00:00:00.000Z',
  userId: 'user_1',
  isDeleted: false,
  visibility: '',
};

function tap(target: Element, pointerId: number) {
  fireEvent.pointerDown(target, {
    pointerId,
    pointerType: 'touch',
    clientX: 20,
    clientY: 20,
  });
  fireEvent.pointerUp(target, {
    pointerId,
    pointerType: 'touch',
    clientX: 20,
    clientY: 20,
  });
}

function renderTask() {
  const callbacks = {
    onToggle: vi.fn(),
    onOpenActions: vi.fn(),
    onOpenMemo: vi.fn(),
    onEditStart: vi.fn(),
    onViewImage: vi.fn(),
    onEditChange: vi.fn(),
    onEditSave: vi.fn(),
    onEditCancel: vi.fn(),
  };
  render(
    <TaskItem
      task={task}
      categoryColor="#3B82F6"
      currentUserId="user_1"
      isEditing={false}
      editValue=""
      {...callbacks}
    />
  );
  return callbacks;
}

describe('TaskItem owner gestures', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders memo content inline instead of a generic Memo label', () => {
    renderTask();
    expect(screen.getByText('Mention the migration.')).toBeInTheDocument();
    expect(screen.queryByText(/^Memo$/)).toBeNull();
  });

  it('opens task actions after the shortened tap-disambiguation window', () => {
    const callbacks = renderTask();
    const title = screen.getByRole('button', { name: 'Write release notes' });

    tap(title, 1);
    act(() => vi.advanceTimersByTime(199));
    expect(callbacks.onOpenActions).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(callbacks.onOpenActions).toHaveBeenCalledTimes(1);
  });

  it('single-taps the task for actions, double-taps to edit, and triple-taps for memo edit', () => {
    const callbacks = renderTask();
    const title = screen.getByRole('button', { name: 'Write release notes' });

    tap(title, 1);
    act(() => vi.advanceTimersByTime(210));
    expect(callbacks.onOpenActions).toHaveBeenCalledTimes(1);

    callbacks.onOpenActions.mockClear();
    tap(title, 2);
    tap(title, 3);
    act(() => vi.advanceTimersByTime(210));
    expect(callbacks.onEditStart).toHaveBeenCalledWith(task);
    expect(callbacks.onOpenActions).not.toHaveBeenCalled();

    callbacks.onEditStart.mockClear();
    tap(title, 4);
    tap(title, 5);
    tap(title, 6);
    act(() => vi.advanceTimersByTime(210));
    expect(callbacks.onOpenMemo).toHaveBeenCalledWith(task, 'edit');
    expect(callbacks.onEditStart).not.toHaveBeenCalled();
  });

  it('single-taps memo for read mode and double-taps it for direct edit mode', () => {
    const callbacks = renderTask();
    const memo = screen.getByRole('button', { name: 'Open memo' });

    tap(memo, 10);
    act(() => vi.advanceTimersByTime(210));
    expect(callbacks.onOpenMemo).toHaveBeenCalledWith(task, 'view');

    callbacks.onOpenMemo.mockClear();
    tap(memo, 11);
    tap(memo, 12);
    act(() => vi.advanceTimersByTime(210));
    expect(callbacks.onOpenMemo).toHaveBeenCalledWith(task, 'edit');
  });

  it('turns the row into a selectable control and suppresses normal task actions', () => {
    const onToggleSelection = vi.fn();
    const callbacks = {
      onToggle: vi.fn(),
      onOpenActions: vi.fn(),
      onOpenMemo: vi.fn(),
      onEditStart: vi.fn(),
      onViewImage: vi.fn(),
      onEditChange: vi.fn(),
      onEditSave: vi.fn(),
      onEditCancel: vi.fn(),
    };
    render(
      <TaskItem
        task={task}
        categoryColor="#3B82F6"
        currentUserId="user_1"
        isEditing={false}
        editValue=""
        selectionMode
        isSelected
        onToggleSelection={onToggleSelection}
        {...callbacks}
      />
    );

    const row = screen.getByRole('checkbox', { name: 'Write release notes, selected' });
    expect(row).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Open memo' })).toBeInTheDocument();

    fireEvent.keyDown(row, { key: ' ' });
    fireEvent.click(screen.getByRole('button', { name: 'Deselect task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open memo' }));

    expect(onToggleSelection).toHaveBeenCalledTimes(3);
    expect(callbacks.onToggle).not.toHaveBeenCalled();
    expect(callbacks.onOpenActions).not.toHaveBeenCalled();
    expect(callbacks.onOpenMemo).not.toHaveBeenCalled();
  });
});
