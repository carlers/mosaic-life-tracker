import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { TaskActionSheet } from '../../src/components/home/views/TaskActionSheet';
import type {
  TaskDocument,
  CategoryDocument,
} from '../../src/db/schema';

// TaskActionSheet keeps one focused callback-routing test here. Nested-sheet
// choreography, photo viewing, and task-context retention are covered by
// DayViewSheetRegression; visibility rules are covered by pure/unit tests.

// Build a `yyyy-MM-dd` string from a Date's *local* parts. Do NOT use
// `date.toISOString()` or `new Date('yyyy-MM-dd')` — those parse as UTC
// midnight and flip `isToday` across timezone boundaries, which would make
// the "Do It Tomorrow" test flaky depending on the runner's TZ.
function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TODAY_STR = isoDateLocal(new Date());
const TOMORROW_STR = isoDateLocal(new Date(Date.now() + 86_400_000));

function makeTask(overrides: Partial<TaskDocument> = {}): TaskDocument {
  return {
    id: 'task_1',
    title: 'Test task',
    completed: false,
    categoryId: 'cat_1',
    date: TODAY_STR,
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
    visibility: 'private',
    userId: 'user_A',
    isDeleted: false,
    ...overrides,
  };
}

function makeCallbacks() {
  return {
    onClose: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onMemo: vi.fn(),
    onChangeDate: vi.fn(),
    onVisibility: vi.fn(),
    onAddPhoto: vi.fn(),
    onViewPhoto: vi.fn(),
    onDeletePhoto: vi.fn(),
    onDoItTomorrowOrToday: vi.fn(),
  };
}

describe('TaskActionSheet', () => {
  beforeEach(() => {
    // Defensive reset for the openSheetCount counter's side effect on body
    // overflow, in case a prior test failed before its cleanup ran.
    document.body.style.overflow = '';
  });

  it('fires the top-grid and menu callbacks on tap', () => {
    const cbs = makeCallbacks();
    // Use tomorrow so the "Do It Today" label is stable.
    render(
      <TaskActionSheet
        isOpen
        task={makeTask({ date: TOMORROW_STR })}
        category={makeCategory()}
        {...cbs}
      />
    );

    fireEvent.click(screen.getByText('Edit'));
    expect(cbs.onEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Delete'));
    expect(cbs.onDelete).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Visibility'));
    expect(cbs.onVisibility).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Change Date'));
    expect(cbs.onChangeDate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Do It Today'));
    expect(cbs.onDoItTomorrowOrToday).toHaveBeenCalledTimes(1);
  });
});
