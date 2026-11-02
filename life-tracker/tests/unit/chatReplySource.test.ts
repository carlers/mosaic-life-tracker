import { describe, expect, it } from 'vitest';
import { indexChatReplySources, replyPhotoFileId } from '../../src/lib/chatReplySource';

describe('photo replies use the authorized original message', () => {
  it('resolves recipient and sender row IDs across devices without duplicating media', () => {
    const recipientCopy = { id: 'rmsg_recipient', originalMessageId: 'msg_sender' };
    const sources = indexChatReplySources([recipientCopy]);
    expect(sources.get('rmsg_recipient')).toBe(recipientCopy);
    expect(sources.get('msg_sender')).toBe(recipientCopy);
  });

  it('shows photos only for live, typed image messages', () => {
    const photo = { attachmentType: 'image' as const, attachmentFileId: 'chat_original',
      isDeleted: false, isUnsent: false };
    expect(replyPhotoFileId(photo)).toBe('chat_original');
    expect(replyPhotoFileId({ ...photo, isUnsent: true })).toBeUndefined();
    expect(replyPhotoFileId({ ...photo, isDeleted: true })).toBeUndefined();
    expect(replyPhotoFileId({ ...photo, attachmentType: '' })).toBeUndefined();
    expect(replyPhotoFileId(undefined)).toBeUndefined();
  });
});
