import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { RxDatabase } from 'rxdb';
import { useUnreadMessages } from '../../src/hooks/useUnreadMessages';
import { ConversationsProvider } from '../../src/hooks/ConversationsProvider';
import {
  createTestDb,
  destroyTestDb,
  type TestDatabaseCollections,
} from '../helpers/testDb';
import type {
  MessageDocument,
  FriendshipDocument,
} from '../../src/db/schema';
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
const wrapper = ({ children }: { children: ReactNode }) => (
  <ConversationsProvider>{children}</ConversationsProvider>
);
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
function makeMessage(
  overrides: Partial<MessageDocument> = {}
): MessageDocument {
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
describe('useUnreadMessages', () => {
  beforeEach(async () => {
    dbRef.current = await createTestDb('messages');
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
  it('baseline: unread incoming from an accepted friend counts toward totalUnread', async () => {
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
    ]);
    const { result } = renderHook(() => useUnreadMessages(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalUnread).toBe(1);
  });
  it('unread incoming from a non-friend sender does not contribute to totalUnread', async () => {
    mockFriendsRef.current = [
      makeFriend({ friendId: 'user_B', friendUsername: 'b' }),
    ];
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.messages.bulkInsert([
      makeMessage({
        id: 'msg_c1',
        senderId: 'user_C',
        recipientId: 'user_A',
        direction: 'incoming',
        readAt: '',
        createdAt: '2026-01-01T10:00:00.000Z',
      }),
    ]);
    const stored = await db.messages.findOne('msg_c1').exec();
    expect(stored).not.toBeNull();
    expect(stored?.direction).toBe('incoming');
    expect(stored?.readAt).toBe('');
    const { result } = renderHook(() => useUnreadMessages(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalUnread).toBe(0);
  });
  it('read incoming and all outgoing do not contribute to totalUnread', async () => {
    mockFriendsRef.current = [
      makeFriend({ friendId: 'user_B', friendUsername: 'b' }),
    ];
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.messages.bulkInsert([
      makeMessage({
        id: 'msg_i_read',
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
    const { result } = renderHook(() => useUnreadMessages(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalUnread).toBe(0);
  });
  it('unsent incoming from an accepted friend does not contribute (regression: F3)', async () => {
    mockFriendsRef.current = [
      makeFriend({ friendId: 'user_B', friendUsername: 'b' }),
    ];
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.messages.bulkInsert([
      makeMessage({
        id: 'msg_unsent',
        senderId: 'user_B',
        recipientId: 'user_A',
        direction: 'incoming',
        readAt: '',
        isUnsent: true,
        createdAt: '2026-01-01T10:00:00.000Z',
      }),
    ]);
    const { result } = renderHook(() => useUnreadMessages(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalUnread).toBe(0);
  });
  it('isLoading transition: starts true, becomes false after the subscription emits', async () => {
    const { result } = renderHook(() => useUnreadMessages(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
