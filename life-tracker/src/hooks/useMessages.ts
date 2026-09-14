import { useState, useEffect, useCallback, useRef } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { makeThreadId, makeRecipientRowId } from '../lib/threads';
import {
  deliverPendingMessages,
  markReadOnRemote,
  unsendOnRemote,
} from '../lib/messageDelivery';
import type { MessageDocument, TaskDocument } from '../db/schema';

export interface ReplyContext {
  id: string;
  senderId: string;
  content: string;
}

export interface UseMessagesReturn {
  messages: MessageDocument[];
  isLoading: boolean;
  sendMessage: (content: string, replyTo?: ReplyContext) => Promise<void>;
  sendTaskReply: (
    task: TaskDocument,
    content: string,
    categoryColor: string
  ) => Promise<void>;
  markAllRead: () => Promise<void>;
  unsendMessage: (id: string) => Promise<void>;
}

function truncateForSnapshot(s: string, max = 100): string {
  const trimmed = s.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1) + '…';
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
    async (content: string, replyTo?: ReplyContext) => {
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
        replyToId: replyTo?.id || '',
        replyToContent: replyTo ? truncateForSnapshot(replyTo.content) : '',
        replyToSenderId: replyTo?.senderId || '',
        isUnsent: false,
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
        replyToId: '',
        replyToContent: '',
        replyToSenderId: '',
        isUnsent: false,
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
        }
      }

      markReadOnRemote(friendId, tid);
    } catch (err) {
      console.error('[useMessages] markAllRead failed:', err);
    } finally {
      markAllReadInFlightRef.current = false;
    }
  }, [user?.$id, friendId]);

  const unsendMessage = useCallback(
    async (id: string) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useMessages] Cannot unsend: User not authenticated');
        return;
      }

      const db = getDatabase();
      const doc = await db.messages.findOne(id).exec();
      if (!doc) return;
      if (doc.direction !== 'outgoing') {
        console.error('[useMessages] Cannot unsend: not an outgoing message');
        return;
      }

      const recipientId = doc.recipientId;
      const now = new Date().toISOString();

      // Local tombstone first so the UI reacts immediately.
      await doc.patch({
        content: '',
        taskRefId: '',
        taskRefTitle: '',
        taskRefDate: '',
        taskRefColor: '',
        replyToId: '',
        replyToContent: '',
        replyToSenderId: '',
        isUnsent: true,
        deliveryStatus: 'delivered',
        updatedAt: now,
      });

      // Cascade: wipe the reply snapshot on any messages (own + received)
      // that quoted this one.
      //
      // Two IDs must be checked because the `replyToId` field is stored from
      // the perspective of whoever wrote the reply:
      //   - "msg_<id>"      → replies the sender wrote to their own message
      //   - "rmsg_<hash>"   → replies the *recipient* wrote (their local copy
      //                       of the original has this synthetic row id)
      const rmsgId = await makeRecipientRowId(id);

      try {
        const replies = await db.messages
          .find({
            selector: {
              userId: uid,
              isDeleted: false,
              $or: [{ replyToId: id }, { replyToId: rmsgId }],
            },
          })
          .exec();

        for (const reply of replies) {
          try {
            const fresh = await db.messages.findOne(reply.id).exec();
            if (!fresh) continue;
            if (fresh.replyToContent === '') continue;
            await fresh.patch({ replyToContent: '', updatedAt: now });
          } catch (cascadeErr) {
            const code = (cascadeErr as { code?: string })?.code;
            if (code !== 'CONFLICT') {
              console.error(
                '[useMessages] unsend cascade patch failed:',
                cascadeErr
              );
            }
          }
        }
      } catch (cascadeQueryErr) {
        console.error(
          '[useMessages] unsend cascade query failed:',
          cascadeQueryErr
        );
      }

      // Fire-and-forget remote wipe (both sides + cascade).
      unsendOnRemote(id, recipientId);
    },
    [user?.$id]
  );

  const key = userId && friendId ? `${userId}_${friendId}` : null;
  const visible = key && loadedKey === key ? messages : [];
  const isLoading = !!key && loadedKey !== key;

  return {
    messages: visible,
    isLoading,
    sendMessage,
    sendTaskReply,
    markAllRead,
    unsendMessage,
  };
}