import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
const YESTERDAY_STR = isoDateLocal(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1));

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
    onShare: vi.fn(),
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
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for sheet exit/focus restoration before entering task edit mode', async () => {
    const cbs = makeCallbacks();
    const props = {
      task: makeTask({ date: TOMORROW_STR }),
      category: makeCategory(),
      ...cbs,
    };
    const { rerender } = render(<TaskActionSheet isOpen {...props} />);

    fireEvent.click(screen.getByText('Edit'));

    expect(cbs.onClose).toHaveBeenCalledTimes(1);
    expect(cbs.onEdit).not.toHaveBeenCalled();

    // Parent closes the sheet: edit must not begin while its focus trap is active.
    rerender(<TaskActionSheet isOpen={false} {...props} />);
    await vi.waitFor(() => expect(cbs.onEdit).toHaveBeenCalledTimes(1));
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

    // Edit has its own sequencing test above; verify the remaining action
    // callbacks synchronously here.
    fireEvent.click(screen.getByText('Delete'));
    expect(cbs.onDelete).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Visibility'));
    expect(cbs.onVisibility).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Change Date'));
    // Calendar replaces actions synchronously in the same portaled sheet,
    // rather than closing one sheet and opening another after a timer.
    expect(screen.getByRole('group', { name: 'Calendar dates' })).toBeTruthy();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(cbs.onChangeDate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    fireEvent.click(screen.getByText('Do It Today'));
    expect(cbs.onDoItTomorrowOrToday).toHaveBeenCalledTimes(1);
  });

  it('schedules yesterday via existing date update and hides redundant local-day actions', async () => {
    const today = makeCallbacks();
    const { rerender } = render(<TaskActionSheet isOpen task={makeTask()}
      category={makeCategory()} {...today} />);
    expect(screen.queryByRole('button', { name: 'Do It Today' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Do It Tomorrow' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Do It Yesterday' }));
    await vi.waitFor(() => expect(today.onChangeDate).toHaveBeenCalledWith(YESTERDAY_STR));
    await vi.waitFor(() => expect(today.onClose).toHaveBeenCalled());

    const yesterday = makeCallbacks();
    rerender(<TaskActionSheet isOpen task={makeTask({ id: 'other', date: YESTERDAY_STR })}
      category={makeCategory()} {...yesterday} />);
    expect(screen.queryByRole('button', { name: 'Do It Yesterday' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Do It Today' })).toBeTruthy();
  });

  it('saves a calendar day through the existing owner task update callback', async () => {
    const cbs = makeCallbacks();
    render(<TaskActionSheet isOpen task={makeTask({ date: '2026-10-10' })}
      category={makeCategory()} {...cbs} />);
    fireEvent.click(screen.getByText('Change Date'));
    fireEvent.click(screen.getByRole('button', { name: 'October 20, 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Date' }));
    await vi.waitFor(() => expect(cbs.onChangeDate).toHaveBeenCalledWith('2026-10-20'));
    // The real BottomSheet may also request close through history cleanup
    // while this test keeps the parent isOpen flag fixed at true.
    await vi.waitFor(() => expect(cbs.onClose).toHaveBeenCalled());
  });

  it('preserves the existing Share and Link nested-action callback sequence', () => {
    const sequence: string[] = [];
    const cbs = makeCallbacks();
    cbs.onClose.mockImplementation(() => sequence.push('close'));
    cbs.onShare.mockImplementation(() => sequence.push('share'));
    const onLinkToBucketList = vi.fn(() => sequence.push('link'));
    render(
      <TaskActionSheet isOpen task={makeTask()} category={makeCategory()}
        {...cbs} onLinkToBucketList={onLinkToBucketList} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Share with friends' }));
    expect(sequence).toEqual(['share', 'close']);

    sequence.length = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Link to Bucket List' }));
    expect(sequence).toEqual(['close', 'link']);
  });

  it('copies the task title and closes the sheet', async () => {
    const cbs = makeCallbacks();
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    render(
      <TaskActionSheet
        isOpen
        task={makeTask({ title: 'Buy groceries' })}
        category={makeCategory()}
        {...cbs}
      />
    );

    fireEvent.click(screen.getByText('Copy Task Text'));

    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('Buy groceries');
      expect(cbs.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
