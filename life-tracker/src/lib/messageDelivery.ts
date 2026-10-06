import type { RxDocument } from 'rxdb';
import { getDatabase } from '../db/database';
import { isUnauthorizedError } from './authEvents';
import {
  enqueueMessageAction,
  flushMessageActionQueue,
  setMessageActionSender,
} from './messageActionQueue';
import type { MessageDocument } from '../db/schema';
import { getConnectivitySnapshot } from './connectivity';
import { APPWRITE_MESSAGE_ACTION_FUNCTION_ID } from './appwriteConfig';
import { sendAppAction } from './appAction';
import {
  captureAccountWorkGeneration,
  isAccountWorkCurrent,
} from './accountWorkScope';
const DEBUG = import.meta.env.DEV;
export const MESSAGE_ACTION_FUNCTION_ID = APPWRITE_MESSAGE_ACTION_FUNCTION_ID;
const MAX_DELIVERY_LOOPS = 5;
let inFlightDeliveryPromise: Promise<void> | null = null;
let inFlightDeliveryUserId: string | null = null;
let inFlightDeliveryGeneration: number | null = null;
let deliveryRequestedDuringFlight = false;
export const sendMessageAction = sendAppAction;
setMessageActionSender(sendMessageAction);
export { flushMessageActionQueue };
function shouldQueueMessageAction(err: unknown): boolean {
  if (isUnauthorizedError(err)) return false;
  const code = (err as { code?: number } | null)?.code;
  // No numeric code = network error, timeout, or offline: transient.
  if (typeof code !== 'number') return true;
  // 429: transient.
  if (code === 429) return true;
  // 5xx: transient.
  if (code >= 500) return true;
  // Any other 4xx: permanent. Retrying will not help.
  return false;
}
export async function deliverPendingMessages(userId: string): Promise<void> {
  if (!userId) return;
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null) return;

  flushMessageActionQueue(userId).catch((err) => {
    if (DEBUG) {
      console.error('[messageDelivery] queue flush failed:', err);
    }
  });

  if (inFlightDeliveryPromise) {
    if (
      inFlightDeliveryUserId === userId &&
      inFlightDeliveryGeneration === generation
    ) {
      deliveryRequestedDuringFlight = true;
      return inFlightDeliveryPromise;
    }

    const previous = inFlightDeliveryPromise;
    await previous;
    if (!isAccountWorkCurrent(userId, generation)) return;
    return deliverPendingMessages(userId);
  }

  if (!isAccountWorkCurrent(userId, generation)) return;
  if (getConnectivitySnapshot().status !== 'online') return;
  if (MESSAGE_ACTION_FUNCTION_ID.startsWith('REPLACE_')) {
    if (DEBUG) {
      console.warn(
        '[messageDelivery] MESSAGE_ACTION_FUNCTION_ID not configured — skipping delivery'
      );
    }
    return;
  }

  inFlightDeliveryUserId = userId;
  inFlightDeliveryGeneration = generation;
  inFlightDeliveryPromise = (async () => {
    try {
      let loopCount = 0;
      for (;;) {
        if (!isAccountWorkCurrent(userId, generation)) break;
        loopCount++;
        if (loopCount > MAX_DELIVERY_LOOPS) {
          console.warn(
            `[messageDelivery] delivery loop hit cap (${MAX_DELIVERY_LOOPS}); breaking`
          );
          break;
        }
        deliveryRequestedDuringFlight = false;
        let db;
        try {
          db = getDatabase();
        } catch (err) {
          console.error(
            '[messageDelivery] delivery cycle failed (db):',
            err
          );
          break;
        }
        let pending;
        try {
          pending = await db.messages
            .find({
              selector: {
                userId,
                direction: 'outgoing',
                deliveryStatus: 'pending',
                isDeleted: false,
              },
            })
            .exec();
        } catch (err) {
          console.error(
            '[messageDelivery] delivery cycle failed (query):',
            err
          );
          break;
        }
        if (!isAccountWorkCurrent(userId, generation)) break;
        if (DEBUG && pending.length > 0) {
          console.log(
            `[messageDelivery] ${pending.length} pending message(s)`
          );
        }
        for (const doc of pending) {
          if (!isAccountWorkCurrent(userId, generation)) break;
          try {
            await deliverOne(doc);
            if (!isAccountWorkCurrent(userId, generation)) break;
            await doc.patch({ deliveryStatus: 'delivered' });
          } catch (err) {
            console.error(
              `[messageDelivery] Failed to deliver ${doc.id}:`,
              err
            );
          }
        }
        if (
          !isAccountWorkCurrent(userId, generation) ||
          !deliveryRequestedDuringFlight
        ) {
          break;
        }
      }
    } finally {
      if (
        inFlightDeliveryUserId === userId &&
        inFlightDeliveryGeneration === generation
      ) {
        inFlightDeliveryPromise = null;
        inFlightDeliveryUserId = null;
        inFlightDeliveryGeneration = null;
        deliveryRequestedDuringFlight = false;
      }
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
  userId: string,
  partnerId: string,
  threadId: string
): Promise<void> {
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null) return;
  try {
    await sendMessageAction({
      action: 'mark_read',
      partnerId,
      threadId,
    });
  } catch (err) {
    if (
      shouldQueueMessageAction(err) &&
      isAccountWorkCurrent(userId, generation)
    ) {
      enqueueMessageAction(userId, {
        action: 'mark_read',
        payload: { partnerId, threadId },
        dedupKey: `mark_read:${threadId}`,
      });
    }
    console.error('[messageDelivery] markReadOnRemote failed:', err);
  }
}
export async function unsendOnRemote(
  userId: string,
  messageId: string,
  recipientId: string
): Promise<void> {
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null) return;
  try {
    await sendMessageAction({
      action: 'unsend',
      messageId,
      recipientId,
    });
  } catch (err) {
    if (
      shouldQueueMessageAction(err) &&
      isAccountWorkCurrent(userId, generation)
    ) {
      enqueueMessageAction(userId, {
        action: 'unsend',
        payload: { messageId, recipientId },
        dedupKey: `unsend:${messageId}`,
      });
    }
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
