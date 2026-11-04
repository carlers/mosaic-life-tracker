import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { addDays, format } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskDocument, CategoryDocument } from '../../src/db/schema';

const paused = vi.hoisted(() => new Set<string>());
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: (flag: string) => !paused.has(flag),
}));
vi.mock('../../src/lib/featureControls', () => ({
  isFeatureEnabled: (flag: string) => !paused.has(flag),
}));
import { TaskActionSheet } from '../../src/components/home/views/TaskActionSheet';

const task = {
  id: 't_1', userId: 'owner', title: 'Review lecture', date: '2026-11-10',
  categoryId: 'cat_1', completed: false, order: 0,
  isDeleted: false, visibility: '', createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
} as TaskDocument;
const category = {
  id: 'cat_1', userId: 'owner', name: 'School', color: '#aaa', order: 0,
  isDeleted: false, visibility: 'private',
} as CategoryDocument;
const callbacks = {
  onClose: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onMemo: vi.fn(),
  onChangeDate: vi.fn(async () => undefined), onVisibility: vi.fn(),
  onShare: vi.fn(), onAddPhoto: vi.fn(), onViewPhoto: vi.fn(),
  onDeletePhoto: vi.fn(), onDoItTomorrowOrToday: vi.fn(),
  onMoveToBacklog: vi.fn(), onLinkToBucketList: vi.fn(),
};
const show = () => <TaskActionSheet isOpen task={task} category={category} {...callbacks} />;
beforeEach(() => { paused.clear(); Object.values(callbacks).forEach(mock => mock.mockClear()); });
describe('optional task action kill switches', () => {
  it('hides the three optional actions and date shortcuts but leaves full date editor', () => {
    const { rerender } = render(show());
    expect(screen.getByText('Link to Bucket List')).toBeInTheDocument();
    expect(screen.getByText('Move to Backlog')).toBeInTheDocument();
    expect(screen.getByText('Do It Yesterday')).toBeInTheDocument();
    expect(screen.getByText('Move to Previous Day')).toBeInTheDocument();
    expect(screen.getByText('Move to Next Day')).toBeInTheDocument();
    paused.add('mosaic_disable_task_bucket_link');
    paused.add('mosaic_disable_task_move_to_backlog');
    paused.add('mosaic_disable_task_quick_reschedule');
    rerender(show());
    expect(screen.queryByText('Link to Bucket List')).not.toBeInTheDocument();
    expect(screen.queryByText('Move to Backlog')).not.toBeInTheDocument();
    expect(screen.queryByText('Do It Yesterday')).not.toBeInTheDocument();
    expect(screen.queryByText('Do It Today')).not.toBeInTheDocument();
    expect(screen.queryByText('Move to Previous Day')).not.toBeInTheDocument();
    expect(screen.queryByText('Move to Next Day')).not.toBeInTheDocument();
    expect(screen.getByText('Change Date')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    paused.clear();
    rerender(show());
    expect(screen.getByText('Link to Bucket List')).toBeInTheDocument();
    expect(screen.getByText('Move to Backlog')).toBeInTheDocument();
    expect(screen.getByText('Do It Yesterday')).toBeInTheDocument();
  });
});

describe('relative day task actions', () => {
  it('hides both actions on today while preserving the existing yesterday/tomorrow shortcuts', () => {
    render(<TaskActionSheet isOpen task={{ ...task, date: format(new Date(), 'yyyy-MM-dd') }}
      category={category} {...callbacks} />);
    expect(screen.queryByRole('button', { name: 'Move to Previous Day' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move to Next Day' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Do It Yesterday' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Do It Tomorrow' })).toBeInTheDocument();
  });

  it('hides both relative shortcuts on undated backlog tasks', () => {
    render(<TaskActionSheet isOpen task={{ ...task, date: '' }} category={category} {...callbacks} />);
    expect(screen.queryByRole('button', { name: 'Move to Previous Day' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move to Next Day' })).toBeNull();
  });

  it.each([
    ['Move to Previous Day', '2026-11-09'],
    ['Move to Next Day', '2026-11-11'],
  ])('moves a scheduled task using %s', async (label, expected) => {
    render(show());
    fireEvent.click(screen.getByRole('button', { name: label }));
    await waitFor(() => expect(callbacks.onChangeDate).toHaveBeenCalledExactlyOnceWith(expected));
    await waitFor(() => expect(callbacks.onClose).toHaveBeenCalledOnce());
  });

  it('shows a failed date update without closing the sheet, allowing retry', async () => {
    callbacks.onChangeDate.mockRejectedValueOnce(new Error('offline'));
    render(show());
    fireEvent.click(screen.getByRole('button', { name: 'Move to Next Day' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not move task'));
    expect(callbacks.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Move to Next Day' }));
    await waitFor(() => expect(callbacks.onChangeDate).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(callbacks.onClose).toHaveBeenCalledOnce());
  });

  it('uses calendar dates rather than the current day for future and past tasks', () => {
    const futureDate = format(addDays(new Date(), 10), 'yyyy-MM-dd');
    render(<TaskActionSheet isOpen task={{ ...task, date: futureDate }}
      category={category} {...callbacks} />);
    expect(screen.getByRole('button', { name: 'Move to Previous Day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move to Next Day' })).toBeInTheDocument();
  });
});
