import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';
import type { NotificationItem } from '../../src/lib/notifications';

const mocks = vi.hoisted(() => ({
  fetchFriendAlertTask: vi.fn(),
  calendar: {
    tasks: [] as TaskDocument[],
    categories: [],
    lastFetchedAt: '',
    isLoading: true,
    error: null,
  },
  mounted: 0,
  unmounted: 0,
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'viewer' } }),
}));
vi.mock('../../src/lib/friendData', () => ({
  fetchFriendAlertTask: mocks.fetchFriendAlertTask,
  FriendAccessError: class FriendAccessError extends Error {
    kind: string;
    constructor(message: string, kind: string) {
      super(message);
      this.kind = kind;
    }
  },
}));
vi.mock('../../src/lib/useFriendCalendar', () => ({
  useFriendCalendar: () => ({
    ...mocks.calendar,
    reactToTask: vi.fn(),
  }),
}));
vi.mock('../../src/hooks/useTaskActivityActions', () => ({
  useTaskActivityActions: () => ({ sendTaskReaction: vi.fn() }),
}));
vi.mock('../../src/hooks/useFriendTaskReply', () => ({
  useFriendTaskReply: () => ({
    replyTask: null,
    replyColor: '',
    handleReplyToTask: vi.fn(),
    handleReplySent: vi.fn(),
    closeReply: vi.fn(),
  }),
}));
vi.mock('../../src/components/friend/FriendDayViewSheet', () => ({
  FriendDayViewSheet: ({ tasks, emptyMessage }: {
    tasks: TaskDocument[]; emptyMessage?: string;
  }) => {
    React.useEffect(() => {
      mocks.mounted++;
      return () => { mocks.unmounted++; };
    }, []);
    return (
      <div role="dialog" aria-label="Friend day view">
        <span>{emptyMessage ?? 'Ready'}</span>
        <span>{tasks.map((task) => task.title).join(', ')}</span>
      </div>
    );
  },
}));
vi.mock('../../src/components/messages/ReplyComposerSheet', () => ({
  ReplyComposerSheet: () => null,
}));

import { AlertFriendDaySheet } from '../../src/components/friend/AlertFriendDaySheet';

const task = {
  id: 'task_1', userId: 'friend_1', categoryId: 'cat_1',
  title: 'Completed task', date: '2026-10-08',
  completed: true, completedAt: '2026-10-08T08:00:00.000Z',
  visibility: 'followers',
} as TaskDocument;
const notification = {
  id: 'not_1', actorId: 'friend_1', actorName: 'Alice',
  task,
} as NotificationItem;

describe('Alerts friend-day fast open', () => {
  beforeEach(() => {
    mocks.fetchFriendAlertTask.mockReset();
    mocks.calendar.tasks = [];
    mocks.calendar.lastFetchedAt = '';
    mocks.calendar.isLoading = true;
    mocks.mounted = 0;
    mocks.unmounted = 0;
  });

  it('keeps one sheet mounted while the verified task arrives', async () => {
    let resolveTask: ((value: { task: TaskDocument; category: null }) => void) | undefined;
    mocks.fetchFriendAlertTask.mockImplementationOnce(() => new Promise((resolve) => {
      resolveTask = resolve;
    }));
    render(<AlertFriendDaySheet notification={notification} onClose={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading friend task');
    expect(mocks.mounted).toBe(1);
    await act(async () => {
      resolveTask?.({ task, category: null });
    });
    expect(screen.getByText('Completed task')).toBeInTheDocument();
    expect(mocks.mounted).toBe(1);
    expect(mocks.unmounted).toBe(0);
    expect(mocks.fetchFriendAlertTask).toHaveBeenCalledWith(
      'viewer', 'friend_1', 'task_1', '2026-10-08T08:00:00.000Z'
    );
  });

  it('never displays the cached task after the server denies access', async () => {
    mocks.calendar.tasks = [task];
    mocks.calendar.lastFetchedAt = '2026-10-08T09:00:00.000Z';
    mocks.calendar.isLoading = false;
    mocks.fetchFriendAlertTask.mockRejectedValueOnce(
      new Error('Task is private')
    );
    render(<AlertFriendDaySheet notification={notification} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('no longer available')
    );
    expect(screen.queryByText('Completed task')).not.toBeInTheDocument();
  });

  it('falls back to a confirmed cached calendar if the Function is older', async () => {
    mocks.calendar.tasks = [task];
    mocks.calendar.lastFetchedAt = '2026-10-08T09:00:00.000Z';
    mocks.calendar.isLoading = false;
    mocks.fetchFriendAlertTask.mockResolvedValueOnce(null);
    render(<AlertFriendDaySheet notification={notification} onClose={vi.fn()} />);
    expect(await screen.findByText('Completed task')).toBeInTheDocument();
  });
});
