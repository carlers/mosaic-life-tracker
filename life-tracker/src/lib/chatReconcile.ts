import { captureAccountWorkGeneration, isAccountWorkCurrent } from './accountWorkScope';
import { getConnectivitySnapshot } from './connectivity';
import { getDatabase } from '../db/database';
import { deliverPendingMessages, sendMessageAction } from './messageDelivery';
import { isDeniedOutgoing } from './messageSendDenials';
import {
  refreshMessageReplicationPilot,
} from '../db/messageReplicationPilot';

export type ChatSyncStage = 'sending' | 'repairing' | 'receiving' | 'complete';
export interface ChatSyncProgress {
  stage: ChatSyncStage;
  repaired?: number;
}

export async function reconcileChat(
  userId: string,
  partnerId: string,
  onProgress?: (progress: ChatSyncProgress) => void
) {
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null || getConnectivitySnapshot().status !== 'online')
    throw new Error('Chat sync unavailable');
  const active = () => isAccountWorkCurrent(userId, generation);
  onProgress?.({ stage: 'sending' });
  await deliverPendingMessages(userId);
  if (!active()) throw new Error('Account changed');
  const pending = await getDatabase().messages.find({ selector: {
    userId, recipientId: partnerId, direction: 'outgoing',
    deliveryStatus: 'pending', isDeleted: false,
  } }).exec();
  // Permanently denied messages remain pending locally for explicit Retry or
  // Discard. They are not in flight and must not block repairing other rows.
  if (pending.some(doc => !isDeniedOutgoing(userId, doc.id)))
    throw new Error('Messages still waiting to send');
  onProgress?.({ stage: 'repairing' });
  const result = await sendMessageAction({ action: 'repair_thread_all', partnerId }, 90_000);
  if (!active()) throw new Error('Account changed');
  if (result.ok !== true || typeof result.repaired !== 'number')
    throw new Error('Chat reconciliation incomplete');
  // Chat's proof is message-scoped: an unrelated Diary/Categories error
  // must not misreport a successful authorized message repair as a failure.
  onProgress?.({ stage: 'receiving', repaired: result.repaired });
  const fresh = await refreshMessageReplicationPilot(userId, 60_000);
  if (!active()) throw new Error('Account changed');
  if (!fresh) throw new Error('Message sync is not ready. Reopen chat and retry.');
  onProgress?.({ stage: 'complete', repaired: result.repaired });
  return result.repaired;
}
