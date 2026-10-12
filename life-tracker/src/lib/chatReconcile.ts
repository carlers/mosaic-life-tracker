import { captureAccountWorkGeneration, isAccountWorkCurrent } from './accountWorkScope';
import { getConnectivitySnapshot } from './connectivity';
import { getDatabase } from '../db/database';
import { deliverPendingMessages, sendMessageAction } from './messageDelivery';
import { syncNow } from '../db/sync';

export async function reconcileChat(userId: string, partnerId: string) {
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null || getConnectivitySnapshot().status !== 'online')
    throw new Error('Chat sync unavailable');
  const active = () => isAccountWorkCurrent(userId, generation);
  await deliverPendingMessages(userId);
  if (!active()) throw new Error('Account changed');
  if ((await getDatabase().messages.find({ selector: {
    userId, recipientId: partnerId, direction: 'outgoing',
    deliveryStatus: 'pending', isDeleted: false,
  } }).exec()).length) throw new Error('Messages still waiting to send');
  const result = await sendMessageAction({ action: 'repair_thread_all', partnerId }, 90_000);
  if (!active()) throw new Error('Account changed');
  if (result.ok !== true || typeof result.repaired !== 'number')
    throw new Error('Chat reconciliation incomplete');
  await syncNow(userId);
  if (!active()) throw new Error('Account changed');
  return result.repaired;
}
