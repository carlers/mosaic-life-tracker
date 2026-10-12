import { captureAccountWorkGeneration, isAccountWorkCurrent } from './accountWorkScope';
import { getConnectivitySnapshot } from './connectivity';
import { getDatabase } from '../db/database';
import { deliverPendingMessages, sendMessageAction } from './messageDelivery';
import { syncNow } from '../db/sync';

// Manual anti-entropy only; no background cross-user history scanner.
export async function reconcileChat(userId: string, partnerId: string) {
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null || getConnectivitySnapshot().status !== 'online')
    throw new Error('Chat sync unavailable');
  const current = () => isAccountWorkCurrent(userId, generation);
  await deliverPendingMessages(userId);
  if (!current()) throw new Error('Account changed');
  const pending = await getDatabase().messages.find({
    selector: { userId, recipientId: partnerId, direction: 'outgoing',
      deliveryStatus: 'pending', isDeleted: false },
  }).exec();
  if (pending.length) throw new Error('Messages still waiting to send');

  let scope: 'self' | 'peer' | 'done' = 'self';
  let cursor = '';
  let repaired = 0;
  for (let page = 0; page < 30; page++) {
    if (!current()) throw new Error('Account changed');
    const result = await sendMessageAction({
      action: 'repair_thread', partnerId, scope, cursor,
    });
    if (!current()) throw new Error('Account changed');
    const next = result.nextScope;
    const nextCursor = result.nextCursor;
    if (result.ok !== true || typeof nextCursor !== 'string' ||
        (next !== 'self' && next !== 'peer' && next !== 'done') ||
        (scope === next && nextCursor === cursor))
      throw new Error('Chat reconciliation incomplete');
    repaired += typeof result.repaired === 'number' ? result.repaired : 0;
    if (next === 'done') {
      await syncNow(userId);
      if (!current()) throw new Error('Account changed');
      return repaired;
    }
    scope = next;
    cursor = nextCursor;
  }
  throw new Error('Chat reconciliation page limit reached');
}
