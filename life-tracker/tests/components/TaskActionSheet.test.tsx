import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { TaskActionSheet } from '../../src/components/home/views/TaskActionSheet';
import type {
  TaskDocument,
  CategoryDocument,
} from '../../src/db/schema';

// ---------------------------------------------------------------------------
// TaskActionSheet component tests (Layer 5).
//
// These pin the observable contracts documented in AGENTS.md §7 (bottom
// sheet standardization, layout-shift reservation) and the visibility
// composition rules in §2 / §22:
//   - null task renders nothing (early return in the component).
//   - Photo affordances branch on task.image presence.
//   - Memo affordances branch on task.memo presence.
//   - Visibility label reflects inheritance vs explicit override, wiring
//     resolveVisibility + isInheriting + labelForVisibility at the
//     component level. The pure helpers are unit-tested separately in
//     tests/unit/visibility.test.ts; this file pins their composition.
//   - "Do It Tomorrow" vs "Do It Today" flips on isToday(task.date).
//   - Top-grid and menu callbacks fire on tap.
//
// Deliberately NOT tested here:
//   - Framer Motion whileTap animations, class strings, or icon rendering.
//     Internals-coupled and §24.3-non-compliant.
//   - BottomSheet portal behavior. That contract is pinned in
//     tests/components/BottomSheet.test.tsx; asserting it again would
//     double up.
// ---------------------------------------------------------------------------

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

  it('renders nothing when task is null', () => {
    render(
      <TaskActionSheet
        isOpen
        task={null}
        category={null}
        {...makeCallbacks()}
      />
    );
    // If the early return in the component ever regresses, 'Edit' would
    // appear (it is rendered unconditionally once task is truthy).
    expect(screen.queryByText('Edit')).toBeNull();
  });

  it('shows "Add Photo" when there is no image; "View Photo" + "Delete Photo" when there is', () => {
    const { rerender } = render(
      <TaskActionSheet
        isOpen
        task={makeTask({ image: '' })}
        category={makeCategory()}
        {...makeCallbacks()}
      />
    );
    expect(screen.queryByText('Add Photo')).not.toBeNull();
    expect(screen.queryByText('View Photo')).toBeNull();
    expect(screen.queryByText('Delete Photo')).toBeNull();

    rerender(
      <TaskActionSheet
        isOpen
        task={makeTask({ image: 'img_abc' })}
        category={makeCategory()}
        {...makeCallbacks()}
      />
    );
    expect(screen.queryByText('Add Photo')).toBeNull();
    expect(screen.queryByText('View Photo')).not.toBeNull();
    expect(screen.queryByText('Delete Photo')).not.toBeNull();
  });

  it('shows the "Memo" button when there is no memo; renders the memo text when there is', () => {
    const { rerender } = render(
      <TaskActionSheet
        isOpen
        task={makeTask({ memo: '' })}
        category={makeCategory()}
        {...makeCallbacks()}
      />
    );
    // No memo → the "Memo" action button renders.
    expect(screen.queryByText('Memo')).not.toBeNull();

    rerender(
      <TaskActionSheet
        isOpen
        task={makeTask({ memo: 'A note to self' })}
        category={makeCategory()}
        {...makeCallbacks()}
      />
    );
    // Memo present → its text renders, and the plain button is gone.
    expect(screen.queryByText('A note to self')).not.toBeNull();
  });

  it('visibility label reflects inheritance vs explicit override', () => {
    // Inheriting: task.visibility === '', category.visibility === 'public'.
    const { rerender } = render(
      <TaskActionSheet
        isOpen
        task={makeTask({ visibility: '' })}
        category={makeCategory({ visibility: 'public' })}
        {...makeCallbacks()}
      />
    );
    expect(screen.queryByText('Public · Default')).not.toBeNull();

    // Override: task.visibility === 'private' wins over the category.
    rerender(
      <TaskActionSheet
        isOpen
        task={makeTask({ visibility: 'private' })}
        category={makeCategory({ visibility: 'public' })}
        {...makeCallbacks()}
      />
    );
    expect(screen.queryByText('Private')).not.toBeNull();
    // The "· Default" suffix must NOT appear when overriding.
    expect(screen.queryByText(/·\s*Default/)).toBeNull();
  });

  it('"Do It Tomorrow" vs "Do It Today" label depends on the task date', () => {
    const { rerender } = render(
      <TaskActionSheet
        isOpen
        task={makeTask({ date: TODAY_STR })}
        category={makeCategory()}
        {...makeCallbacks()}
      />
    );
    expect(screen.queryByText('Do It Tomorrow')).not.toBeNull();

    rerender(
      <TaskActionSheet
        isOpen
        task={makeTask({ date: TOMORROW_STR })}
        category={makeCategory()}
        {...makeCallbacks()}
      />
    );
    expect(screen.queryByText('Do It Today')).not.toBeNull();
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
