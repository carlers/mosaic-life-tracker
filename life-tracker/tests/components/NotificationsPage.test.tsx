import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '../../src/lib/notifications';

const mocks = vi.hoisted(() => ({
  userId: 'user_b',
  connectivityStatus: 'online',
  fetchNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  getCachedNotifications: vi.fn(),
  setCachedNotifications: vi.fn().mockResolvedValue(undefined),
  patchCachedNotificationTask: vi.fn().mockResolvedValue(undefined),
  reactToTaskOnRemote: vi.fn(),
  sendTaskReaction: vi.fn(),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.userId ? { $id: mocks.userId } : null,
  }),
}));

vi.mock('../../src/hooks/useConnectivity', () => ({
  useConnectivity: () => ({
    status: mocks.connectivityStatus,
    reason: null,
    lastConfirmedAt: null,
  }),
}));

vi.mock('../../src/hooks/useTaskActivityActions', () => ({
  useTaskActivityActions: () => ({
    sendTaskReaction: mocks.sendTaskReaction,
  }),
}));

vi.mock('../../src/lib/notifications', () => ({
  fetchNotifications: mocks.fetchNotifications,
  markNotificationsRead: mocks.markNotificationsRead,
}));

vi.mock('../../src/lib/notificationCache', () => ({
  getCachedNotifications: mocks.getCachedNotifications,
  setCachedNotifications: mocks.setCachedNotifications,
  patchCachedNotificationTask: mocks.patchCachedNotificationTask,
}));

vi.mock('../../src/lib/messageDelivery', () => ({
  reactToTaskOnRemote: mocks.reactToTaskOnRemote,
}));

vi.mock('../../src/components/ui/DeferredAvatar', () => ({
  DeferredAvatar: ({ alt }: { alt?: string }) => (
    <span aria-label={alt || 'avatar'} />
  ),
}));

vi.mock('../../src/components/messages/EmojiPickerSheet', () => ({
  EmojiPickerSheet: () => null,
}));

vi.mock('../../src/components/messages/ReactionRow', () => ({
  ReactionRow: () => null,
}));

vi.mock('../../src/components/messages/ReplyComposerSheet', () => ({
  ReplyComposerSheet: ({
    isOpen,
    friendId,
  }: {
    isOpen: boolean;
    friendId: string | null;
  }) => (
    <div
      data-testid="reply-sheet"
      data-open={String(isOpen)}
      data-friend={friendId ?? ''}
    />
  ),
}));

vi.mock('../../src/components/ui/Spinner', () => ({
  Spinner: () => <span>Loading</span>,
}));

import { NotificationsPage } from '../../src/pages/NotificationsPage';

