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

  let scope: 'self' | 'peer' | 'done' = 'self', cursor = '', repaired = 0;
  for (let page = 0; page < 30; page++) {
    if (!active()) throw new Error('Account changed');
    const result = await sendMessageAction({ action: 'repair_thread', partnerId, scope, cursor });
    if (!active()) throw new Error('Account changed');
    const next = result.nextScope, nextCursor = result.nextCursor;
    if (result.ok !== true || typeof nextCursor !== 'string' ||
        !['self', 'peer', 'done'].includes(next as string) ||
        (next === scope && nextCursor === cursor))
      throw new Error('Chat reconciliation incomplete');
    repaired += typeof result.repaired === 'number' ? result.repaired : 0;
    if (next === 'done') {
      await syncNow(userId);
      if (!active()) throw new Error('Account changed');
      return repaired;
    }
    scope = next as 'self' | 'peer';
    cursor = nextCursor;
  }
  throw new Error('Chat reconciliation page limit reached');
}
