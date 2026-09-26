import React, {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useFriends } from './useFriends';
import {
  ConversationsContext,
  type Conversation,
  type ConversationsContextValue,
} from './conversationsContext';
import {
  UnreadMessagesContext,
  type UnreadMessagesContextValue,
} from './unreadMessagesContext';
import type { MessageDocument } from '../db/schema';

const EMPTY_CONVERSATIONS: Conversation[] = [];

interface ConversationsProviderProps {
  children: ReactNode;
  includeConversations?: boolean;
}

export const ConversationsProvider: React.FC<ConversationsProviderProps> = ({
  children,
  includeConversations = true,
}) => {
  const { user } = useAuth();
  const userId = user?.$id;
  const { friends, isLoading: friendsLoading } = useFriends();
  const [allMessages, setAllMessages] = useState<MessageDocument[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const uid = userId;
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | undefined;

    (async () => {
      try {
        const db = getDatabase();
        // Home only needs the unread nav badge. Avoid hydrating the entire
        // message history until a conversation route is actually active.
        const query = db.messages.find(
          includeConversations
            ? {
                selector: { userId: uid, isDeleted: false },
                sort: [{ createdAt: 'desc' }],
              }
            : {
                selector: {
                  userId: uid,
                  isDeleted: false,
                  direction: 'incoming',
                  readAt: '',
                  isUnsent: false,
                },
              }
        );
        const sub = query.$.subscribe((docs) => {
          if (!isMounted) return;
          setAllMessages(docs as MessageDocument[]);
          setLoadedUserId(uid);
        });
        if (!isMounted) {
          sub.unsubscribe();
        } else {
          subscription = sub;
        }
      } catch (err) {
        console.error('[ConversationsProvider] init failed:', err);
        if (isMounted) setLoadedUserId(uid);
      }
    })();

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [userId, includeConversations]);

  const aggregation = useMemo(() => {
    if (!userId || loadedUserId !== userId) {
      return {
        totalUnread: 0,
        byFriend: null as Map<
          string,
          { lastMessage: MessageDocument; unreadCount: number }
        > | null,
      };
    }

    const acceptedFriendIds = new Set(friends.map((friend) => friend.friendId));
    const byFriend = includeConversations
      ? new Map<
          string,
          { lastMessage: MessageDocument; unreadCount: number }
        >()
      : null;
    let totalUnread = 0;

    // The RxDB query is newest-first. Outside Messages/Chat routes we only
    // maintain the nav badge; avoid allocating the per-friend map and sorting
    // a conversation list that has no consumer.
    for (const message of allMessages) {
      const otherId =
        message.senderId === userId ? message.recipientId : message.senderId;
      if (!acceptedFriendIds.has(otherId)) continue;

      const unreadDelta =
        message.direction === 'incoming' &&
        !message.readAt &&
        !message.isUnsent
          ? 1
          : 0;
      totalUnread += unreadDelta;

      if (!byFriend) continue;
      const existing = byFriend.get(otherId);
      if (existing) {
        existing.unreadCount += unreadDelta;
      } else {
        byFriend.set(otherId, {
          lastMessage: message,
          unreadCount: unreadDelta,
        });
      }
    }

    return { totalUnread, byFriend };
  }, [
    allMessages,
    friends,
    includeConversations,
    loadedUserId,
    userId,
  ]);

  const conversations = useMemo<Conversation[]>(() => {
    const byFriend = aggregation.byFriend;
    if (!includeConversations || !byFriend) return EMPTY_CONVERSATIONS;

    const list: Conversation[] = [];
    for (const friend of friends) {
      const summary = byFriend.get(friend.friendId);
      const lastMessage = summary?.lastMessage ?? null;
      list.push({
        threadId: lastMessage?.threadId || '',
        friend,
        lastMessage,
        unreadCount: summary?.unreadCount ?? 0,
      });
    }

    list.sort((a, b) => {
      if (a.lastMessage && b.lastMessage) {
        return b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt);
      }
      if (a.lastMessage) return -1;
      if (b.lastMessage) return 1;
      const an = (
        a.friend.friendDisplayName ||
        a.friend.friendUsername ||
        ''
      ).toLowerCase();
      const bn = (
        b.friend.friendDisplayName ||
        b.friend.friendUsername ||
        ''
      ).toLowerCase();
      return an.localeCompare(bn);
    });

    return list;
  }, [aggregation.byFriend, friends, includeConversations]);

  const totalUnread = aggregation.totalUnread;
  const isLoading = !!userId && (loadedUserId !== userId || friendsLoading);

  const conversationValue = useMemo<ConversationsContextValue>(
    () => ({ conversations, totalUnread, isLoading }),
    [conversations, totalUnread, isLoading]
  );
  const unreadValue = useMemo<UnreadMessagesContextValue>(
    () => ({ totalUnread, isLoading }),
    [totalUnread, isLoading]
  );

  return (
    <UnreadMessagesContext.Provider value={unreadValue}>
      <ConversationsContext.Provider value={conversationValue}>
        {children}
      </ConversationsContext.Provider>
    </UnreadMessagesContext.Provider>
  );
};
