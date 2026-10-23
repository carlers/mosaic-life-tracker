import type React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { CategorySection } from '../../src/components/home/views/CategorySection';

// ---------------------------------------------------------------------------
// CategorySection component tests (Layer 5).
//
// Pins the inline-add flow:
//   - Chip tap opens the inline input with the placeholder
//     "Add a task to <Category>...".
//   - Enter with non-whitespace content fires onAddTask(trimmed, false) and closes.
//   - Escape clears and closes without firing onAddTask.
//   - Blur with empty content closes; blur with content stays open.
// Deliberately NOT tested here:
//   - TaskItem's internal rendering. Pinned separately where relevant.
//   - Class strings on the chip or the inline-add row.
// ---------------------------------------------------------------------------

function makeCallbacks() {
  return {
    onToggleTask: vi.fn(),
    onAddTask: vi.fn(),
    onOpenActions: vi.fn(),
    onOpenMemo: vi.fn(),
    onEditTask: vi.fn(),
    onEditChange: vi.fn(),
    onEditSave: vi.fn(),
    onEditCancel: vi.fn(),
  };
}

interface RenderOpts {
  categoryName?: string;
  tasks?: React.ComponentProps<typeof CategorySection>['tasks'];
  continueAddingAfterSubmit?: boolean;
  showCollapseButton?: boolean;
}

function renderSection(opts: RenderOpts = {}) {
  const cbs = makeCallbacks();
  const utils = render(
    <CategorySection
      categoryName={opts.categoryName ?? 'Work'}
      categoryColor="#3B82F6"
      visibility="private"
      currentUserId="user_A"
      tasks={opts.tasks ?? []}
      editingTaskId={null}
      editValue=""
      continueAddingAfterSubmit={opts.continueAddingAfterSubmit}
      showCollapseButton={opts.showCollapseButton}
      {...cbs}
    />
  );
  return { ...utils, cbs };
}

