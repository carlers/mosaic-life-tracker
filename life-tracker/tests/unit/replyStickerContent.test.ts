import { describe, expect, it } from 'vitest';
import { buildOutgoingMessage } from '../../src/lib/messageComposer';
import { canonicalReplyStickerContent } from '../../src/lib/replyStickerContent';
import { giphyStickerMessage } from '../../src/lib/giphyStickers';
import { packStickerMessage } from '../../src/lib/stickerPacks';

function reply(content: string) {
  return buildOutgoingMessage({
    userId: 'owner', friendId: 'peer', threadId: 'th_test',
    now: '2026-10-10T00:00:00Z', localId: 'msg_reply',
    content: 'Thanks', replyTo: { id: 'msg_original', senderId: 'peer', content },
  });
}

describe('stored reply sticker snapshots', () => {
  it.each([
    ['curated', packStickerMessage('critters', 'cat')],
    ['GIPHY', giphyStickerMessage({ id: 'gAbC123', label: 'Friendly hug' })],
    ['long valid GIPHY ID', giphyStickerMessage({ id: 'A'.repeat(64), label: 'L'.repeat(40) })],
  ])('preserves the exact two-line %s token through outgoing message creation', (_, content) => {
    const result = reply(content);
    expect(result.replyToContent).toBe(content);
    expect(result.replyToContent).toContain(']\n[');
    expect(result.replyToId).toBe('msg_original');
    expect(result.replyToSenderId).toBe('peer');
    expect(result.replyToContent.length).toBeLessThanOrEqual(300);
  });

  it('keeps the established 100-character whitespace-normalized snapshot for ordinary text', () => {
    expect(reply('  hello\n  world   ').replyToContent).toBe('hello world');
    const longText = reply('x'.repeat(150)).replyToContent;
    expect(longText).toHaveLength(100);
    expect(longText.endsWith('…')).toBe(true);
  });

  it('restores only validated previously-flattened quote tokens, without relaxing message parsing', () => {
    const pack = packStickerMessage('critters', 'cat');
    const gif = giphyStickerMessage({ id: 'gAbC123', label: 'Friendly hug' });
    expect(canonicalReplyStickerContent(pack.replace('\n', ' '))).toBe(pack);
    expect(canonicalReplyStickerContent(gif.replace('\n', ' '))).toBe(gif);
    expect(canonicalReplyStickerContent(pack)).toBe(pack);
    expect(canonicalReplyStickerContent(gif)).toBe(gif);
    expect(canonicalReplyStickerContent('ordinary message')).toBeNull();
    expect(canonicalReplyStickerContent('[Sticker: Fake] [mp1:critters:cat:1]')).toBeNull();
    expect(canonicalReplyStickerContent('[Sticker: Bad] [gp1:https://evil.example]')).toBeNull();
    expect(canonicalReplyStickerContent('[Sticker: okay] [gp1:abc…]')).toBeNull();
    expect(canonicalReplyStickerContent('[Sticker: okay]  [gp1:abc]')).toBeNull();
  });
});
