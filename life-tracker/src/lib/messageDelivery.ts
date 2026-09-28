import { ExecutionMethod } from 'appwrite';
import type { RxDocument } from 'rxdb';
import { getDatabase } from '../db/database';
import { guardedFunctions } from './sdk';
import { isUnauthorizedError } from './authEvents';
import {
  enqueueMessageAction,
  flushMessageActionQueue,
  setMessageActionSender,
} from './messageActionQueue';
import type { MessageDocument } from '../db/schema';
import { getConnectivitySnapshot } from './connectivity';
import { APPWRITE_MESSAGE_ACTION_FUNCTION_ID } from './appwriteConfig';
const DEBUG = import.meta.env.DEV;
export const MESSAGE_ACTION_FUNCTION_ID = APPWRITE_MESSAGE_ACTION_FUNCTION_ID;
const SEND_TIMEOUT_MS = 15_000;
const MAX_DELIVERY_LOOPS = 5;
let inFlightDeliveryPromise: Promise<void> | null = null;
let deliveryRequestedDuringFlight = false;
export async function sendMessageAction(
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (getConnectivitySnapshot().status !== 'online') {
    throw new Error('Offline');
  }
  if (MESSAGE_ACTION_FUNCTION_ID.startsWith('REPLACE_')) {
    throw new Error('MESSAGE_ACTION_FUNCTION_ID not configured');
  }
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const execPromise = guardedFunctions.createExecution({
    functionId: MESSAGE_ACTION_FUNCTION_ID,
    body: JSON.stringify(payload),
    async: false,
    xpath: '/',
    method: ExecutionMethod.POST,
  });
  execPromise.catch(() => {});
  const execution = await Promise.race([
    execPromise,
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () =>
          reject(
            new Error(
              `Message action timed out after ${SEND_TIMEOUT_MS}ms`
            )
          ),
        SEND_TIMEOUT_MS
      );
    }),
  ]).finally(() => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  });
  if (
    execution.status !== 'completed' ||
    execution.responseStatusCode >= 400
  ) {
    const err = new Error(
      `Message action failed (${execution.responseStatusCode}): ${execution.responseBody}`
    );
    (err as { code?: number }).code = execution.responseStatusCode;
    try {
      const result = JSON.parse(execution.responseBody);
      (err as { result?: unknown }).result = result;
      if (payload.action === 'friendship' && typeof result.error === 'string') err.message = result.error;
    } catch { /* Preserve the generic error for an invalid server response. */ }
    throw err;
  }
  try {
    return JSON.parse(execution.responseBody) as Record<string, unknown>;
  } catch {
    return {};
  }
}
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
  // Best-effort drain of the message action retry queue. Not awaited — the
  // caller only cares about delivery. The queue module enforces a single
  // in-flight flush so multiple triggers cannot stampede.
  flushMessageActionQueue(userId).catch((err) => {
    if (DEBUG) {
      console.error('[messageDelivery] queue flush failed:', err);
    }
  });
  if (inFlightDeliveryPromise) {
    deliveryRequestedDuringFlight = true;
    return inFlightDeliveryPromise;
  }
  if (getConnectivitySnapshot().status !== 'online') return;
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
      let loopCount = 0;
      for (;;) {
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
        if (DEBUG && pending.length > 0) {
          console.log(
            `[messageDelivery] ${pending.length} pending message(s)`
          );
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
        if (!deliveryRequestedDuringFlight) break;
      }
    } finally {
      inFlightDeliveryPromise = null;
      deliveryRequestedDuringFlight = false;
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
  try {
    await sendMessageAction({
      action: 'mark_read',
      partnerId,
      threadId,
    });
  } catch (err) {
    if (shouldQueueMessageAction(err)) {
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
  try {
    await sendMessageAction({
      action: 'unsend',
      messageId,
      recipientId,
    });
  } catch (err) {
    if (shouldQueueMessageAction(err)) {
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
