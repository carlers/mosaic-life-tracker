import { describe, it, expect } from 'vitest';
import { buildOutgoingMessage } from '../../src/lib/messageComposer';
import { messagesMigrationStrategies } from '../../src/db/migrations';
import { messagesSchema } from '../../src/db/schema';

describe('typed diary message references', () => {
  it('keeps the sender-authored body separate from an actual diary reference', () => {
    const message = buildOutgoingMessage({
      userId: 'person_a', friendId: 'person_b', threadId: 'thread_a',
      now: '2026-10-12T12:00:00.000Z', localId: 'msg_example',
      content: 'I liked this',
      diaryRefId: 'diary_example', diaryRefOwnerId: 'person_b',
      diaryRefDate: '2026-10-12', diaryRefExcerpt: 'Today was great',
    });
    expect(message.content).toBe('I liked this');
    expect(message.taskRefId).toBe('');
    expect(message.diaryRefId).toBe('diary_example');
    expect(message.diaryRefOwnerId).toBe('person_b');
    expect(message.diaryRefExcerpt).toBe('');
  });

  it('migrates historical messages without inventing diary context', () => {
    expect(messagesSchema.version).toBe(6);
    const old = { id: 'msg_legacy', content: 'unchanged' };
    expect(messagesMigrationStrategies[4](old)).toEqual({
      ...old, diaryRefId: '', diaryRefOwnerId: '', diaryRefDate: '', diaryRefExcerpt: '',
    });
    expect(messagesMigrationStrategies[5]({ ...old, diaryRefExcerpt: 'sensitive' })).toEqual({
      ...old, diaryRefEpoch: 0, diaryRefExcerpt: '', attachmentType: '', attachmentFileId: '',
    });
  });

  it('migrates pre-photo v5 messages to v6 without losing authored content or delivery state', () => {
    const old = { id: 'pre_photo_message', content: 'keep me', deliveryStatus: 'pending' };
    const upgraded = messagesMigrationStrategies[6](old);
    expect(upgraded).toEqual({ ...old, attachmentType: '', attachmentFileId: '' });
    expect(messagesSchema.properties.attachmentType).toBeDefined();
    expect(messagesSchema.properties.attachmentFileId).toBeDefined();
  });

  it('preserves queued chat photo references when upgrading v5 storage', () => {
    const old = {
      id: 'photo_message',
      content: '',
      deliveryStatus: 'pending',
      attachmentType: 'image',
      attachmentFileId: 'file_abc123',
    };
    expect(messagesMigrationStrategies[6](old)).toEqual(old);
  });
});
