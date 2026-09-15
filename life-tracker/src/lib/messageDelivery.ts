import { Functions, ExecutionMethod } from 'appwrite';
import type { RxDocument } from 'rxdb';
import { client } from './appwrite';
import { getDatabase } from '../db/database';
import type { MessageDocument } from '../db/schema';

const DEBUG = import.meta.env.DEV;

export const MESSAGE_ACTION_FUNCTION_ID =
  '6aa8057f002a4c306fdd';

const functions = new Functions(client);

let inFlightDeliveryPromise: Promise<void> | null = null;

export async function sendMessageAction(
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Offline');
  }
  if (MESSAGE_ACTION_FUNCTION_ID.startsWith('REPLACE_')) {
    throw new Error('MESSAGE_ACTION_FUNCTION_ID not configured');
  }
  const execution = await functions.createExecution({
    functionId: MESSAGE_ACTION_FUNCTION_ID,
    body: JSON.stringify(payload),
    async: false,
    xpath: '/',
    method: ExecutionMethod.POST,
  });
  if (
    execution.status !== 'completed' ||
    execution.responseStatusCode >= 400
  ) {
    throw new Error(
      `Message action failed (${execution.responseStatusCode}): ${execution.responseBody}`
    );
  }
  try {
    return JSON.parse(execution.responseBody) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function deliverPendingMessages(userId: string): Promise<void> {
  // If a delivery cycle is already running, return its promise so callers
  // (e.g. the react handler) can await the current cycle instead of starting
  // a parallel one or bailing out early.
  if (inFlightDeliveryPromise) return inFlightDeliveryPromise;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (!userId) return;
  if (MESSAGE_ACTION_FUNCTION_ID.startsWith('REPLACE_')) {
    if (DEBUG) {
      console.warn(
        '[messageDelivery] MESSAGE_ACTION_FUNCTION_ID not configured — skipping delivery'
      );
    }
    return;
  }

  inFlightDeliveryPromise = (async () => {
    try {
      const db = getDatabase();
      const pending = await db.messages
        .find({
          selector: {
            userId,
            direction: 'outgoing',
            deliveryStatus: 'pending',
            isDeleted: false,
          },
        })
        .exec();
      if (pending.length === 0) return;
      if (DEBUG) {
        console.log(`[messageDelivery] ${pending.length} pending message(s)`);
      }
      for (const doc of pending) {
        try {
          await deliverOne(doc);
          await doc.patch({ deliveryStatus: 'delivered' });
        } catch (err) {
          console.error(
            `[messageDelivery] Failed to deliver ${doc.id}:`,
            err
          );
        }
      }
    } finally {
      inFlightDeliveryPromise = null;
    }
  })();
  return inFlightDeliveryPromise;
}

async function deliverOne(doc: RxDocument<MessageDocument>): Promise<void> {
  await sendMessageAction({
    action: 'deliver',
    messageId: doc.id,
    recipientId: doc.recipientId,
    content: doc.content,
    taskRefId: doc.taskRefId,
    taskRefTitle: doc.taskRefTitle,
    taskRefDate: doc.taskRefDate,
    taskRefColor: doc.taskRefColor,
    replyToId: doc.replyToId || '',
    replyToContent: doc.replyToContent || '',
    replyToSenderId: doc.replyToSenderId || '',
    createdAt: doc.createdAt,
  });
}

export async function markReadOnRemote(
  partnerId: string,
  threadId: string
): Promise<void> {
  try {
    await sendMessageAction({
      action: 'mark_read',
      partnerId,
      threadId,
    });
  } catch (err) {
    console.error('[messageDelivery] markReadOnRemote failed:', err);
  }
}

export async function unsendOnRemote(
  messageId: string,
  recipientId: string
): Promise<void> {
  try {
    await sendMessageAction({
      action: 'unsend',
      messageId,
      recipientId,
    });
  } catch (err) {
    console.error('[messageDelivery] unsendOnRemote failed:', err);
  }
}

export async function reactOnRemote(
  myRowId: string,
  peerRowId: string,
  recipientId: string,
  emoji: string,
  op: 'add' | 'remove'
): Promise<string | null> {
  try {
    const result = await sendMessageAction({
      action: 'react',
      myRowId,
      peerRowId: peerRowId || '',
      recipientId,
      emoji,
      op,
    });
    const resolved = result?.resolvedPeerRowId;
    return typeof resolved === 'string' && resolved.length > 0 ? resolved : null;
  } catch (err) {
    console.error('[messageDelivery] reactOnRemote failed:', err);
    return null;
  }
}

export async function reactToTaskOnRemote(
  taskId: string,
  taskOwnerId: string,
  emoji: string,
  op: 'add' | 'remove'
): Promise<string> {
  const result = await sendMessageAction({
    action: 'react_to_task',
    taskId,
    taskOwnerId,
    emoji,
    op,
  });
  const reactions = result?.reactions;
  return typeof reactions === 'string' ? reactions : '';
}