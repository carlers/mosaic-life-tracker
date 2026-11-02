import {
  flushMessageActionQueue,
  setMessageActionSender,
} from './messageActionQueue';
import { APPWRITE_MESSAGE_ACTION_FUNCTION_ID } from './appwriteConfig';
import { sendAppAction } from './appAction';
import { isFeatureEnabled } from './featureControls';
export const MESSAGE_ACTION_FUNCTION_ID = APPWRITE_MESSAGE_ACTION_FUNCTION_ID;
export const sendMessageAction = sendAppAction;
setMessageActionSender(sendMessageAction);
export { flushMessageActionQueue };
export async function deliverPendingMessages(userId: string): Promise<void> {
  if (!isFeatureEnabled('mosaic_disable_all_social')) return;
  const { deliverPendingMessages: deliver } = await import('./messageDeliveryQueue');
  return deliver(userId, sendMessageAction);
}
export async function retryDeniedOutgoing(userId: string, messageId: string): Promise<void> {
  const { retryDeniedOutgoing: action } = await import('./messagePrivateActions');
  return action(userId, messageId);
}
export async function markReadOnRemote(userId: string, partnerId: string, threadId: string): Promise<void> {
  const { markReadOnRemote: action } = await import('./messagePrivateActions');
  return action(userId, partnerId, threadId);
}
export async function unsendOnRemote(userId: string, messageId: string, recipientId: string): Promise<boolean> {
  const { unsendOnRemote: action } = await import('./messagePrivateActions');
  return action(userId, messageId, recipientId);
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
