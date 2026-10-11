import { getDatabase } from '../db/database';
import { makeThreadId } from './threads';
import { deliverPendingMessages } from './messageDelivery';
import type { MessageDocument, TaskDocument } from '../db/schema';
import { canonicalReplyStickerContent } from './replyStickerContent';

export interface ReplyContext {
  id: string;
  senderId: string;
  content: string;
}

function truncateForSnapshot(s: string, max = 100): string {
  // Sticker references are short and already validated against the provider /
  // curated catalog. Preserve the newline: flattening it destroys the token.
  const sticker = canonicalReplyStickerContent(s);
  if (sticker) return sticker;
  const trimmed = s.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1) + '…';
}

/**
 * Builder for an outgoing message row. HB-1: the three outgoing-message
 * builders in `useMessages` were byte-identical except for which of
 * `content` / `taskRef*` / `replyTo*` they populated. `overrides`
 * supplies exactly those differences; everything else is fixed.
 */
export interface OutgoingMessageInput {
  userId: string;
  friendId: string;
  threadId: string;
  now: string;
  localId: string;
  content: string;
  taskRefId?: string;
  taskRefTitle?: string;
  taskRefDate?: string;
  taskRefColor?: string;
  replyTo?: ReplyContext;
}

export function buildOutgoingMessage(
  input: OutgoingMessageInput
): MessageDocument {
  return {
    id: input.localId,
    userId: input.userId,
    threadId: input.threadId,
    senderId: input.userId,
    recipientId: input.friendId,
    direction: 'outgoing',
    content: input.content,
    taskRefId: input.taskRefId || '',
    taskRefTitle: input.taskRefTitle || '',
    taskRefDate: input.taskRefDate || '',
    taskRefColor: input.taskRefColor || '',
    replyToId: input.replyTo?.id || '',
    replyToContent: input.replyTo
      ? truncateForSnapshot(input.replyTo.content)
      : '',
    replyToSenderId: input.replyTo?.senderId || '',
    isUnsent: false,
    originalMessageId: input.localId,
    reactions: '',
    readAt: '',
    deliveryStatus: 'pending',
    createdAt: input.now,
    updatedAt: input.now,
    isDeleted: false,
  };
}

function makeLocalMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Inserts a new outgoing message and kicks off delivery. Shared by all
 * three send paths. Errors from `deliverPendingMessages` are logged but
 * swallowed — the pending row is the source of truth and the delivery
 * loop will retry on the next trigger.
 */
export async function insertAndDeliverOutgoing(
  userId: string,
  friendId: string,
  build: (args: { threadId: string; now: string; localId: string }) => MessageDocument
): Promise<void> {
  const tid = await makeThreadId(userId, friendId);
  const db = getDatabase();
  const now = new Date().toISOString();
  const localId = makeLocalMessageId();
  const newMsg = build({ threadId: tid, now, localId });
  await db.messages.insert(newMsg);
  deliverPendingMessages(userId).catch((err) =>
    console.error('[useMessages] delivery failed:', err)
  );
}

/**
 * Sends a plain text message. `content` must already be trimmed and
 * non-empty; the caller validates.
 */
export async function sendTextMessage(
  userId: string,
  friendId: string,
  content: string,
  replyTo?: ReplyContext
): Promise<void> {
  await insertAndDeliverOutgoing(userId, friendId, ({ threadId, now, localId }) =>
    buildOutgoingMessage({
      userId,
      friendId,
      threadId,
      now,
      localId,
      content,
      replyTo,
    })
  );
}

/**
 * Sends a task reply — a message whose body is `content` and which
 * carries a task reference. `categoryColor` is the task's category
 * color at send time.
 */
export async function sendTaskReplyMessage(
  userId: string,
  friendId: string,
  task: TaskDocument,
  content: string,
  categoryColor: string
): Promise<void> {
  await insertAndDeliverOutgoing(userId, friendId, ({ threadId, now, localId }) =>
    buildOutgoingMessage({
      userId,
      friendId,
      threadId,
      now,
      localId,
      content,
      taskRefId: task.id,
      taskRefTitle: task.title,
      taskRefDate: task.date,
      taskRefColor: categoryColor,
    })
  );
}

/**
 * Sends a task reaction — a message whose body is the emoji and which
 * carries a task reference. Identical shape to a task reply; kept as a
 * named entry point so the call site reads intent.
 */
export async function sendTaskReactionMessage(
  userId: string,
  friendId: string,
  task: TaskDocument,
  emoji: string,
  categoryColor: string
): Promise<void> {
  await insertAndDeliverOutgoing(userId, friendId, ({ threadId, now, localId }) =>
    buildOutgoingMessage({
      userId,
      friendId,
      threadId,
      now,
      localId,
      content: emoji,
      taskRefId: task.id,
      taskRefTitle: task.title,
      taskRefDate: task.date,
      taskRefColor: categoryColor,
    })
  );
}
