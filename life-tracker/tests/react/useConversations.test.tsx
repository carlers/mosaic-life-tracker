import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { RxDatabase } from 'rxdb';
import { useConversations } from '../../src/hooks/useConversations';
import {
  createTestDb,
  destroyTestDb,
  type TestDatabaseCollections,
} from '../helpers/testDb';
import type {
  MessageDocument,
  FriendshipDocument,
} from '../../src/db/schema';

// ---------------------------------------------------------------------------
// Module mocks
//
// Vitest hoists `vi.mock` above all imports, and the factory cannot reference
// outer bindings unless they were declared via `vi.hoisted`. We use the
// mutable-ref pattern: the hoisted holder exists at mock-evaluation time, and
// the factory reads `.current` lazily on every call.
//
// Per plan Finding A, `tests/helpers/mockDatabase.ts` is intentionally NOT
// used. The 6-line boilerplate is duplicated per hook test file, which is
// more readable than a helper whose operation depends on the call site.
// ---------------------------------------------------------------------------

const dbRef = vi.hoisted(() => ({ current: null as unknown }));
const mockFriendsRef = vi.hoisted(() => ({ current: [] as unknown[] }));

vi.mock('../../src/db/database', () => ({
  getDatabase: () => {
    if (!dbRef.current) throw new Error('testDb not initialized');
    return dbRef.current;
  },
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_A' }, isLoading: false }),
}));

vi.mock('../../src/hooks/useFriends', () => ({
  useFriends: () => ({
    friends: mockFriendsRef.current,
    isLoading: false,
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFriend(
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

function makeMessage(overrides: Partial<MessageDocument> = {}): MessageDocument {
  const id = overrides.id ?? `msg_${Math.random().toString(36).slice(2, 12)}`;
  return {
    id,
    userId: 'user_A',
    threadId: 'th_test',
    senderId: 'user_A',
    recipientId: 'user_B',
    direction: 'outgoing',
    content: 'hello',
    taskRefId: '',
    taskRefTitle: '',
    taskRefDate: '',
    taskRefColor: '',
    replyToId: '',
    replyToContent: '',
    replyToSenderId: '',
    isUnsent: false,
    originalMessageId: id,
    reactions: '',
    readAt: '',
    deliveryStatus: 'delivered',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isDeleted: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useConversations', () => {
  beforeEach(async () => {
    dbRef.current = await createTestDb();
    mockFriendsRef.current = [];
  });

  afterEach(async () => {
    if (dbRef.current) {
      await destroyTestDb(
        dbRef.current as RxDatabase<TestDatabaseCollections>
      );
      dbRef.current = null;
    }
  });

  it('empty state: two friends, no messages → both conversations with lastMessage: null, unreadCount: 0', async () => {
    mockFriendsRef.current = [
      makeFriend({ friendId: 'user_B', friendUsername: 'b' }),
      makeFriend({ friendId: 'user_C', friendUsername: 'c' }),
    ];

    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.conversations).toHaveLength(2);
    for (const c of result.current.conversations) {
      expect(c.lastMessage).toBeNull();
      expect(c.unreadCount).toBe(0);
    }
    expect(result.current.totalUnread).toBe(0);
  });

  it('grouping: messages across two friends map to the correct conversation', async () => {
    // Regression: §16 (conversation list sort / grouping)
    mockFriendsRef.current = [
      makeFriend({ friendId: 'user_B', friendUsername: 'b' }),
      makeFriend({ friendId: 'user_C', friendUsername: 'c' }),
    ];
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.messages.bulkInsert([
      makeMessage({
        id: 'msg_b1',
        recipientId: 'user_B',
        createdAt: '2026-01-01T10:00:00.000Z',
      }),
      makeMessage({
        id: 'msg_c1',
        recipientId: 'user_C',
        createdAt: '2026-01-01T11:00:00.000Z',
      }),
    ]);

    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.conversations).toHaveLength(2);
    const byFriend = new Map(
      result.current.conversations.map((c) => [c.friend.friendId, c])
    );
    expect(byFriend.get('user_B')?.lastMessage?.id).toBe('msg_b1');
    expect(byFriend.get('user_C')?.lastMessage?.id).toBe('msg_c1');
  });

  it('sort: conversations with messages sort newest-first, then empty conversations alphabetically', async () => {
    // Regression: §16 (conversation list sort)
    mockFriendsRef.current = [
      makeFriend({ friendId: 'user_B', friendUsername: 'b', friendDisplayName: 'B' }),
      makeFriend({ friendId: 'user_C', friendUsername: 'c', friendDisplayName: 'C' }),
      makeFriend({ friendId: 'user_D', friendUsername: 'd', friendDisplayName: 'D' }),
    ];
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.messages.bulkInsert([
      makeMessage({
        id: 'msg_b1',
        recipientId: 'user_B',
        createdAt: '2026-01-01T10:00:00.000Z',
      }),
      makeMessage({
        id: 'msg_c1',
        recipientId: 'user_C',
        createdAt: '2026-01-01T12:00:00.000Z',
      }),
    ]);

    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const order = result.current.conversations.map((c) => c.friend.friendId);
    expect(order).toEqual(['user_C', 'user_B', 'user_D']);
  });

  it('unread: incoming without readAt counts; read incoming and all outgoing do not count', async () => {
    // Regression: §20.5 (unread badge contract)
    mockFriendsRef.current = [
      makeFriend({ friendId: 'user_B', friendUsername: 'b' }),
    ];
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.messages.bulkInsert([
      makeMessage({
        id: 'msg_i1',
        senderId: 'user_B',
        recipientId: 'user_A',
        direction: 'incoming',
        readAt: '',
        createdAt: '2026-01-01T10:00:00.000Z',
      }),
      makeMessage({
        id: 'msg_i2',
        senderId: 'user_B',
        recipientId: 'user_A',
        direction: 'incoming',
        readAt: '2026-01-01T10:30:00.000Z',
        createdAt: '2026-01-01T10:15:00.000Z',
      }),
      makeMessage({
        id: 'msg_o1',
        senderId: 'user_A',
        recipientId: 'user_B',
        direction: 'outgoing',
        readAt: '',
        createdAt: '2026-01-01T10:20:00.000Z',
      }),
    ]);

    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.conversations).toHaveLength(1);
    const convo = result.current.conversations[0];
    expect(convo.unreadCount).toBe(1);
    expect(result.current.totalUnread).toBe(1);
  });

  it('last message: the most recent message (any direction) becomes lastMessage', async () => {
    mockFriendsRef.current = [
      makeFriend({ friendId: 'user_B', friendUsername: 'b' }),
    ];
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.messages.bulkInsert([
      makeMessage({
        id: 'msg_o1',
        senderId: 'user_A',
        recipientId: 'user_B',
        direction: 'outgoing',
        createdAt: '2026-01-01T10:00:00.000Z',
      }),
      makeMessage({
        id: 'msg_i1',
        senderId: 'user_B',
        recipientId: 'user_A',
        direction: 'incoming',
        createdAt: '2026-01-01T11:00:00.000Z',
      }),
      makeMessage({
        id: 'msg_o2',
        senderId: 'user_A',
        recipientId: 'user_B',
        direction: 'outgoing',
        createdAt: '2026-01-01T10:30:00.000Z',
      }),
    ]);

    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.conversations[0].lastMessage?.id).toBe('msg_i1');
  });

  it('isLoading transition: starts true, becomes false after the subscription emits', async () => {
    const { result } = renderHook(() => useConversations());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
