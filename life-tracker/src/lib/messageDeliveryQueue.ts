import { APPWRITE_MESSAGE_ACTION_FUNCTION_ID as MESSAGE_ACTION_FUNCTION_ID } from './appwriteConfig';
import { getDatabase } from '../db/database';
import { dispatchUnauthorized, isUnauthorizedError } from './authEvents';
import { clearDeniedOutgoing, isDeniedOutgoing, markDeniedOutgoing } from './messageSendDenials';
import { flushMessageActionQueue } from './messageActionQueue';
import { getConnectivitySnapshot } from './connectivity';
import { captureAccountWorkGeneration, isAccountWorkCurrent } from './accountWorkScope';
import type { sendAppAction } from './appAction';
const DEBUG = import.meta.env.DEV;
const MAX_DELIVERY_LOOPS = 5;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 5_000;
let retryGeneration = -1;
function clearDeliveryRetry() {
  clearTimeout(retryTimer);
  retryTimer = undefined;
  retryDelay = 5_000;
}
function scheduleDeliveryRetry(userId: string, generation: number, sendMessageAction: typeof sendAppAction) {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    if (isAccountWorkCurrent(userId, generation))
      void deliverPendingMessages(userId, sendMessageAction);
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 60_000);
}
let inFlightDeliveryPromise: Promise<void> | null = null;
let inFlightDeliveryUserId: string | null = null;
let inFlightDeliveryGeneration: number | null = null;
let deliveryRequestedDuringFlight = false;
function shouldQueueMessageAction(err: unknown): boolean {
  if (isUnauthorizedError(err)) return false;
  const code = (err as { code?: number } | null)?.code;
  return typeof code !== 'number' || code === 408 || code === 425 || code === 429 || code >= 500;
}
function isPermanentSendDenial(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'number' && [400, 403, 404, 409, 422].includes(code);
}
export async function deliverPendingMessages(userId: string, sendMessageAction: typeof sendAppAction): Promise<void> {
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
    return deliverPendingMessages(userId, sendMessageAction);
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
            const { deliverOne } = await import('./messageDeliveryOne');
            await deliverOne(doc, sendMessageAction);
          } catch (err) {
            if (!isAccountWorkCurrent(userId, generation)) break;
            if (isPermanentSendDenial(err)) {
              markDeniedOutgoing(userId, doc.id);
            } else if (isUnauthorizedError(err)) {
              dispatchUnauthorized();
            } else if (shouldQueueMessageAction(err)) {
              scheduleDeliveryRetry(userId, generation, sendMessageAction);
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
            scheduleDeliveryRetry(userId, generation, sendMessageAction);
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
