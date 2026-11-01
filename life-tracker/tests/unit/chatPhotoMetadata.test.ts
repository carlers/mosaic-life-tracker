import { describe, expect, it } from 'vitest';
import { buildOutgoingMessage } from '../../src/lib/messageComposer';
import { messagesMigrationStrategies } from '../../src/db/migrations';
import { messagesSchema } from '../../src/db/schema';
import { fromAppwriteFormat, toAppwriteFormat } from '../../src/lib/syncMapping';

const args = { localId: 'msg_1730000000000_testabc', userId: 'person_a', friendId: 'person_b',
  threadId: 'th_example', now: '2026-10-31T10:00:00Z' };

describe('typed chat photo metadata', () => {
  it('keeps attachment separate from caption through the sync mapping', () => {
    const message = buildOutgoingMessage({ ...args, content: 'Picture',
      attachmentType: 'image', attachmentFileId: 'chat_1730000000000_testabc' });
    const payload = toAppwriteFormat({ ...message }, 'messages', 'person_a');
    expect(payload.attachment_type).toBe('image');
    expect(payload.attachment_file_id).toBe(message.attachmentFileId);
    expect(fromAppwriteFormat({ ...payload, $id: args.localId }, 'messages')).toMatchObject({
      content: 'Picture', attachmentType: 'image', attachmentFileId: message.attachmentFileId,
    });
  });
  it('migrates old messages without inventing attachments', () => {
    expect(messagesSchema.version).toBe(5);
    expect(messagesMigrationStrategies[5]({ content: 'old' })).toEqual({
      content: 'old', diaryRefEpoch: 0, diaryRefExcerpt: '', attachmentType: '', attachmentFileId: '',
    });
  });
  it('does not emit attachment fields for text-only messages', () => {
    const message = buildOutgoingMessage({ ...args, content: 'text' });
    const payload = toAppwriteFormat({ ...message }, 'messages', 'person_a');
    expect(payload).not.toHaveProperty('attachment_type');
    expect(payload).not.toHaveProperty('attachment_file_id');
  });
});
