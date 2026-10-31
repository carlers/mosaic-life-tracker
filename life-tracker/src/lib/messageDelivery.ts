import type { RxDocument } from 'rxdb';
import { getDatabase } from '../db/database';
import { dispatchUnauthorized, isUnauthorizedError } from './authEvents';
import { clearDeniedOutgoing, isDeniedOutgoing, markDeniedOutgoing } from './messageSendDenials';
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
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 5_000;
let retryGeneration = -1;
function clearDeliveryRetry() {
  clearTimeout(retryTimer);
  retryTimer = undefined;
  retryDelay = 5_000;
}
function scheduleDeliveryRetry(userId: string, generation: number) {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    if (isAccountWorkCurrent(userId, generation))
      void deliverPendingMessages(userId);
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 60_000);
}
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
  return typeof code !== 'number' || code === 408 || code === 425 || code === 429 || code >= 500;
}
function isPermanentSendDenial(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'number' && [400, 403, 404, 409, 422].includes(code);
}
export async function deliverPendingMessages(userId: string): Promise<void> {
  if (!userId) return;
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null) return;
  if (retryGeneration !== generation) {
    clearDeliveryRetry();
    retryGeneration = generation;
  }

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
          console.warn('Chat send limit');
          break;
        }
        deliveryRequestedDuringFlight = false;
        let pending;
        try {
          pending = await getDatabase().messages.find({
            selector: {
              userId,
              direction: 'outgoing',
              deliveryStatus: 'pending',
              isDeleted: false,
            },
          }).exec();
        } catch (err) {
          console.error(err);
          break;
        }
        if (!isAccountWorkCurrent(userId, generation)) break;
        if (DEBUG && pending.length > 0) {
          console.log(
            `[messageDelivery] ${pending.length} pending message(s)`
          );
        }
        if (pending.length === 0) clearDeliveryRetry();
        for (const doc of pending) {
          if (!isAccountWorkCurrent(userId, generation)) break;
          // A confirmed 4xx denial is not a transient network error. Retain
          // the local message but require explicit review/retry.
          if (isDeniedOutgoing(userId, doc.id)) continue;
          try {
            await deliverOne(doc);
          } catch (err) {
            if (!isAccountWorkCurrent(userId, generation)) break;
            if (isPermanentSendDenial(err)) {
              markDeniedOutgoing(userId, doc.id);
            } else if (isUnauthorizedError(err)) {
              dispatchUnauthorized();
            } else if (shouldQueueMessageAction(err)) {
              scheduleDeliveryRetry(userId, generation);
            }
            // Appwrite response bodies may contain private message content.
            if (DEBUG) console.warn('[messageDelivery] send not confirmed',
              { code: (err as { code?: unknown } | null)?.code ?? 'unknown' });
            continue;
          }
          if (!isAccountWorkCurrent(userId, generation)) break;
          try {
            await doc.patch({ deliveryStatus: 'delivered' });
            clearDeniedOutgoing(userId, doc.id);
          } catch {
            // The server receipt exists, but local acknowledgement failed.
            // Keep the row pending and retry the same ID idempotently.
            scheduleDeliveryRetry(userId, generation);
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
export async function retryDeniedOutgoing(userId: string, messageId: string): Promise<void> {
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null || !isDeniedOutgoing(userId, messageId)) return;
  const doc = await getDatabase().messages.findOne(messageId).exec();
  if (!isAccountWorkCurrent(userId, generation) || !doc ||
      doc.userId !== userId || doc.direction !== 'outgoing' ||
      doc.deliveryStatus !== 'pending' || doc.isDeleted || doc.isUnsent) return;
  clearDeniedOutgoing(userId, messageId);
  await deliverPendingMessages(userId);
}

async function deliverOne(doc: RxDocument<MessageDocument>): Promise<void> {
  const result = await sendMessageAction({
    action: 'deliver',
    messageId: doc.id,
    recipientId: doc.recipientId,
    content: doc.content,
    taskRefId: doc.taskRefId,
    taskRefTitle: doc.taskRefTitle,
    taskRefDate: doc.taskRefDate,
    taskRefColor: doc.taskRefColor,
    diaryRefId: doc.diaryRefId || '',
    diaryRefOwnerId: doc.diaryRefOwnerId || '',
    diaryRefDate: doc.diaryRefDate || '',
    diaryRefExcerpt: '',
    diaryRefEpoch: doc.diaryRefEpoch ?? 0,
    replyToId: doc.replyToId || '',
    replyToContent: doc.replyToContent || '',
    replyToSenderId: doc.replyToSenderId || '',
    createdAt: doc.createdAt,
  });
  // A completed Function invocation is not proof both rows were committed.
  if (
    result.ok !== true ||
    !String(result.recipientRowId).startsWith('rmsg_') ||
    result.threadId !== doc.threadId ||
    (result.messageId != null && result.messageId !== doc.id)
  ) throw new Error('Delivery not confirmed');
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
    console.error('Chat read failed:', err);
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
    console.error('Chat unsend failed:', err);
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
