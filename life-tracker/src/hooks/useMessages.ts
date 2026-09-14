import { useState, useEffect, useCallback, useRef } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { makeThreadId } from '../lib/threads';
import {
  deliverPendingMessages,
  markReadOnRemote,
} from '../lib/messageDelivery';
import type { MessageDocument, TaskDocument } from '../db/schema';

export interface UseMessagesReturn {
  messages: MessageDocument[];
  isLoading: boolean;
  sendMessage: (content: string) => Promise<void>;
  sendTaskReply: (
    task: TaskDocument,
    content: string,
    categoryColor: string
  ) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useMessages(friendId: string | null): UseMessagesReturn {
  const { user } = useAuth();
  const userId = user?.$id;
  const [messages, setMessages] = useState<MessageDocument[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const markAllReadInFlightRef = useRef(false);

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
        console.error('[useMessages] init failed:', err);
      }
    })();

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [userId, friendId]);

  const sendMessage = useCallback(
    async (content: string) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useMessages] Cannot send: User not authenticated');
        return;
      }
      if (!friendId) {
        console.error('[useMessages] Cannot send: No friendId');
        return;
      }
      const trimmed = content.trim();
      if (!trimmed) return;

      const tid = await makeThreadId(uid, friendId);

      const db = getDatabase();
      const now = new Date().toISOString();
      const newMsg: MessageDocument = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: uid,
        threadId: tid,
        senderId: uid,
        recipientId: friendId,
        direction: 'outgoing',
        content: trimmed,
        taskRefId: '',
        taskRefTitle: '',
        taskRefDate: '',
        taskRefColor: '',
        readAt: '',
        deliveryStatus: 'pending',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };
      await db.messages.insert(newMsg);
      deliverPendingMessages(uid).catch((err) =>
        console.error('[useMessages] delivery failed:', err)
      );
    },
    [user?.$id, friendId]
  );

  const sendTaskReply = useCallback(
    async (task: TaskDocument, content: string, categoryColor: string) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useMessages] Cannot reply: User not authenticated');
        return;
      }
      if (!friendId) {
        console.error('[useMessages] Cannot reply: No friendId');
        return;
      }
      const trimmed = content.trim();
      if (!trimmed) return;

      const tid = await makeThreadId(uid, friendId);

      const db = getDatabase();
      const now = new Date().toISOString();
      const newMsg: MessageDocument = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: uid,
        threadId: tid,
        senderId: uid,
        recipientId: friendId,
        direction: 'outgoing',
        content: trimmed,
        taskRefId: task.id,
        taskRefTitle: task.title,
        taskRefDate: task.date,
        taskRefColor: categoryColor || '',
        readAt: '',
        deliveryStatus: 'pending',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };
      await db.messages.insert(newMsg);
      deliverPendingMessages(uid).catch((err) =>
        console.error('[useMessages] delivery failed:', err)
      );
    },
    [user?.$id, friendId]
  );

  const markAllRead = useCallback(async () => {
    const uid = user?.$id;
    if (!uid || !friendId) return;
    if (markAllReadInFlightRef.current) return;
    markAllReadInFlightRef.current = true;

    try {
      const tid = await makeThreadId(uid, friendId);
      const db = getDatabase();
      const unread = await db.messages
        .find({
          selector: {
            userId: uid,
            threadId: tid,
            direction: 'incoming',
            readAt: '',
            isDeleted: false,
          },
        })
        .exec();
      if (unread.length === 0) return;

      const now = new Date().toISOString();
      for (const stale of unread) {
        try {
          // Re-fetch fresh right before patching to avoid CONFLICT when the
          // sync engine writes a newer revision in between.
          const fresh = await db.messages.findOne(stale.id).exec();
          if (!fresh || fresh.readAt) continue;
          await fresh.patch({ readAt: now, updatedAt: now });
        } catch (patchErr) {
          const code = (patchErr as { code?: string })?.code;
          if (code !== 'CONFLICT') {
            console.error(
              '[useMessages] markAllRead patch failed:',
              patchErr
            );
          }
          // CONFLICT means another path already updated this row — safe to
          // skip; the desired state (readAt set) is already in place.
        }
      }

      // Fire-and-forget: tell the partner we've read their messages.
      markReadOnRemote(friendId, tid);
    } catch (err) {
      console.error('[useMessages] markAllRead failed:', err);
    } finally {
      markAllReadInFlightRef.current = false;
    }
  }, [user?.$id, friendId]);

  const key = userId && friendId ? `${userId}_${friendId}` : null;
  const visible = key && loadedKey === key ? messages : [];
  const isLoading = !!key && loadedKey !== key;

  return {
    messages: visible,
    isLoading,
    sendMessage,
    sendTaskReply,
    markAllRead,
  };
}