describe('CategorySection', () => {
  // Regression: AGENTS.md UI rules — interactive elements use semantic controls.
  it('uses a named button for the add-task category pill', () => {
    renderSection({ categoryName: 'Work' });
    expect(
      screen.getByRole('button', { name: 'Add a task to Work' })
    ).toBeInTheDocument();
  });

  it('outside Select mode the whole category pill still opens Add Task', () => {
    const onToggleCategorySelection = vi.fn();
    const task = {
      id: 'task_today', title: 'Task', completed: false, categoryId: 'work',
      date: '2026-10-15', createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z', userId: 'user_A',
      isDeleted: false, visibility: 'private' as const,
    };
    render(<CategorySection categoryId="work" categoryName="Work"
      categoryColor="#3B82F6" currentUserId="user_A" tasks={[task]}
      editingTaskId={null} editValue="" selectionMode={false}
      onToggleCategorySelection={onToggleCategorySelection} {...makeCallbacks()} />);
    expect(screen.queryByRole('button', { name: 'Select all tasks in Work' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add a task to Work' }));
    expect(screen.getByPlaceholderText('Add a task to Work...')).toBeInTheDocument();
    expect(onToggleCategorySelection).not.toHaveBeenCalled();
  });

  it('category pill selects and deselects all displayed tasks in selection mode', () => {
    const task = {
      id: 'task_today', title: 'Today task', completed: false,
      categoryId: 'work', date: '2026-10-15',
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z',
      userId: 'user_A', isDeleted: false, visibility: 'private' as const,
    };
    const onToggleCategorySelection = vi.fn();
    const props = {
      categoryId: 'work', categoryName: 'Work', categoryColor: '#3B82F6',
      currentUserId: 'user_A', tasks: [task], editingTaskId: null,
      editValue: '', selectionMode: true, onToggleCategorySelection,
      ...makeCallbacks(),
    };
    const { rerender } = render(<CategorySection {...props} selectedTaskIds={new Set()} />);
    const select = screen.getByRole('button', { name: 'Select all tasks in Work' });
    expect(select).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(select);
    expect(onToggleCategorySelection).toHaveBeenCalledExactlyOnceWith('work');
    expect(props.onAddTask).not.toHaveBeenCalled();
    rerender(<CategorySection {...props} selectedTaskIds={new Set(['task_today'])} />);
    const deselect = screen.getByRole('button', { name: 'Deselect all tasks in Work' });
    expect(deselect).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(deselect);
    expect(onToggleCategorySelection).toHaveBeenCalledTimes(2);
    expect(onToggleCategorySelection).toHaveBeenLastCalledWith('work');
  });

  it('chip tap opens the inline input with the category-scoped placeholder', () => {
    renderSection({ categoryName: 'Work' });
    expect(
      screen.queryByPlaceholderText('Add a task to Work...')
    ).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Add a task to Work' })
    );
    expect(
      screen.getByPlaceholderText('Add a task to Work...')
    ).toBeInTheDocument();
  });

  it('Enter with non-whitespace content fires onAddTask(trimmed) and closes the input', () => {
    const { cbs } = renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Add a task to Work' }));
    const input = screen.getByPlaceholderText(
      'Add a task to Work...'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  Buy milk  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(cbs.onAddTask).toHaveBeenCalledTimes(1);
    expect(cbs.onAddTask).toHaveBeenCalledWith('Buy milk', false);
    expect(
      screen.queryByPlaceholderText('Add a task to Work...')
    ).toBeNull();
  });

  it('creates a completed task from the focused add input without discarding its text', () => {
    const { cbs } = renderSection({ continueAddingAfterSubmit: true });
    fireEvent.click(screen.getByRole('button', { name: 'Add a task to Work' }));
    const input = screen.getByRole('textbox', { name: 'New task title' });
    fireEvent.change(input, { target: { value: '  Ready now  ' } });
    input.focus();
    const checkbox = screen.getByRole('button', { name: 'Create completed task' });
    expect(fireEvent.pointerDown(checkbox, { pointerType: 'touch' })).toBe(false);
    expect(input).toHaveFocus();
    fireEvent.click(checkbox);
    expect(cbs.onAddTask).toHaveBeenCalledExactlyOnceWith('Ready now', true);
    expect(input).toHaveFocus();
    expect(input).toHaveValue('');
  });

  it('does not create an empty task from the checkbox', () => {
    const { cbs } = renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Add a task to Work' }));
    expect(screen.getByRole('button', { name: 'Create completed task' })).toBeDisabled();
    expect(cbs.onAddTask).not.toHaveBeenCalled();
  });

  // Regression: §2 (completion controls remain usable while another task input is focused).
  it('toggles an existing task without closing an empty focused add-task row', () => {
    const existing = {
      id: 'other_task', title: 'Review checklist', completed: false, order: 0,
      categoryId: 'work', date: '2026-10-11',
      createdAt: '2026-10-11T00:00:00.000Z',
      updatedAt: '2026-10-11T00:00:00.000Z',
      userId: 'user_A', isDeleted: false, visibility: 'private' as const,
    };
    const { cbs } = renderSection({ tasks: [existing] });
    fireEvent.click(screen.getByRole('button', { name: 'Add a task to Work' }));
    const input = screen.getByRole('textbox', { name: 'New task title' });
    expect(input).toHaveFocus();

    const checkbox = screen.getByRole('button', { name: 'Mark complete' });
    // Prevent focus-transfer blur: it would close the blank add row and remount
    // task controls before the browser delivers the checkbox click.
    expect(fireEvent.pointerDown(checkbox, { pointerType: 'mouse' })).toBe(false);
    fireEvent.click(checkbox);
    expect(cbs.onToggleTask).toHaveBeenCalledExactlyOnceWith('other_task', false);
    expect(input).toHaveFocus();
    expect(input).toBeInTheDocument();
  });

  // Regression: §2 (continuous entry preserves same-category input focus).
  it('keeps the same-category input open and focused after Enter when enabled', () => {
    const { cbs } = renderSection({ continueAddingAfterSubmit: true });
    fireEvent.click(screen.getByRole('button', { name: 'Add a task to Work' }));
    const input = screen.getByPlaceholderText(
      'Add a task to Work...'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'First task' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(cbs.onAddTask).toHaveBeenCalledWith('First task', false);
    const nextInput = screen.getByPlaceholderText(
      'Add a task to Work...'
    ) as HTMLInputElement;
    expect(nextInput).toHaveValue('');
    expect(nextInput).toHaveFocus();
  });

  // Regression: §2 (category collapse remains opt-in).
  it('shows an accessible collapse control only when enabled and hides category contents', () => {
    const task = {
      id: 'task_existing',
      title: 'Existing task',
      completed: false,
      categoryId: 'work',
      date: '2026-09-23',
      createdAt: '2026-09-23T00:00:00.000Z',
      updatedAt: '2026-09-23T00:00:00.000Z',
      userId: 'user_A',
      isDeleted: false,
      visibility: 'private',
    };

    const { rerender, cbs } = renderSection({ tasks: [task] });
    expect(screen.queryByRole('button', { name: 'Collapse Work' })).toBeNull();

    rerender(
      <CategorySection
        categoryName="Work"
        categoryColor="#3B82F6"
        visibility="private"
        currentUserId="user_A"
        tasks={[task]}
        editingTaskId={null}
        editValue=""
        showCollapseButton
        {...cbs}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Work' }));
    expect(screen.queryByText('Existing task')).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand Work' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expand Work' }));
    expect(screen.getByText('Existing task')).toBeInTheDocument();
  });

  it('Escape closes the input without firing onAddTask', () => {
    const { cbs } = renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Add a task to Work' }));
    const input = screen.getByPlaceholderText(
      'Add a task to Work...'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'draft' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(cbs.onAddTask).not.toHaveBeenCalled();
    expect(
      screen.queryByPlaceholderText('Add a task to Work...')
    ).toBeNull();
  });

  it('blur closes the input when empty; keeps it open when content remains', () => {
    renderSection();
    // First: empty blur closes.
    fireEvent.click(screen.getByRole('button', { name: 'Add a task to Work' }));
    const input = screen.getByPlaceholderText(
      'Add a task to Work...'
    ) as HTMLInputElement;
    fireEvent.blur(input);
    expect(
      screen.queryByPlaceholderText('Add a task to Work...')
    ).toBeNull();

    // Reopen, type, blur — should stay open.
    fireEvent.click(screen.getByRole('button', { name: 'Add a task to Work' }));
    const input2 = screen.getByPlaceholderText(
      'Add a task to Work...'
    ) as HTMLInputElement;
    fireEvent.change(input2, { target: { value: 'kept' } });
    fireEvent.blur(input2);
    expect(
      screen.getByPlaceholderText('Add a task to Work...')
    ).toBeInTheDocument();
  });


  it('supports keyboard edit, completion and actions without opening actions twice', () => {
    const task = {
      id: 'keyboard_task', title: 'Write proposal', completed: false,
      categoryId: 'work', date: '2026-10-20',
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
      userId: 'user_A', isDeleted: false, visibility: 'private' as const,
    };
    const { cbs } = renderSection({ tasks: [task] });
    const title = screen.getByRole('button', { name: 'Write proposal' });

    expect(fireEvent.keyDown(title, { key: 'Enter' })).toBe(false);
    expect(cbs.onEditTask).toHaveBeenCalledExactlyOnceWith(task);
    expect(cbs.onOpenActions).not.toHaveBeenCalled();

    expect(fireEvent.keyDown(title, { key: ' ', code: 'Space' })).toBe(false);
    expect(cbs.onToggleTask).toHaveBeenCalledExactlyOnceWith('keyboard_task', false);
    expect(cbs.onOpenActions).not.toHaveBeenCalled();

    expect(fireEvent.keyDown(title, { key: 'Enter', shiftKey: true })).toBe(false);
    expect(cbs.onOpenActions).toHaveBeenCalledExactlyOnceWith(task);
  });

  it('keeps task completion unchanged when Space or Enter selects in selection mode', () => {
    const task = {
      id: 'select_keyboard', title: 'Select this', completed: false,
      categoryId: 'work', date: '2026-10-20',
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
      userId: 'user_A', isDeleted: false, visibility: 'private' as const,
    };
    const cbs = makeCallbacks();
    const onToggleTaskSelection = vi.fn();
    render(<CategorySection
      categoryId="work" categoryName="Work" categoryColor="#3B82F6"
      currentUserId="user_A" tasks={[task]}
      editingTaskId={null} editValue="" selectionMode
      onToggleTaskSelection={onToggleTaskSelection} {...cbs}
    />);
    const title = screen.getByRole('button', { name: 'Select this' });
    fireEvent.keyDown(title, { key: ' ' });
    fireEvent.keyDown(title, { key: 'Enter' });
    expect(onToggleTaskSelection).toHaveBeenCalledTimes(2);
    expect(onToggleTaskSelection).toHaveBeenNthCalledWith(1, 'select_keyboard');
    expect(cbs.onToggleTask).not.toHaveBeenCalled();
    expect(cbs.onEditTask).not.toHaveBeenCalled();
  });

});
