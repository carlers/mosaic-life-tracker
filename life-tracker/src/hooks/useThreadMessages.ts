import { useState, useEffect } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { makeThreadId } from '../lib/threads';
import type { MessageDocument } from '../db/schema';

export interface UseThreadMessagesReturn {
  messages: MessageDocument[];
  isLoading: boolean;
}

/**
 * Read-only subscription to a 1:1 thread's messages (HB-9, read half).
 * Owns the RxDB subscription only. All mutators live in
 * `useMessageActions`; `useMessages` composes the two so existing
 * callers are unchanged.
 *
 * Cross-user leakage guard is keyed on `${userId}_${friendId}` rather
 * than `userId` alone because the thread identity depends on both.
 */
export function useThreadMessages(
  friendId: string | null
): UseThreadMessagesReturn {
  const { user } = useAuth();
  const userId = user?.$id;
  const [messages, setMessages] = useState<MessageDocument[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !friendId) return;
    const uid = userId;
    const fid = friendId;
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | undefined;
    (async () => {
      try {
        const tid = await makeThreadId(uid, fid);
        if (!isMounted) return;
        const db = getDatabase();
        const query = db.messages.find({
          selector: {
            userId: uid,
            threadId: tid,
            isDeleted: false,
          },
          sort: [{ createdAt: 'asc' }],
        });
        const sub = query.$.subscribe((docs) => {
          if (!isMounted) return;
          setMessages(docs as MessageDocument[]);
          setLoadedKey(`${uid}_${fid}`);
        });
        if (!isMounted) {
          sub.unsubscribe();
        } else {
          subscription = sub;
        }
      } catch (err) {
        console.error('[useThreadMessages] init failed:', err);
      }
    })();
    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [userId, friendId]);

  const key = userId && friendId ? `${userId}_${friendId}` : null;
  const visible = key && loadedKey === key ? messages : [];
  const isLoading = !!key && loadedKey !== key;

  return { messages: visible, isLoading };
}
