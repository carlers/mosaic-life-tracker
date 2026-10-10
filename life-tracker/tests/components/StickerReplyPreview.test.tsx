import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MessageDocument } from '../../src/db/schema';
import { ReplyPreview } from '../../src/components/messages/ReplyPreview';
import { MessageBubble } from '../../src/components/messages/MessageBubble';
import { packStickerMessage } from '../../src/lib/stickerPacks';
import { giphyStickerMessage } from '../../src/lib/giphyStickers';

const provider = vi.hoisted(() => ({ getGiphySticker: vi.fn(), sendGiphyAnalytics: vi.fn() }));
vi.mock('../../src/lib/giphyStickers', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../src/lib/giphyStickers')>(),
  giphyEnabled: true,
  getGiphySticker: provider.getGiphySticker,
  sendGiphyAnalytics: provider.sendGiphyAnalytics,
}));

const media = {
  id: 'gAbC123', label: 'Friendly hug',
  previewUrl: 'https://media.giphy.com/100-still.gif',
  displayUrl: 'https://media.giphy.com/200-still.gif',
  animatedUrl: 'https://media.giphy.com/animated.webp',
  analytics: {},
};

function message(content: string): MessageDocument {
  return {
    id: 'msg_reply_sticker', userId: 'owner', threadId: 'thread',
    senderId: 'owner', recipientId: 'peer', direction: 'outgoing',
    content: 'Thanks!', taskRefId: '', taskRefTitle: '',
    taskRefDate: '', taskRefColor: '', replyToId: 'original',
    replyToSenderId: 'peer', replyToContent: content, isUnsent: false,
    originalMessageId: 'msg_reply_sticker', reactions: '', readAt: '',
    deliveryStatus: 'delivered', createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', isDeleted: false,
  };
}

describe('replying to actual sticker images', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', undefined);
    provider.getGiphySticker.mockReset().mockResolvedValue(media);
    provider.sendGiphyAnalytics.mockReset();
  });

  it('renders curated artwork in the composer and sent reply instead of its wire marker', () => {
    const content = packStickerMessage('critters', 'cat');
    const composer = render(<ReplyPreview senderName="Friend" content={content} />);
    const image = screen.getByRole('img', { name: 'Kitty' });
    expect(image.getAttribute('src')).toContain('/assets/svg/1f431.svg');
    expect(composer.container).not.toHaveTextContent('[mp1:');
    composer.unmount();

    const onQuoteTap = vi.fn();
    const bubble = render(<MessageBubble message={message(content)} isOutgoing
      currentUserId="owner" onQuoteTap={onQuoteTap} />);
    expect(screen.getByRole('img', { name: 'Kitty' })).toBeInTheDocument();
    expect(bubble.container).not.toHaveTextContent('[mp1:');
    fireEvent.click(screen.getByRole('button', { name: /Sticker: Kitty/i }));
    expect(onQuoteTap).toHaveBeenCalledWith('original');
  });

  it('shows a GIPHY still thumbnail inside composer and sent reply, with no nested playback buttons', async () => {
    const content = giphyStickerMessage({ id: 'gAbC123', label: 'Friendly hug' });
    const composer = render(<ReplyPreview senderName="Friend" content={content} />);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Friendly hug' }))
      .toHaveAttribute('src', media.previewUrl));
    expect(composer.container).not.toHaveTextContent('[gp1:');
    expect(composer.container).toHaveTextContent('GIPHY');
    expect(screen.queryByRole('button', { name: /animation:/ })).not.toBeInTheDocument();
    composer.unmount();

    const bubble = render(<MessageBubble message={message(content)} isOutgoing currentUserId="owner" />);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Friendly hug' }))
      .toHaveAttribute('src', media.previewUrl));
    expect(bubble.container).not.toHaveTextContent('[gp1:');
    expect(screen.queryByRole('button', { name: /Play animation/ })).not.toBeInTheDocument();
    expect(provider.getGiphySticker).toHaveBeenCalledTimes(2);
  });

  it('keeps a readable quote if GIPHY is unavailable and never loads hostile markers', async () => {
    provider.getGiphySticker.mockResolvedValueOnce(null);
    const content = giphyStickerMessage({ id: 'gAbC123', label: 'Friendly hug' });
    render(<ReplyPreview senderName="Friend" content={content} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Unavailable'));
    expect(screen.getByText('Sticker: Friendly hug')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Friendly hug' })).not.toBeInTheDocument();

    const invalid = '[Sticker: Fake]\\n[gp1:https://evil.test]';
    const untrusted = render(<ReplyPreview senderName="Friend" content={invalid} />);
    expect(untrusted.container).toHaveTextContent('https://evil.test');
    expect(provider.getGiphySticker).toHaveBeenCalledTimes(1);
  });

  it('gives deleted quotes priority over any sticker artwork', () => {
    render(<ReplyPreview senderName="Friend" content={packStickerMessage('critters', 'cat')} isDeleted />);
    expect(screen.getByText('Message deleted')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Kitty' })).not.toBeInTheDocument();
  });
});
