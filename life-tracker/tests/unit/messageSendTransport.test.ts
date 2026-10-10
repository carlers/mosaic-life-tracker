import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deliverMessageWithMedia } from '../../src/lib/messageSendTransport';
import type { MessageDocument } from '../../src/db/schema';

const mocks = vi.hoisted(() => ({ send: vi.fn(), allow: vi.fn() }));
vi.mock('../../src/lib/appAction', () => ({ sendAppAction: mocks.send }));
vi.mock('../../src/lib/stickerStorage', () => ({ allowStickerRecipient: mocks.allow }));

const stickerId = 'stk_' + 'a'.repeat(32);
const original: MessageDocument = {
  id: 'msg_123', userId: 'me', threadId: 'th_123',
  senderId: 'me', recipientId: 'you', direction: 'outgoing',
  content: 'hello', taskRefId: '', taskRefTitle: '', taskRefDate: '',
  taskRefColor: '', replyToId: '', replyToContent: '', replyToSenderId: '',
  isUnsent: false, originalMessageId: 'msg_123', reactions: '', readAt: '',
  deliveryStatus: 'pending', createdAt: '2026-10-10T00:00:00Z',
  updatedAt: '2026-10-10T00:00:00Z', isDeleted: false,
};

describe('deferred message transport', () => {
  beforeEach(() => { mocks.send.mockReset().mockResolvedValue({ ok: true }); mocks.allow.mockReset().mockResolvedValue(undefined); });

  it('keeps ordinary text delivery unchanged without requiring media permission', async () => {
    await deliverMessageWithMedia(original);
    expect(mocks.allow).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      action: 'deliver', messageId: original.id, content: 'hello', recipientId: 'you',
    }));
  });

  it('shares exactly one owned sticker with the intended recipient before text delivery', async () => {
    const content = '[Sticker: Cat]\n[ms1:' + stickerId + ']';
    await deliverMessageWithMedia({ ...original, content });
    expect(mocks.allow).toHaveBeenCalledExactlyOnceWith('me', 'you', stickerId);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ content, recipientId: 'you' }));
    expect(mocks.allow.mock.invocationCallOrder[0]).toBeLessThan(mocks.send.mock.invocationCallOrder[0]);
  });

  it('fails closed when recipient access could not be established', async () => {
    mocks.allow.mockRejectedValueOnce(new Error('access denied'));
    const content = '[Sticker: Cat]\n[ms1:' + stickerId + ']';
    await expect(deliverMessageWithMedia({ ...original, content })).rejects.toThrow('access denied');
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
