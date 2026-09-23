import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { Profiler, useContext, type ReactNode } from 'react';
import { useConversations } from '../../src/hooks/useConversations';
import { useUnreadMessages } from '../../src/hooks/useUnreadMessages';
import type { RxDatabase } from 'rxdb';
import { ConversationsProvider } from '../../src/hooks/ConversationsProvider';
import {
  ConversationsContext,
  type ConversationsContextValue,
} from '../../src/hooks/conversationsContext';
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
vi.mock('../../src/hooks/useFriends', () => ({
  useFriends: () => ({
    friends: mockFriendsRef.current,
    isLoading: false,
  }),
}));
const wrapper = ({ children }: { children: ReactNode }) => (
  <ConversationsProvider>{children}</ConversationsProvider>
);
function useProviderValue(): ConversationsContextValue {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error('useProviderValue used outside provider');
  return ctx;
}
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
describe('ConversationsProvider', () => {
  beforeEach(async () => {
    dbRef.current = await createTestDb('messages');
    mockFriendsRef.current = [];
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
  it('exposes empty state when there is no authenticated user', () => {
    mockUserRef.current = null;
    const { result } = renderHook(() => useProviderValue(), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.conversations).toEqual([]);
    expect(result.current.totalUnread).toBe(0);
  });
  it('exposes empty state when there are no friends and no messages', async () => {
    const { result } = renderHook(() => useProviderValue(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversations).toEqual([]);
    expect(result.current.totalUnread).toBe(0);
  });
  it('builds one conversation per accepted friend, with no messages yet', async () => {
    mockFriendsRef.current = [
      makeFriend({ friendId: 'user_B', friendUsername: 'b' }),
      makeFriend({ friendId: 'user_C', friendUsername: 'c' }),
    ];
    const { result } = renderHook(() => useProviderValue(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversations).toHaveLength(2);
    for (const c of result.current.conversations) {
      expect(c.lastMessage).toBeNull();
      expect(c.unreadCount).toBe(0);
    }
    expect(result.current.totalUnread).toBe(0);
  });
  it('counts unread incoming messages from accepted friends', async () => {
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
    const { result } = renderHook(() => useProviderValue(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalUnread).toBe(1);
    expect(result.current.conversations[0].unreadCount).toBe(1);
  });
  it('excludes unsent incoming messages from unread counts (regression: F3)', async () => {
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
    const { result } = renderHook(() => useProviderValue(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalUnread).toBe(0);
    expect(result.current.conversations[0].unreadCount).toBe(0);
  });
  it('sorts conversations with messages newest-first, then empty conversations alphabetically', async () => {
    mockFriendsRef.current = [
      makeFriend({
        friendId: 'user_B',
        friendUsername: 'b',
        friendDisplayName: 'B',
      }),
      makeFriend({
        friendId: 'user_C',
        friendUsername: 'c',
        friendDisplayName: 'C',
      }),
      makeFriend({
        friendId: 'user_D',
        friendUsername: 'd',
        friendDisplayName: 'D',
      }),
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
    const { result } = renderHook(() => useProviderValue(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const order = result.current.conversations.map((c) => c.friend.friendId);
    expect(order).toEqual(['user_C', 'user_B', 'user_D']);
  });
  // Regression: PROJECT_REFERENCE.md §16 — unread badge consumers stay isolated from conversation-detail churn.
  it('does not rerender an unread-only consumer when an outgoing message changes conversations but not unread count', async () => {
    mockFriendsRef.current = [
      makeFriend({ friendId: 'user_B', friendUsername: 'b' }),
    ];
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    const unreadCommits = vi.fn();

    function UnreadProbe() {
      const { totalUnread, isLoading } = useUnreadMessages();
      return (
        <output data-testid="unread-probe">
          {isLoading ? 'loading' : `ready:${totalUnread}`}
        </output>
      );
    }

    function ConversationProbe() {
      const { conversations } = useConversations();
      return (
        <output data-testid="conversation-probe">
          {conversations[0]?.lastMessage?.id ?? 'none'}
        </output>
      );
    }

    render(
      <ConversationsProvider>
        <Profiler id="unread" onRender={unreadCommits}>
          <UnreadProbe />
        </Profiler>
        <ConversationProbe />
      </ConversationsProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('unread-probe')).toHaveTextContent('ready:0')
    );
    unreadCommits.mockClear();

    await act(async () => {
      await db.messages.insert(
        makeMessage({
          id: 'msg_outgoing_perf',
          senderId: 'user_A',
          recipientId: 'user_B',
          direction: 'outgoing',
          createdAt: '2026-01-01T12:00:00.000Z',
        })
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId('conversation-probe')).toHaveTextContent(
        'msg_outgoing_perf'
      )
    );
    expect(screen.getByTestId('unread-probe')).toHaveTextContent('ready:0');
    expect(unreadCommits).not.toHaveBeenCalled();
  });

  it('resets conversations and unread on user switch', async () => {
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
    const { result, rerender } = renderHook(() => useProviderValue(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalUnread).toBe(1);
    mockUserRef.current = { $id: 'user_Z' };
    rerender();
    await waitFor(() => expect(result.current.totalUnread).toBe(0));
  });
});
