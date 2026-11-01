import type { MessageDocument } from '../db/schema';

type QuoteIdentity = Pick<MessageDocument, 'id' | 'originalMessageId'>;
type QuotePhoto = Pick<MessageDocument,
  'attachmentType' | 'attachmentFileId' | 'isUnsent' | 'isDeleted'>;

// Sender and recipient hold different row IDs for the same message. Index
// canonical sender IDs as well so photo quotes work on both devices.
export function indexChatReplySources<T extends QuoteIdentity>(messages: readonly T[]): Map<string, T> {
  const lookup = new Map<string, T>();
  for (const message of messages) {
    lookup.set(message.id, message);
    if (message.originalMessageId) lookup.set(message.originalMessageId, message);
  }
  return lookup;
}

export function replyPhotoFileId(source: QuotePhoto | null | undefined): string | undefined {
  return source && !source.isUnsent && !source.isDeleted && source.attachmentType === 'image'
    ? source.attachmentFileId || undefined
    : undefined;
}
