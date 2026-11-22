import { describe, expect, it } from 'vitest';
import { messagesSchema } from '../../src/db/schema';

describe('message schema property isolation', () => {
  it('preserves independent defaults and bounded string validators for task requests', () => {
    const props = messagesSchema.properties;
    expect(props.taskRequestId).toEqual({ type: 'string', maxLength: 36, default: '' });
    expect(props.taskRequestEvent).toEqual({
      type: 'string', enum: ['', 'created', 'accepted', 'declined', 'withdrawn'],
      maxLength: 20, default: '',
    });
    expect(props.taskRequestId).not.toBe(props.attachmentFileId);
    expect(props.createdAt).toEqual({ type: 'string', maxLength: 50 });
    expect(props.updatedAt).not.toBe(props.createdAt);
  });
});
