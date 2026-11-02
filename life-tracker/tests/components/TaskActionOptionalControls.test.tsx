import { render, screen } from '@testing-library/react';
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
    paused.add('mosaic_disable_task_bucket_link');
    paused.add('mosaic_disable_task_move_to_backlog');
    paused.add('mosaic_disable_task_quick_reschedule');
    rerender(show());
    expect(screen.queryByText('Link to Bucket List')).not.toBeInTheDocument();
    expect(screen.queryByText('Move to Backlog')).not.toBeInTheDocument();
    expect(screen.queryByText('Do It Yesterday')).not.toBeInTheDocument();
    expect(screen.queryByText('Do It Today')).not.toBeInTheDocument();
    expect(screen.getByText('Change Date')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    paused.clear();
    rerender(show());
    expect(screen.getByText('Link to Bucket List')).toBeInTheDocument();
    expect(screen.getByText('Move to Backlog')).toBeInTheDocument();
    expect(screen.getByText('Do It Yesterday')).toBeInTheDocument();
  });
});
