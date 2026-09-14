import { Functions, ExecutionMethod } from 'appwrite';
import type { RxDocument } from 'rxdb';
import { client } from './appwrite';
import { getDatabase } from '../db/database';
import type { MessageDocument } from '../db/schema';

const DEBUG = import.meta.env.DEV;

/**
 * Appwrite Function ID for `deliver-message`.
 * Deploy `appwrite-functions/deliver-message/` and paste the resulting ID here.
 */
const DELIVER_FUNCTION_ID = '6aa7ffa400242f830bb6';

const functions = new Functions(client);

let isDeliveryInProgress = false;

/**
 * Scans the local `messages` collection for outgoing rows still marked
 * `deliveryStatus: 'pending'`, and pushes each one to the recipient via the
 * `deliver-message` Appwrite Function.
 *
 * Safe to call frequently (focus, online, after send). Re-entrancy is
 * guarded internally.
 */
export async function deliverPendingMessages(userId: string): Promise<void> {
  if (isDeliveryInProgress) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (!userId) return;
  if (DELIVER_FUNCTION_ID.startsWith('REPLACE_')) {
    if (DEBUG) {
      console.warn(
        '[messageDelivery] DELIVER_FUNCTION_ID not configured — skipping delivery'
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
  const execution = await functions.createExecution({
    functionId: DELIVER_FUNCTION_ID,
    body: JSON.stringify({
      messageId: doc.id,
      recipientId: doc.recipientId,
      content: doc.content,
      taskRefId: doc.taskRefId,
      taskRefTitle: doc.taskRefTitle,
      taskRefDate: doc.taskRefDate,
      taskRefColor: doc.taskRefColor,
      createdAt: doc.createdAt,
    }),
    async: false,
    xpath: '/',
    method: ExecutionMethod.POST,
  });

  if (
    execution.status !== 'completed' ||
    execution.responseStatusCode >= 400
  ) {
    throw new Error(
      `Delivery failed (${execution.responseStatusCode}): ${execution.responseBody}`
    );
  }
}