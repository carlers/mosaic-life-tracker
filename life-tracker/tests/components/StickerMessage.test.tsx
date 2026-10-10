import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../../src/components/messages/MessageBubble';
import { ReplyPreview } from '../../src/components/messages/ReplyPreview';
import { packStickerMessage } from '../../src/lib/stickerPacks';
import type { MessageDocument } from '../../src/db/schema';

function message(content: string): MessageDocument {
  return {
    id: 'msg_pack', userId: 'owner', threadId: 'thread', senderId: 'owner',
    recipientId: 'peer', direction: 'outgoing', content,
    taskRefId: '', taskRefTitle: '', taskRefDate: '', taskRefColor: '',
    replyToId: '', replyToContent: '', replyToSenderId: '', isUnsent: false,
    originalMessageId: 'msg_pack', reactions: '', readAt: '',
    deliveryStatus: 'delivered', createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', isDeleted: false,
  };
}

describe('sticker message display', () => {
  it('renders a transparent sticker asset with normal delivery status', () => {
    const content = packStickerMessage('reactions', 'love');
    const { container } = render(
      <MessageBubble message={message(content)} isOutgoing currentUserId="owner" statusKind="delivered" />
    );
    const image = screen.getByRole('img', { name: 'Sending love' });
    expect(image).toHaveAttribute('src',
      'https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.2/assets/svg/1f970.svg');
    expect(container).toHaveTextContent('Delivered');
    expect(container).not.toHaveTextContent('[mp1:');
  });

  it('shows literal old-client fallback when the sticker is not allowlisted', () => {
    const content = '[Sticker: Mystery]\n[mp1:unknown:asset:1]';
    const { container } = render(
      <MessageBubble message={message(content)} isOutgoing currentUserId="owner" />
    );
    expect(container).toHaveTextContent('Sticker: Mystery');
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders a readable reply preview rather than internal transport markers', () => {
    const content = packStickerMessage('vibes', 'party');
    const { container } = render(<ReplyPreview senderName="Friend" content={content} />);
    expect(container).toHaveTextContent('Sticker: Celebrate');
    expect(container).not.toHaveTextContent('[mp1:');
  });
});
