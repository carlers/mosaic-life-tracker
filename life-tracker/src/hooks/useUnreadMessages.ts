import { useState, useEffect, useMemo } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useFriends } from './useFriends';
import type { MessageDocument } from '../db/schema';

export interface UseUnreadMessagesReturn {
  totalUnread: number;
  isLoading: boolean;
}

export function useUnreadMessages(): UseUnreadMessagesReturn {
  const { user } = useAuth();
  const userId = user?.$id;
  const { friends, isLoading: friendsLoading } = useFriends();

  const [unread, setUnread] = useState<MessageDocument[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const uid = userId;
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | undefined;
    (async () => {
      try {
        const db = getDatabase();
        // Lighter query: only incoming, unread, non-deleted rows for this
        // user. Matches the trailing fields of `['userId', 'direction',
        // 'readAt']`, so RxDB uses that index instead of the full-scan-by-
        // user path `useConversations` needs for the inbox. The `sort` on
        // `readAt` is a no-op semantically (every matching row has
        // `readAt === ''`) but is the trailing index field, so the query
        // planner can pick the index without a scan-and-sort.
        const query = db.messages.find({
          selector: {
            userId: uid,
            direction: 'incoming',
            readAt: '',
            isDeleted: false,
          },
          sort: [{ readAt: 'asc' }],
        });
        const sub = query.$.subscribe((docs) => {
          if (!isMounted) return;
          setUnread(docs as MessageDocument[]);
          setLoadedUserId(uid);
        });
        if (!isMounted) {
          sub.unsubscribe();
        } else {
          subscription = sub;
        }
      } catch (err) {
        console.error('[useUnreadMessages] init failed:', err);
        if (isMounted) setLoadedUserId(uid);
      }
    })();
    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [userId]);

  // Preserves the `useConversations` semantic: an incoming unread message
  // only contributes to the badge if its sender is a currently-accepted
  // friend. Messages from users who are no longer friends (or were never
  // friends) are excluded.
  const totalUnread = useMemo(() => {
    if (!userId || loadedUserId !== userId) return 0;
    const friendIds = new Set(friends.map((f) => f.friendId));
    let n = 0;
    for (const m of unread) {
      if (friendIds.has(m.senderId)) n++;
    }
    return n;
  }, [userId, loadedUserId, unread, friends]);

  const isLoading = !!userId && (loadedUserId !== userId || friendsLoading);
  return { totalUnread, isLoading };
}
