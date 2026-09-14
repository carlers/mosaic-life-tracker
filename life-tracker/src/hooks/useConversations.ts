import { useState, useEffect, useMemo } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useFriends } from './useFriends';
import type { MessageDocument, FriendshipDocument } from '../db/schema';

export interface Conversation {
  threadId: string; // '' when no messages yet
  friend: FriendshipDocument;
  lastMessage: MessageDocument | null;
  unreadCount: number;
}

export interface UseConversationsReturn {
  conversations: Conversation[];
  totalUnread: number;
  isLoading: boolean;
}

export function useConversations(): UseConversationsReturn {
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
        console.error('[useConversations] init failed:', err);
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

    // Group all messages by the "other" user id. `allMessages` is sorted
    // desc by createdAt, so each per-friend array is already newest-first.
    const byFriend = new Map<string, MessageDocument[]>();
    for (const m of allMessages) {
      const otherId = m.senderId === userId ? m.recipientId : m.senderId;
      const arr = byFriend.get(otherId);
      if (arr) arr.push(m);
      else byFriend.set(otherId, [m]);
    }

    const list: Conversation[] = [];
    for (const friend of friends) {
      const msgs = byFriend.get(friend.friendId) || [];
      const lastMessage = msgs.length > 0 ? msgs[0] : null;
      let unreadCount = 0;
      for (const m of msgs) {
        if (m.direction === 'incoming' && !m.readAt) unreadCount++;
      }
      list.push({
        threadId: lastMessage?.threadId || '',
        friend,
        lastMessage,
        unreadCount,
      });
    }

    // Sort: chats with messages by newest-first; then chats with no messages
    // alphabetically by display name.
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

  return { conversations, totalUnread, isLoading };
}