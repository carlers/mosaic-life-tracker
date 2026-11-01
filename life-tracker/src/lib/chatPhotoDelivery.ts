import { getDatabase } from '../db/database';
import { uploadPendingChatPhoto, removeStagedChatPhoto } from './chatPhotoStorage';
import { withChatPhotoSendLock } from './chatPhotoLock';

export async function prepareChatPhoto(userId: string, messageId: string, fileId: string): Promise<void> {
  await uploadPendingChatPhoto(userId, messageId, fileId);
  const current = await getDatabase().messages.findOne(messageId).exec();
  if (!current || current.isUnsent || current.isDeleted)
    throw Object.assign(new Error('Photo send canceled'), { code: 409 });
}
export async function completeChatPhoto(userId: string, fileId: string): Promise<void> {
  await removeStagedChatPhoto(userId, fileId).catch(() => {});
}
export { withChatPhotoSendLock };
