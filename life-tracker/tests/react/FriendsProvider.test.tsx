import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useContext, type ReactNode } from 'react';
import type { RxDatabase } from 'rxdb';
import { FriendsProvider } from '../../src/hooks/FriendsProvider';
import {
  FriendsContext,
  type UseFriendsReturn,
} from '../../src/hooks/friendsContext';
import {
  createTestDb,
  destroyTestDb,
  type TestDatabaseCollections,
} from '../helpers/testDb';
import type { FriendshipDocument } from '../../src/db/schema';
const actionSender = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/messageDelivery', () => ({ sendMessageAction: actionSender }));
import { flushFriendshipCommands } from '../../src/lib/friendshipCommands';
const dbRef = vi.hoisted(() => ({ current: null as unknown }));
const mockUserRef = vi.hoisted(() => ({
  current: { $id: 'user_A' } as { $id: string } | null,
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: () => {
    if (!dbRef.current) throw new Error('testDb not initialized');
    return dbRef.current;
  },
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUserRef.current, isLoading: false }),
}));
const wrapper = ({ children }: { children: ReactNode }) => (
  <FriendsProvider>{children}</FriendsProvider>
);
function useFriendsValue(): UseFriendsReturn {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error('useFriendsValue used outside provider');
  return ctx;
}
function makeFriendship(
  overrides: Partial<FriendshipDocument> = {}
): FriendshipDocument {
  return {
    id: `fr_${Math.random().toString(36).slice(2, 8)}`,
    userId: 'user_A',
    friendId: 'user_B',
    friendUsername: 'friend_b',
    friendDisplayName: 'Friend B',
    friendAvatarFileId: '',
    friendBio: '',
    status: 'accepted',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isDeleted: false,
    ...overrides,
  };
}
describe('FriendsProvider', () => {
  beforeEach(async () => {
    localStorage.clear();
    actionSender.mockReset();
    dbRef.current = await createTestDb('friendships');
    mockUserRef.current = { $id: 'user_A' };
  });
  afterEach(async () => {
    if (dbRef.current) {
      await destroyTestDb(
        dbRef.current as RxDatabase<TestDatabaseCollections>
      );
      dbRef.current = null;
    }
  });
  it('exposes empty state and isLoading false when there is no authenticated user', () => {
    mockUserRef.current = null;
    const { result } = renderHook(() => useFriendsValue(), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.friends).toEqual([]);
    expect(result.current.incomingRequests).toEqual([]);
    expect(result.current.outgoingRequests).toEqual([]);
    expect(result.current.blockedUsers).toEqual([]);
  });
  it('exposes empty arrays and transitions isLoading true → false when there are no friendships', async () => {
    const { result } = renderHook(() => useFriendsValue(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.friends).toEqual([]);
    expect(result.current.incomingRequests).toEqual([]);
    expect(result.current.outgoingRequests).toEqual([]);
    expect(result.current.blockedUsers).toEqual([]);
  });
  it('classifies accepted rows as friends only', async () => {
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.friendships.insert(
      makeFriendship({
        friendId: 'user_B',
        status: 'accepted',
      })
    );
    const { result } = renderHook(() => useFriendsValue(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.friends).toHaveLength(1);
    expect(result.current.friends[0].friendId).toBe('user_B');
    expect(result.current.incomingRequests).toEqual([]);
    expect(result.current.outgoingRequests).toEqual([]);
    expect(result.current.blockedUsers).toEqual([]);
  });
  it('classifies pending_incoming rows as incomingRequests only', async () => {
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.friendships.insert(
      makeFriendship({
        friendId: 'user_B',
        status: 'pending_incoming',
      })
    );
    const { result } = renderHook(() => useFriendsValue(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.friends).toEqual([]);
    expect(result.current.incomingRequests).toHaveLength(1);
    expect(result.current.incomingRequests[0].friendId).toBe('user_B');
    expect(result.current.outgoingRequests).toEqual([]);
    expect(result.current.blockedUsers).toEqual([]);
  });
  it('classifies pending_outgoing rows as outgoingRequests only', async () => {
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.friendships.insert(
      makeFriendship({
        friendId: 'user_B',
        status: 'pending_outgoing',
      })
    );
    const { result } = renderHook(() => useFriendsValue(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.friends).toEqual([]);
    expect(result.current.incomingRequests).toEqual([]);
    expect(result.current.outgoingRequests).toHaveLength(1);
    expect(result.current.blockedUsers).toEqual([]);
  });
  it('classifies blocked rows as blockedUsers only', async () => {
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.friendships.insert(
      makeFriendship({
        friendId: 'user_B',
        status: 'blocked',
      })
    );
    const { result } = renderHook(() => useFriendsValue(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.friends).toEqual([]);
    expect(result.current.incomingRequests).toEqual([]);
    expect(result.current.outgoingRequests).toEqual([]);
    expect(result.current.blockedUsers).toHaveLength(1);
  });
  it('excludes soft-deleted rows from every bucket', async () => {
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.friendships.bulkInsert([
      makeFriendship({
        friendId: 'user_B',
        status: 'accepted',
        isDeleted: false,
      }),
      makeFriendship({
        friendId: 'user_C',
        status: 'accepted',
        isDeleted: true,
      }),
    ]);
    const { result } = renderHook(() => useFriendsValue(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.friends).toHaveLength(1);
    expect(result.current.friends[0].friendId).toBe('user_B');
  });
  it('exposes mutators and findFriendship; findFriendship locates a row by friendId', async () => {
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.friendships.insert(
      makeFriendship({
        friendId: 'user_B',
        status: 'accepted',
      })
    );
    const { result } = renderHook(() => useFriendsValue(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.sendRequest).toBe('function');
    expect(typeof result.current.accept).toBe('function');
    expect(typeof result.current.decline).toBe('function');
    expect(typeof result.current.cancel).toBe('function');
    expect(typeof result.current.remove).toBe('function');
    expect(typeof result.current.block).toBe('function');
    expect(typeof result.current.findFriendship).toBe('function');
    const found = result.current.findFriendship('user_B');
    expect(found).toBeDefined();
    expect(found?.friendId).toBe('user_B');
    expect(result.current.findFriendship('user_Z')).toBeUndefined();
  });
  it('projects queued sends without persisting a relationship, then reflects the confirmed response', async () => {
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    actionSender.mockRejectedValue(new Error('Offline'));
    const { result } = renderHook(() => useFriendsValue(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      expect(await result.current.sendRequest({ username: 'alice', displayName: 'Alice' }, {
        $id: 'profile_user_B', user_id: 'user_B', username: 'bob', display_name: 'Bob',
        avatar_file_id: '', bio: '', is_searchable: true,
      })).toEqual({ status: 'queued' });
    });
    expect(result.current.outgoingRequests).toHaveLength(1);
    expect(await db.friendships.count().exec()).toBe(0);
    const id = result.current.outgoingRequests[0].id;
    actionSender.mockResolvedValue({ ok: true, row: { $id: id, user_id: 'user_A', friend_id: 'user_B',
      friend_username: 'bob', friend_display_name: 'Bob', friend_avatar_file_id: '', friend_bio: '',
      status: 'pending_outgoing', created_at: '2026-09-28T00:00:00.000Z', updated_at: '2026-09-28T00:00:00.000Z', deleted: false } });
    await act(() => flushFriendshipCommands('user_A'));
    await waitFor(() => expect(result.current.outgoingRequests).toHaveLength(1));
    expect(await db.friendships.count().exec()).toBe(1);
    expect(result.current.friends).toHaveLength(0);
  });

  it('resets rows on user switch', async () => {
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.friendships.insert(
      makeFriendship({
        friendId: 'user_B',
        status: 'accepted',
      })
    );
    const { result, rerender } = renderHook(() => useFriendsValue(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.friends).toHaveLength(1);
    mockUserRef.current = { $id: 'user_Z' };
    rerender();
    await waitFor(() => expect(result.current.friends).toEqual([]));
  });
});
