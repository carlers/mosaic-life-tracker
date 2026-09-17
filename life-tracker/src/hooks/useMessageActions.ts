import { useCallback, useRef } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { makeThreadId, makeRecipientRowId } from '../lib/threads';
import {
  markReadOnRemote,
  unsendOnRemote,
} from '../lib/messageDelivery';
import {
  sendTextMessage,
  sendTaskReplyMessage,
  sendTaskReactionMessage,
  type ReplyContext,
} from '../lib/messageComposer';
import {
  toggleReactionOnMessage,
  type ToggleReactionResult,
} from '../lib/messageReactions';
import type { TaskDocument } from '../db/schema';

export type { ReplyContext };

export interface UseMessageActionsReturn {
  sendMessage: (content: string, replyTo?: ReplyContext) => Promise<void>;
  sendTaskReply: (
    task: TaskDocument,
    content: string,
    categoryColor: string
  ) => Promise<void>;
  sendTaskReaction: (
    task: TaskDocument,
    emoji: string,
    categoryColor: string
  ) => Promise<void>;
  markAllRead: () => Promise<void>;
  unsendMessage: (id: string) => Promise<void>;
  toggleReaction: (id: string, emoji: string) => Promise<ToggleReactionResult>;
}

/**
 * Write half of the messaging hook (HB-9). Owns every mutator the chat
 * UI calls: send, sendTaskReply, sendTaskReaction, markAllRead,
 * unsendMessage, toggleReaction. No subscription here — the read half
 * lives in `useThreadMessages`, and `useMessages` composes the two.
 *
 * The three send helpers are one-line delegations to
 * `messageComposer.ts` (HB-1); `toggleReaction` is a one-line
 * delegation to `messageReactions.ts` (HB-2).
 */
export function useMessageActions(
  friendId: string | null
): UseMessageActionsReturn {
  const { user } = useAuth();
  const markAllReadInFlightRef = useRef(false);

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
      await sendTextMessage(uid, friendId, trimmed, replyTo);
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
      await sendTaskReplyMessage(uid, friendId, task, trimmed, categoryColor);
    },
    [user?.$id, friendId]
  );

  const sendTaskReaction = useCallback(
    async (task: TaskDocument, emoji: string, categoryColor: string) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useMessages] Cannot react: User not authenticated');
        return;
      }
      if (!friendId) {
        console.error('[useMessages] Cannot react: No friendId');
        return;
      }
      const trimmed = emoji.trim();
      if (!trimmed) return;
      await sendTaskReactionMessage(uid, friendId, task, trimmed, categoryColor);
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
      markReadOnRemote(uid, friendId, tid);
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
        reactions: '',
        deliveryStatus: 'delivered',
        updatedAt: now,
      });
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
      unsendOnRemote(uid, id, recipientId);
    },
    [user?.$id]
  );

  const toggleReaction = useCallback(
    async (id: string, emoji: string): Promise<ToggleReactionResult> => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useMessages] Cannot react: User not authenticated');
        return 'ok';
      }
      return toggleReactionOnMessage(uid, id, emoji);
    },
    [user?.$id]
  );

  return {
    sendMessage,
    sendTaskReply,
    sendTaskReaction,
    markAllRead,
    unsendMessage,
    toggleReaction,
  };
}
