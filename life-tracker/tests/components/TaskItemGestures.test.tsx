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

type FocusedInputMode = 'creation' | 'editing';

function renderTaskWithInlineInput(
  allowCheckboxes: boolean,
  keepFocus: boolean,
  inputMode: FocusedInputMode = 'creation',
  onInputBlur: () => void = vi.fn(),
) {
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
  const editingTask: TaskDocument = { ...task, id: 'task_editor', title: 'Edit another task' };
  render(
    <div
      data-task-checkbox-preferences-scope="true"
      data-allow-task-checkboxes-while-adding={String(allowCheckboxes)}
      data-keep-task-input-focused-on-checkbox={String(keepFocus)}
    >
      {inputMode === 'creation' ? (
        <input
          aria-label="New task title"
          data-task-inline-input
          data-task-creation-input
          onBlur={onInputBlur}
        />
      ) : (
        <TaskItem
          task={editingTask}
          categoryColor="#3B82F6"
          currentUserId="user_1"
          isEditing
          editValue="Unsaved title"
          {...callbacks}
          onEditSave={onInputBlur}
        />
      )}
      <TaskItem
        task={task}
        categoryColor="#3B82F6"
        currentUserId="user_1"
        isEditing={false}
        editValue=""
        {...callbacks}
      />
    </div>
  );
  const input = screen.getByRole('textbox', {
    name: inputMode === 'creation' ? 'New task title' : 'Task title',
  });
  input.focus();
  return {
    callbacks,
    input,
    checkbox: screen.getAllByRole('button', { name: 'Mark complete' }).at(-1)!,
  };
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

  it('toggles completion while an existing title editor keeps focus until an intentional blur', () => {
    const callbacks = {
      onToggle: vi.fn(), onOpenActions: vi.fn(), onOpenMemo: vi.fn(),
      onEditStart: vi.fn(), onEditChange: vi.fn(),
      onEditSave: vi.fn(), onEditCancel: vi.fn(),
    };
    render(
      <TaskItem task={task} categoryColor="#3B82F6" currentUserId="user_1"
        isEditing editValue="Unsaved title" {...callbacks} />
    );
    const input = screen.getByRole('textbox', { name: 'Task title' });
    const checkbox = screen.getByRole('button', { name: 'Mark complete' });
    expect(input).toHaveFocus();
    expect(fireEvent.pointerDown(checkbox, { pointerType: 'touch' })).toBe(false);
    fireEvent.click(checkbox);
    expect(callbacks.onToggle).toHaveBeenCalledExactlyOnceWith(task.id);
    expect(callbacks.onEditSave).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(callbacks.onEditSave).toHaveBeenCalledOnce();
  });

  it('keeps the edited task checkbox actionable when other-task preferences are disabled', () => {
    const callbacks = {
      onToggle: vi.fn(), onOpenActions: vi.fn(), onOpenMemo: vi.fn(),
      onEditStart: vi.fn(), onEditChange: vi.fn(),
      onEditSave: vi.fn(), onEditCancel: vi.fn(),
    };
    render(
      <div
        data-task-checkbox-preferences-scope="true"
        data-allow-task-checkboxes-while-adding="false"
        data-keep-task-input-focused-on-checkbox="false"
      >
        <TaskItem task={task} categoryColor="#3B82F6" currentUserId="user_1"
          isEditing editValue="Unsaved title" {...callbacks} />
      </div>
    );
    const input = screen.getByRole('textbox', { name: 'Task title' });
    const checkbox = screen.getByRole('button', { name: 'Mark complete' });
    expect(fireEvent.pointerDown(checkbox, { pointerType: 'touch' })).toBe(false);
    fireEvent.click(checkbox, { detail: 1 });
    expect(callbacks.onToggle).toHaveBeenCalledExactlyOnceWith(task.id);
    expect(callbacks.onEditSave).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
  });

  it('toggles another task while a different task title is being edited', () => {
    const callbacks = {
      onToggle: vi.fn(), onOpenActions: vi.fn(), onOpenMemo: vi.fn(),
      onEditStart: vi.fn(), onEditChange: vi.fn(),
      onEditSave: vi.fn(), onEditCancel: vi.fn(),
    };
    render(
      <>
        <TaskItem task={task} categoryColor="#3B82F6" currentUserId="user_1"
          isEditing editValue="Unsaved title" {...callbacks} />
        <TaskItem task={{ ...task, id: 'task_2', title: 'Review draft' }}
          categoryColor="#3B82F6" currentUserId="user_1"
          isEditing={false} editValue="" {...callbacks} />
      </>
    );
    const input = screen.getByRole('textbox', { name: 'Task title' });
    const checkbox = screen.getAllByRole('button', { name: 'Mark complete' })[1];
    expect(input).toHaveFocus();
    expect(fireEvent.pointerDown(checkbox, { pointerType: 'mouse' })).toBe(false);
    fireEvent.click(checkbox);
    expect(callbacks.onToggle).toHaveBeenCalledExactlyOnceWith('task_2');
    expect(callbacks.onEditSave).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
  });

  it.each([
    { allowCheckboxes: true, keepFocus: true, toggles: true },
    { allowCheckboxes: true, keepFocus: false, toggles: true },
    { allowCheckboxes: false, keepFocus: true, toggles: false },
    { allowCheckboxes: false, keepFocus: false, toggles: false },
  ])('applies creation checkbox preferences: allow=$allowCheckboxes keepFocus=$keepFocus', ({
    allowCheckboxes, keepFocus, toggles,
  }) => {
    const { callbacks, input, checkbox } =
      renderTaskWithInlineInput(allowCheckboxes, keepFocus);
    expect(fireEvent.pointerDown(checkbox, { pointerType: 'touch' })).toBe(false);
    fireEvent.click(checkbox, { detail: 1 });
    expect(callbacks.onToggle).toHaveBeenCalledTimes(toggles ? 1 : 0);
    if (toggles) expect(callbacks.onToggle).toHaveBeenCalledWith(task.id);
    if (keepFocus) expect(input).toHaveFocus();
    else expect(input).not.toHaveFocus();
  });

  it.each(['creation', 'editing'] as const)('waits for checkbox completion before blurring a %s input when keep-focus is off', async (inputMode) => {
    const order: string[] = [];
    const { callbacks, input, checkbox } = renderTaskWithInlineInput(
      true,
      false,
      inputMode,
      () => order.push('blur'),
    );
    callbacks.onToggle.mockImplementation(async () => {
      await Promise.resolve();
      order.push('toggle');
    });
    fireEvent.pointerDown(checkbox, { pointerType: 'touch' });
    expect(input).toHaveFocus();
    expect(order).toEqual([]);
    fireEvent.click(checkbox, { detail: 1 });
    expect(input).toHaveFocus();
    expect(order).toEqual([]);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(order).toEqual(['toggle', 'blur']);
    expect(input).not.toHaveFocus();
  });

  it.each([
    { allowCheckboxes: true, keepFocus: true, toggles: true },
    { allowCheckboxes: true, keepFocus: false, toggles: true },
    { allowCheckboxes: false, keepFocus: true, toggles: false },
    { allowCheckboxes: false, keepFocus: false, toggles: false },
  ])('applies the same preferences to another task while a title is being edited: allow=$allowCheckboxes keepFocus=$keepFocus', ({
    allowCheckboxes, keepFocus, toggles,
  }) => {
    const order: string[] = [];
    const { callbacks, input, checkbox } = renderTaskWithInlineInput(
      allowCheckboxes,
      keepFocus,
      'editing',
      () => order.push('blur'),
    );
    callbacks.onToggle.mockImplementation(() => { order.push('toggle'); });
    expect(input).toHaveFocus();
    expect(fireEvent.pointerDown(checkbox, { pointerType: 'touch' })).toBe(false);
    expect(input).toHaveFocus();
    expect(order).toEqual([]);
    fireEvent.click(checkbox, { detail: 1 });
    expect(callbacks.onToggle).toHaveBeenCalledTimes(toggles ? 1 : 0);
    expect(order).toEqual([
      ...(toggles ? ['toggle'] : []),
      ...(keepFocus ? [] : ['blur']),
    ]);
    if (keepFocus) expect(input).toHaveFocus();
    else expect(input).not.toHaveFocus();
  });

  it('completes an edited cross-row checkbox on pointerup even if blur fires and click is lost', () => {
    const order: string[] = [];
    const { callbacks, input, checkbox } =
      renderTaskWithInlineInput(true, true, 'editing', () => order.push('save'));
    callbacks.onToggle.mockImplementation(() => { order.push('toggle'); });
    fireEvent.pointerDown(checkbox, {
      pointerType: 'touch', pointerId: 7, button: 0, isPrimary: true,
      clientX: 12, clientY: 12,
    });
    input.blur(); // Simulate native mobile focus transfer before pointerup/click.
    expect(order).toEqual([]);
    fireEvent.pointerUp(checkbox, {
      pointerType: 'touch', pointerId: 7, button: 0, clientX: 12, clientY: 12,
    });
    expect(order).toEqual(['toggle']);
    expect(input).toHaveFocus();
    // The browser may emit a click as well: it must not complete twice.
    // Chromium touch click.detail can be zero; suppress regardless of detail.
    fireEvent.click(checkbox, { detail: 0 });
    expect(callbacks.onToggle).toHaveBeenCalledOnce();
    expect(order).toEqual(['toggle']);
  });

  it('cancels an editing checkbox tap when touch movement becomes a scroll', () => {
    const { callbacks, input, checkbox } = renderTaskWithInlineInput(true, true, 'editing');
    fireEvent.pointerDown(checkbox, {
      pointerType: 'touch', pointerId: 8, button: 0, clientX: 12, clientY: 12,
    });
    fireEvent.pointerMove(checkbox, {
      pointerType: 'touch', pointerId: 8, clientX: 12, clientY: 45,
    });
    fireEvent.pointerUp(checkbox, {
      pointerType: 'touch', pointerId: 8, clientX: 12, clientY: 45,
    });
    expect(callbacks.onToggle).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
  });

  it('keeps keyboard completion working after an editing pointerup fallback', () => {
    const { callbacks, checkbox } = renderTaskWithInlineInput(true, true, 'editing');
    fireEvent.pointerDown(checkbox, { pointerType: 'touch', pointerId: 9, button: 0 });
    fireEvent.pointerUp(checkbox, { pointerType: 'touch', pointerId: 9 });
    expect(callbacks.onToggle).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(checkbox, { key: 'Enter' });
    fireEvent.click(checkbox, { detail: 0 });
    expect(callbacks.onToggle).toHaveBeenCalledTimes(2);
  });

  it('does not suppress keyboard activation after a blurred pointer attempt', () => {
    const { callbacks, input, checkbox } = renderTaskWithInlineInput(false, false);
    fireEvent.pointerDown(checkbox, { pointerType: 'touch' });
    expect(input).toHaveFocus();
    fireEvent.keyDown(checkbox, { key: 'Enter' });
    fireEvent.click(checkbox, { detail: 0 });
    expect(callbacks.onToggle).toHaveBeenCalledExactlyOnceWith(task.id);
  });

  it('keeps completion inert in Select mode while row and title selection still work', () => {
    const onToggleSelection = vi.fn();
    const callbacks = {
      onToggle: vi.fn(), onOpenActions: vi.fn(), onOpenMemo: vi.fn(),
      onEditStart: vi.fn(), onViewImage: vi.fn(),
      onEditChange: vi.fn(), onEditSave: vi.fn(), onEditCancel: vi.fn(),
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
    const completion = screen.getByRole('button', { name: 'Mark complete' });
    expect(row).toHaveAttribute('aria-checked', 'true');
    expect(completion).toHaveAttribute('aria-disabled', 'true');

    fireEvent.pointerDown(completion, { pointerType: 'touch' });
    fireEvent.click(completion);
    fireEvent.keyDown(completion, { key: 'Enter' });
    fireEvent.keyDown(completion, { key: ' ' });
    fireEvent.click(completion); // Keyboard-triggered click must also be inert.
    expect(callbacks.onToggle).not.toHaveBeenCalled();
    expect(onToggleSelection).not.toHaveBeenCalled();

    fireEvent.keyDown(row, { key: ' ' });
    const title = screen.getByRole('button', { name: 'Write release notes' });
    fireEvent.keyDown(title, { key: 'Enter' });
    // Keyboard Enter on a task title now selects in Select mode.
    expect(onToggleSelection).toHaveBeenCalledTimes(2);
    fireEvent.click(title);
    fireEvent.click(screen.getByRole('button', { name: 'Open memo' }));
    expect(onToggleSelection).toHaveBeenCalledTimes(4);
    expect(callbacks.onOpenActions).not.toHaveBeenCalled();
    expect(callbacks.onOpenMemo).not.toHaveBeenCalled();
    expect(callbacks.onToggle).not.toHaveBeenCalled();
  });

  it('keeps completed tasks immutable in Select mode and restores completion outside it', () => {
    const callbacks = {
      onToggle: vi.fn(), onOpenActions: vi.fn(), onOpenMemo: vi.fn(),
      onEditStart: vi.fn(), onEditChange: vi.fn(),
      onEditSave: vi.fn(), onEditCancel: vi.fn(),
    };
    const onToggleSelection = vi.fn();
    const completedTask = { ...task, completed: true };
    const renderItem = (selectionMode: boolean) => (
      <TaskItem task={completedTask} categoryColor="#3B82F6" currentUserId="user_1"
        isEditing={false} editValue="" selectionMode={selectionMode}
        isSelected={false} onToggleSelection={onToggleSelection} {...callbacks} />
    );
    const { rerender } = render(renderItem(true));
    const completion = screen.getByRole('button', { name: 'Mark incomplete' });
    expect(completion).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(completion);
    fireEvent.keyDown(completion, { key: 'Enter' });
    fireEvent.click(completion);
    expect(callbacks.onToggle).not.toHaveBeenCalled();
    expect(onToggleSelection).not.toHaveBeenCalled();

    rerender(renderItem(false));
    expect(screen.getByRole('button', { name: 'Mark incomplete' })).not.toHaveAttribute('aria-disabled');
    fireEvent.click(screen.getByRole('button', { name: 'Mark incomplete' }));
    expect(callbacks.onToggle).toHaveBeenCalledExactlyOnceWith(task.id);
    expect(onToggleSelection).not.toHaveBeenCalled();
  });

});
