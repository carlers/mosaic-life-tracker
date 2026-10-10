import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MessageDocument } from '../../src/db/schema';
import { MessageBubble } from '../../src/components/messages/MessageBubble';
import { ReplyPreview } from '../../src/components/messages/ReplyPreview';
import { giphyStickerMessage } from '../../src/lib/giphyStickers';

function message(content: string): MessageDocument {
  return {
    id: 'msg_giphy', userId: 'owner', threadId: 'thread', senderId: 'owner',
    recipientId: 'peer', direction: 'outgoing', content,
    taskRefId: '', taskRefTitle: '', taskRefDate: '', taskRefColor: '',
    replyToId: '', replyToContent: '', replyToSenderId: '', isUnsent: false,
    originalMessageId: 'msg_giphy', reactions: '', readAt: '',
    deliveryStatus: 'delivered', createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', isDeleted: false,
  };
}

describe('GIPHY message fallback without configured API key', () => {
  it('keeps readable title and status when provider is unavailable', () => {
    const content = giphyStickerMessage({ id: 'gAbC123', label: 'Happy Pusheen' });
    const { container } = render(<MessageBubble message={message(content)}
      isOutgoing currentUserId="owner" statusKind="delivered" />);
    expect(container).toHaveTextContent('GIPHY sticker unavailable: Happy Pusheen');
    expect(container).toHaveTextContent('Powered by GIPHY');
    expect(container).toHaveTextContent('Delivered');
    expect(container).not.toHaveTextContent('[gp1:');
  });

  it('preserves readable reply previews and rejects malicious IDs without loading images', () => {
    const content = giphyStickerMessage({ id: 'gAbC123', label: 'Friendly hug' });
    const preview = render(<ReplyPreview senderName="Friend" content={content} />);
    expect(preview.container).toHaveTextContent('Sticker: Friendly hug');
    expect(preview.container).not.toHaveTextContent('[gp1:');
    preview.unmount();

    const hostile = '[Sticker: Bad]\n[gp1:https://evil.example]';
    const bubble = render(<MessageBubble message={message(hostile)} isOutgoing currentUserId="owner" />);
    expect(bubble.container).toHaveTextContent('https://evil.example');
    expect(screen.queryByText('Powered by GIPHY')).toBeNull();
  });
});
