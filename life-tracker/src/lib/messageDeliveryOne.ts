import type { RxDocument } from 'rxdb';
import type { MessageDocument } from '../db/schema';
import type { sendAppAction } from './appAction';

// Load only when a pending message is present, retaining Home's size budget.
export async function deliverOne(doc: RxDocument<MessageDocument>, sendMessageAction: typeof sendAppAction): Promise<void> {
  const execute = async (): Promise<void> => {
  if (doc.attachmentType === 'image') {
    const { prepareChatPhoto } = await import('./chatPhotoDelivery');
    await prepareChatPhoto(doc.userId, doc.id, doc.attachmentFileId || '');
  }
  const result = await sendMessageAction({
    action: 'deliver',
    messageId: doc.id,
    recipientId: doc.recipientId,
    content: doc.content,
    attachmentType: doc.attachmentType || '',
    attachmentFileId: doc.attachmentFileId || '',
    taskRefId: doc.taskRefId,
    taskRefTitle: doc.taskRefTitle,
    taskRefDate: doc.taskRefDate,
    taskRefColor: doc.taskRefColor,
    diaryRefId: doc.diaryRefId || '',
    diaryRefOwnerId: doc.diaryRefOwnerId || '',
    diaryRefDate: doc.diaryRefDate || '',
    diaryRefExcerpt: '',
    diaryRefEpoch: doc.diaryRefEpoch ?? 0,
    replyToId: doc.replyToId || '',
    replyToContent: doc.replyToContent || '',
    replyToSenderId: doc.replyToSenderId || '',
    createdAt: doc.createdAt,
  });
  // A completed Function invocation is not proof both rows were committed.
  if (
    result.ok !== true ||
    !String(result.recipientRowId).startsWith('rmsg_') ||
    result.threadId !== doc.threadId ||
    (result.messageId != null && result.messageId !== doc.id)
  ) throw new Error('Delivery not confirmed');
  if (doc.attachmentType === 'image' && doc.attachmentFileId) {
    const { completeChatPhoto } = await import('./chatPhotoDelivery');
    await completeChatPhoto(doc.userId, doc.attachmentFileId);
  }
  };
  if (doc.attachmentType === 'image') {
    const { withChatPhotoSendLock } = await import('./chatPhotoDelivery');
    return withChatPhotoSendLock(doc.userId, doc.id, execute);
  }
  return execute();
}
