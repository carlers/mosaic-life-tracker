// Regression: PROJECT_REFERENCE.md §18 / §23 — account-sensitive work must not
// reveal previous-owner data or let stale completions replace the current view.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';
import type { FriendCalendarBundle } from '../../src/lib/friendCache';

const mocks = vi.hoisted(() => ({
  userId: 'viewer_A' as string | undefined,
  fetch: vi.fn(),
  react: vi.fn(),
  patchCache: vi.fn(),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.userId ? { $id: mocks.userId } : null,
  }),
}));
vi.mock('../../src/lib/friendData', () => ({
  fetchFriendCalendar: mocks.fetch,
  FriendAccessError: class FriendAccessError extends Error {
    kind: 'forbidden' | 'offline' | 'server';
    constructor(message: string, kind: 'forbidden' | 'offline' | 'server') {
      super(message);
      this.kind = kind;
    }
  },
}));
vi.mock('../../src/lib/messageDelivery', () => ({
  reactToTaskOnRemote: mocks.react,
}));
vi.mock('../../src/lib/friendCache', () => ({
  patchCachedCalendarTask: mocks.patchCache,
}));

import { FriendAccessError } from '../../src/lib/friendData';
import { useFriendCalendar } from '../../src/lib/useFriendCalendar';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function calendar(title: string, reactions = ''): FriendCalendarBundle {
  return {
    friendUserId: 'shared_friend',
    tasks: [{ id: 'shared_task', title, reactions } as TaskDocument],
    categories: [],
    fetchedAt: '2026-10-09T00:00:00.000Z',
  };
}

describe('friend-calendar async owner safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userId = 'viewer_A';
  });

  it('hides old-owner content immediately and rejects a late imperative refresh', async () => {
    const lateA = deferred<FriendCalendarBundle>();
    mocks.fetch
      .mockResolvedValueOnce(calendar('A private view'))
      .mockImplementationOnce(() => lateA.promise)
      .mockResolvedValueOnce(calendar('B permitted view'));

    const { result, rerender } = renderHook(() => useFriendCalendar('shared_friend'));
    await waitFor(() => expect(result.current.tasks[0]?.title).toBe('A private view'));

    let oldRefresh!: Promise<void>;
    act(() => {
      oldRefresh = result.current.refetch(true);
    });

    mocks.userId = 'viewer_B';
    rerender();

    // The previous viewer's calendar must never be offered to the new account,
    // including the render before its replacement network request completes.
    expect(result.current.tasks).toEqual([]);
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.tasks[0]?.title).toBe('B permitted view'));

    await act(async () => {
      lateA.resolve(calendar('A stale refresh'));
      await oldRefresh;
    });
    expect(result.current.tasks[0]?.title).toBe('B permitted view');
  });

  it('does not let an old viewer reaction failure roll back the new viewer state', async () => {
    const failedReaction = deferred<string>();
    const bReactions = JSON.stringify([{ emoji: '👍', userIds: ['viewer_B'] }]);
    mocks.fetch
      .mockResolvedValueOnce(calendar('A view'))
      .mockResolvedValueOnce(calendar('B view', bReactions));
    mocks.react.mockImplementationOnce(() => failedReaction.promise);

    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { result, rerender } = renderHook(() => useFriendCalendar('shared_friend'));
      await waitFor(() => expect(result.current.tasks[0]?.title).toBe('A view'));
      let previousReaction!: Promise<'add' | 'remove'>;
      act(() => {
        previousReaction = result.current.reactToTask('shared_task', '👍');
      });

      mocks.userId = 'viewer_B';
      rerender();
      await waitFor(() => expect(result.current.tasks[0]?.title).toBe('B view'));

      await act(async () => {
        failedReaction.reject(new Error('remote failure'));
        await expect(previousReaction).rejects.toThrow('remote failure');
      });
      expect(result.current.tasks[0]?.reactions).toBe(bReactions);
      expect(mocks.patchCache).not.toHaveBeenCalled();
    } finally {
      errorLog.mockRestore();
    }
  });

  it('keeps the newest of two same-owner refresh results', async () => {
    const oldRequest = deferred<FriendCalendarBundle>();
    mocks.fetch
      .mockResolvedValueOnce(calendar('initial'))
      .mockImplementationOnce(() => oldRequest.promise)
      .mockResolvedValueOnce(calendar('latest'));

    const { result } = renderHook(() => useFriendCalendar('shared_friend'));
    await waitFor(() => expect(result.current.tasks[0]?.title).toBe('initial'));

    let stale!: Promise<void>;
    let latest!: Promise<void>;
    act(() => {
      stale = result.current.refetch(true);
      latest = result.current.refetch(true);
    });
    await act(async () => { await latest; });
    expect(result.current.tasks[0]?.title).toBe('latest');

    await act(async () => {
      oldRequest.resolve(calendar('stale'));
      await stale;
    });
    expect(result.current.tasks[0]?.title).toBe('latest');
  });

  it('clears old-owner data when the next viewer is denied access', async () => {
    mocks.fetch
      .mockResolvedValueOnce(calendar('A allowed view'))
      .mockRejectedValueOnce(new FriendAccessError('No access', 'forbidden'));

    const { result, rerender } = renderHook(() => useFriendCalendar('shared_friend'));
    await waitFor(() => expect(result.current.tasks[0]?.title).toBe('A allowed view'));

    mocks.userId = 'viewer_B';
    rerender();
    expect(result.current.tasks).toEqual([]);

    await waitFor(() => expect(result.current.errorKind).toBe('forbidden'));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.tasks).toEqual([]);
    expect(result.current.categories).toEqual([]);
  });

});
