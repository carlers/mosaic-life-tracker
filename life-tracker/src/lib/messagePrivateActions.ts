import { getDatabase } from '../db/database';
import { clearDeniedOutgoing, isDeniedOutgoing } from './messageSendDenials';
import { captureAccountWorkGeneration, isAccountWorkCurrent } from './accountWorkScope';
import { enqueueMessageAction } from './messageActionQueue';
import { isUnauthorizedError } from './authEvents';

function shouldQueueMessageAction(err: unknown): boolean {
  if (isUnauthorizedError(err)) return false;
  const code = (err as { code?: number } | null)?.code;
  return typeof code !== 'number' || code === 408 || code === 425 || code === 429 || code >= 500;
}
import { deliverPendingMessages, sendMessageAction } from './messageDelivery';

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
): Promise<boolean> {
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null) return false;
  try {
    await sendMessageAction({
      action: 'unsend',
      messageId,
      recipientId,
    });
    return true;
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
    return false;
  }
}
