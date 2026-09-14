import { Functions, ExecutionMethod } from 'appwrite';
import type { RxDocument } from 'rxdb';
import { client } from './appwrite';
import { getDatabase } from '../db/database';
import type { MessageDocument } from '../db/schema';

const DEBUG = import.meta.env.DEV;

const MESSAGE_ACTION_FUNCTION_ID = '6aa8057f002a4c306fdd';

const functions = new Functions(client);

let isDeliveryInProgress = false;

export async function sendMessageAction(
  payload: Record<string, unknown>
): Promise<void> {
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
}

export async function deliverPendingMessages(userId: string): Promise<void> {
  if (isDeliveryInProgress) return;
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

  isDeliveryInProgress = true;
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
    isDeliveryInProgress = false;
  }
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

/**
 * Notifies the server to wipe both the sender's and recipient's copies of a
 * message (the tombstone flow). Non-blocking; failures are logged but never
 * thrown — the local patch already applied the tombstone.
 */
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