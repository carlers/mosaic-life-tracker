import { getDatabase } from '../db/database';
import { isFeatureEnabled } from './featureControls';
import { makeThreadId } from './threads';
import { deliverPendingMessages } from './messageDelivery';
import { buildOutgoingMessage, type ReplyContext } from './messageComposer';

function makeLocalMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Photo-only sends include a text fallback for still-installed older PWAs.
// The pending blob is durable before the outgoing RxDB row is inserted.
export async function sendPhotoMessage(
  userId: string,
  friendId: string,
  file: File,
  caption = '',
  replyTo?: ReplyContext
): Promise<void> {
  if (!userId || !friendId) throw new Error('Photo chat requires an account and recipient.');
  if (!isFeatureEnabled('mosaic_disable_chat_photo_upload')) throw new Error('New chat photos are temporarily unavailable.');
  if (caption.trim().length > 3992) throw new Error('Photo caption exceeds the message limit.');
  const threadId = await makeThreadId(userId, friendId);
  const now = new Date().toISOString();
  const localId = makeLocalMessageId();
  const { stageChatPhoto, chatPhotoFileId } = await import('./chatPhotoStorage');
  const attachmentFileId = chatPhotoFileId(localId);
  await stageChatPhoto(userId, attachmentFileId, file);
  try {
    await getDatabase().messages.insert(buildOutgoingMessage({
      userId, friendId, threadId, now, localId,
      content: caption.trim() ? '[Photo]\n' + caption.trim() : '[Photo]',
      attachmentType: 'image', attachmentFileId, replyTo,
    }));
  } catch (error) {
    // Keep staged bytes for recovery only if the message may have been inserted.
    const existing = await getDatabase().messages.findOne(localId).exec().catch(() => null);
    if (!existing) {
      const { discardChatPhoto } = await import('./chatPhotoStorage');
      await discardChatPhoto(userId, attachmentFileId).catch(() => {});
    }
    throw error;
  }
  void deliverPendingMessages(userId).catch(() => {});
}