function notification(
  overrides: Partial<NotificationItem> = {}
): NotificationItem {
  return {
    id: 'not_1',
    type: 'task_completed',
    actorId: 'user_a',
    actorName: 'Alice',
    actorUsername: 'alice',
    actorAvatarFileId: '',
    occurredAt: '2026-10-07T10:00:00.000Z',
    readAt: '',
    categoryColor: '#10B981',
    task: {
      id: 'task_1',
      title: 'Ship alerts',
      completed: true,
      categoryId: 'cat_1',
      order: 0,
      tags: '',
      date: '2026-10-07',
      memo: '',
      image: '',
      createdAt: '2026-10-07T09:00:00.000Z',
      completedAt: '2026-10-07T10:00:00.000Z',
      updatedAt: '2026-10-07T10:00:00.000Z',
      source: '',
      userId: 'user_a',
      isDeleted: false,
      routineId: '',
      reminderTime: '',
      reactions: '',
      visibility: 'followers',
    },
    ...overrides,
  };
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    mocks.userId = 'user_b';
    mocks.connectivityStatus = 'online';
    mocks.fetchNotifications.mockReset();
    mocks.markNotificationsRead.mockReset();
    mocks.getCachedNotifications.mockReset();
    mocks.setCachedNotifications.mockClear();
    mocks.patchCachedNotificationTask.mockClear();
    mocks.reactToTaskOnRemote.mockReset();
    mocks.sendTaskReaction.mockReset();
  });

  it('keeps swipe-route previews cache-only and does not mark activity read', async () => {
    mocks.getCachedNotifications.mockResolvedValue({
      items: [notification()],
      nextCursor: '',
      fetchedAt: '2026-10-07T10:00:01.000Z',
    });

    render(<NotificationsPage preview />);

    expect(await screen.findByText('Ship alerts')).toBeInTheDocument();
    expect(mocks.fetchNotifications).not.toHaveBeenCalled();
    expect(mocks.markNotificationsRead).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Refresh alerts' })
    ).toBeDisabled();
  });

  it('hides the previous account feed immediately during an account switch', async () => {
    mocks.connectivityStatus = 'offline';
    mocks.getCachedNotifications.mockResolvedValueOnce({
      items: [notification()],
      nextCursor: '',
      fetchedAt: '2026-10-07T10:00:01.000Z',
    });

    const { rerender } = render(<NotificationsPage />);
    expect(await screen.findByText('Ship alerts')).toBeInTheDocument();

    let resolveNext:
      | ((value: {
          items: NotificationItem[];
          nextCursor: string;
          fetchedAt: string;
        }) => void)
      | undefined;
    mocks.getCachedNotifications.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveNext = resolve;
        })
    );

    mocks.userId = 'user_c';
    rerender(<NotificationsPage />);

    expect(screen.queryByText('Ship alerts')).not.toBeInTheDocument();
    expect(screen.getByText('Loading')).toBeInTheDocument();

    resolveNext?.({
      items: [],
      nextCursor: '',
      fetchedAt: '2026-10-07T11:00:00.000Z',
    });
    await waitFor(() =>
      expect(screen.getByText('No activity yet')).toBeInTheDocument()
    );
  });

  it('does not reopen a stale reply target after an account switch', async () => {
    mocks.connectivityStatus = 'online';
    mocks.fetchNotifications.mockResolvedValue({
      items: [notification()],
      nextCursor: '',
      fetchedAt: '2026-10-07T10:00:02.000Z',
    });
    mocks.markNotificationsRead.mockResolvedValue(undefined);
    mocks.getCachedNotifications
      .mockResolvedValueOnce({
        items: [notification()],
        nextCursor: '',
        fetchedAt: '2026-10-07T10:00:01.000Z',
      })
      .mockResolvedValueOnce({
        items: [],
        nextCursor: '',
        fetchedAt: '2026-10-07T11:00:00.000Z',
      });

    const { rerender } = render(<NotificationsPage />);
    expect(await screen.findByText('Ship alerts')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Reply to Ship alerts' })
    );
    await waitFor(() =>
      expect(screen.getByTestId('reply-sheet')).toHaveAttribute(
        'data-open',
        'true'
      )
    );

    mocks.connectivityStatus = 'offline';
    mocks.userId = 'user_c';
    rerender(<NotificationsPage />);

    await waitFor(() =>
      expect(screen.getByText('No activity yet')).toBeInTheDocument()
    );
    expect(screen.getByTestId('reply-sheet')).toHaveAttribute(
      'data-open',
      'false'
    );
    expect(screen.getByTestId('reply-sheet')).toHaveAttribute(
      'data-friend',
      ''
    );
  });

  it('refreshes the active Alerts feed when the app regains focus', async () => {
    mocks.getCachedNotifications.mockResolvedValue({
      items: [],
      nextCursor: '',
      fetchedAt: '',
    });
    mocks.fetchNotifications.mockResolvedValue({
      items: [],
      nextCursor: '',
      fetchedAt: '2026-10-08T08:00:00.000Z',
    });
    mocks.markNotificationsRead.mockResolvedValue(undefined);

    render(<NotificationsPage />);
    await waitFor(() => expect(mocks.fetchNotifications).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new Event('focus'));

    await waitFor(() => expect(mocks.fetchNotifications).toHaveBeenCalledTimes(2));
  });

  it('persists read state for newly loaded pagination rows', async () => {
    const first = notification({
      readAt: '2026-10-08T08:00:00.000Z',
    });
    const second = notification({
      id: 'not_2',
      occurredAt: '2026-10-07T09:00:00.000Z',
    });
    mocks.getCachedNotifications.mockResolvedValue({
      items: [],
      nextCursor: '',
      fetchedAt: '',
    });
    mocks.fetchNotifications
      .mockResolvedValueOnce({
        items: [first],
        nextCursor: 'not_1',
        fetchedAt: '2026-10-08T08:00:01.000Z',
      })
      .mockResolvedValueOnce({
        items: [second],
        nextCursor: '',
        fetchedAt: '2026-10-08T08:00:02.000Z',
      });
    mocks.markNotificationsRead.mockResolvedValue(undefined);

    render(<NotificationsPage />);
    expect(await screen.findByText('Ship alerts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() =>
      expect(mocks.markNotificationsRead).toHaveBeenCalledWith(['not_2'])
    );
    await waitFor(() => {
      const lastFeed =
        mocks.setCachedNotifications.mock.calls.at(-1)?.[1];
      const loaded = lastFeed?.items?.find(
        (item: NotificationItem) => item.id === 'not_2'
      );
      expect(loaded?.readAt).not.toBe('');
    });
  });

  it('refreshes the active feed online and marks new rows read', async () => {
    const item = notification();
    mocks.getCachedNotifications.mockResolvedValue({
      items: [],
      nextCursor: '',
      fetchedAt: '',
    });
    mocks.fetchNotifications.mockResolvedValue({
      items: [item],
      nextCursor: '',
      fetchedAt: '2026-10-07T10:00:02.000Z',
    });
    mocks.markNotificationsRead.mockResolvedValue(undefined);

    render(<NotificationsPage />);

    expect(await screen.findByText('Ship alerts')).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.markNotificationsRead).toHaveBeenCalledWith(['not_1'])
    );
  });
});
