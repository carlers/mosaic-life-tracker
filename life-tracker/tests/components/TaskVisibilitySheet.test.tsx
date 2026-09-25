import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { TaskVisibilitySheet } from '../../src/components/home/views/TaskVisibilitySheet';
import type {
  TaskDocument,
  CategoryDocument,
} from '../../src/db/schema';

// TaskVisibilitySheet keeps only save semantics: an explicit override emits
// its value and Default emits the empty-string inheritance sentinel.

function makeTask(overrides: Partial<TaskDocument> = {}): TaskDocument {
  return {
    id: 'task_1',
    title: 'Test task',
    completed: false,
    categoryId: 'cat_1',
    date: '2026-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    userId: 'user_A',
    isDeleted: false,
    visibility: '',
    ...overrides,
  };
}

function makeCategory(
  overrides: Partial<CategoryDocument> = {}
): CategoryDocument {
  return {
    id: 'cat_1',
    name: 'Work',
    color: '#3B82F6',
    order: 0,
    visibility: 'public',
    userId: 'user_A',
    isDeleted: false,
    ...overrides,
  };
}

function makeCallbacks() {
  return {
    onClose: vi.fn(),
    onSave: vi.fn(),
  };
}

describe('TaskVisibilitySheet', () => {
  beforeEach(() => {
    // Defensive reset; BottomSheet's scroll-lock effect mutates body overflow.
    document.body.style.overflow = '';
  });

  it('tapping an override fires onSave with the concrete value and onClose', () => {
    const cbs = makeCallbacks();
    render(
      <TaskVisibilitySheet
        isOpen
        task={makeTask()}
        category={makeCategory()}
        {...cbs}
      />
    );
    const privateButton = screen.getByText('Private').closest('button');
    expect(privateButton).not.toBeNull();
    fireEvent.click(privateButton as Element);
    expect(cbs.onSave).toHaveBeenCalledTimes(1);
    expect(cbs.onSave).toHaveBeenCalledWith('private');
    expect(cbs.onClose).toHaveBeenCalledTimes(1);
  });

  it('tapping Default fires onSave with the empty string', () => {
    const cbs = makeCallbacks();
    render(
      <TaskVisibilitySheet
        isOpen
        task={makeTask()}
        category={makeCategory()}
        {...cbs}
      />
    );
    const defaultButton = screen.getByText(/^Default \(/).closest('button');
    expect(defaultButton).not.toBeNull();
    fireEvent.click(defaultButton as Element);
    expect(cbs.onSave).toHaveBeenCalledWith('');
    expect(cbs.onClose).toHaveBeenCalledTimes(1);
  });
});
