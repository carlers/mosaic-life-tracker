import type { MessageDocument } from '../db/schema';
import { sendAppAction } from './appAction';
import { parseStickerMessage } from './stickerProtocol';
import { allowStickerRecipient } from './stickerStorage';

/** Media authorization and network payload stay off the initial Home graph.
 * Plain messages reuse the same transport; stickers are shared only to the
 * intended recipient, using an existing owner-owned file, before delivery. */
export async function deliverMessageWithMedia(doc: MessageDocument): Promise<void> {
  const sticker = parseStickerMessage(doc.content);
  if (sticker) {
    await allowStickerRecipient(doc.userId, doc.recipientId, sticker.fileId);
  }
  await sendAppAction({
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
