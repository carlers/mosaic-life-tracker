import { Functions, ExecutionMethod } from 'appwrite';
import type { RxDocument } from 'rxdb';
import { client } from './appwrite';
import { getDatabase } from '../db/database';
import type { MessageDocument } from '../db/schema';

const DEBUG = import.meta.env.DEV;

/**
 * Appwrite Function ID for `message-action`.
 * Deploy `appwrite-functions/message-action/` and paste the resulting ID here.
 */
const MESSAGE_ACTION_FUNCTION_ID = '6aa8057f002a4c306fdd';

const functions = new Functions(client);

let isDeliveryInProgress = false;

/**
 * Generic wrapper for calling the `message-action` Appwrite Function.
 * Throws on any non-2xx response.
 */
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

/**
 * Scans the local `messages` collection for outgoing rows still marked
 * `deliveryStatus: 'pending'`, and pushes each one to the recipient via the
 * `message-action` function's `deliver` action.
 *
 * Safe to call frequently (focus, online, after send). Re-entrancy is
 * guarded internally.
 */
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
    createdAt: doc.createdAt,
  });
}

/**
 * Notifies the partner that we've read their outgoing messages in this thread.
 * Non-blocking; failures are logged but never thrown.
 */
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