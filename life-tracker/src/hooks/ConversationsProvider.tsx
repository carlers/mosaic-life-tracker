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
import type { MessageDocument } from '../db/schema';
interface ConversationsProviderProps {
  children: ReactNode;
}
export const ConversationsProvider: React.FC<ConversationsProviderProps> = ({
  children,
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
        const query = db.messages.find({
          selector: { userId: uid, isDeleted: false },
          sort: [{ createdAt: 'desc' }],
        });
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
  }, [userId]);
  const conversations = useMemo<Conversation[]>(() => {
    if (!userId || loadedUserId !== userId) return [];
    const byFriend = new Map<
      string,
      { lastMessage: MessageDocument; unreadCount: number }
    >();
    // The RxDB query is newest-first, so the first row seen for a counterpart
    // is its lastMessage. Count unread in the same pass to avoid allocating
    // per-friend message arrays and scanning them a second time.
    for (const m of allMessages) {
      const otherId = m.senderId === userId ? m.recipientId : m.senderId;
      const existing = byFriend.get(otherId);
      const unreadDelta =
        m.direction === 'incoming' && !m.readAt && !m.isUnsent ? 1 : 0;
      if (existing) {
        existing.unreadCount += unreadDelta;
      } else {
        byFriend.set(otherId, {
          lastMessage: m,
          unreadCount: unreadDelta,
        });
      }
    }
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
  }, [userId, loadedUserId, allMessages, friends]);
  const totalUnread = useMemo(
    () => conversations.reduce((n, c) => n + c.unreadCount, 0),
    [conversations]
  );
  const isLoading = !!userId && (loadedUserId !== userId || friendsLoading);
  const value = useMemo<ConversationsContextValue>(
    () => ({ conversations, totalUnread, isLoading }),
    [conversations, totalUnread, isLoading]
  );
  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
};
