import { Functions, ExecutionMethod } from 'appwrite';
import type { RxDocument } from 'rxdb';
import { client } from './appwrite';
import { getDatabase } from '../db/database';
import { guardedCall } from './authEvents';
import type { MessageDocument } from '../db/schema';

const DEBUG = import.meta.env.DEV;
export const MESSAGE_ACTION_FUNCTION_ID = '6aa8057f002a4c306fdd';
const functions = new Functions(client);
const SEND_TIMEOUT_MS = 15_000;

let inFlightDeliveryPromise: Promise<void> | null = null;
let deliveryRequestedDuringFlight = false;

export async function sendMessageAction(
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Offline');
  }
  if (MESSAGE_ACTION_FUNCTION_ID.startsWith('REPLACE_')) {
    throw new Error('MESSAGE_ACTION_FUNCTION_ID not configured');
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const execution = await guardedCall(async () => {
    const execPromise = functions.createExecution({
      functionId: MESSAGE_ACTION_FUNCTION_ID,
      body: JSON.stringify(payload),
      async: false,
      xpath: '/',
      method: ExecutionMethod.POST,
    });
    // Prevent unhandled rejection noise if the timeout wins the race.
    execPromise.catch(() => {});

    const exec = await Promise.race([
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
    ]);

    if (
      exec.status !== 'completed' ||
      exec.responseStatusCode >= 400
    ) {
      // Convert a function-level 401 into a synthetic error with `code: 401`
      // so guardedCall recognizes it and dispatches the global event.
      const err = new Error(
        `Message action failed (${exec.responseStatusCode}): ${exec.responseBody}`
      );
      (err as { code?: number }).code = exec.responseStatusCode;
      throw err;
    }

    return exec;
  }).finally(() => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  });

  try {
    return JSON.parse(execution.responseBody) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function deliverPendingMessages(userId: string): Promise<void> {
  if (inFlightDeliveryPromise) {
    deliveryRequestedDuringFlight = true;
    return inFlightDeliveryPromise;
  }
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
      for (;;) {
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