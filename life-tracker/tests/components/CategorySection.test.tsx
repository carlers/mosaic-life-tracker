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
//   - Enter with non-whitespace content fires onAddTask(trimmed) and closes.
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
    expect(cbs.onAddTask).toHaveBeenCalledWith('Buy milk');
    expect(
      screen.queryByPlaceholderText('Add a task to Work...')
    ).toBeNull();
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

    expect(cbs.onAddTask).toHaveBeenCalledWith('First task');
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

});
