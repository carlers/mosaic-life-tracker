import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MessageDocument } from '../../src/db/schema';
import { MessageActionSheet } from '../../src/components/messages/MessageActionSheet';

const message = {
  id: 'm_1', userId: 'owner', senderId: 'friend', recipientId: 'owner',
  content: 'Existing message', taskRefTitle: '', isUnsent: false, isDeleted: false,
  createdAt: '2026-11-02T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z',
} as MessageDocument;
const callbacks = { onClose: vi.fn(), onReply: vi.fn(), onCopy: vi.fn(),
  onUnsend: vi.fn(), onReact: vi.fn(), onMoreEmoji: vi.fn() };

describe('Chat optional Reply switch', () => {
  it('hides only reply initiation while retaining message copy', () => {
    const { rerender } = render(<MessageActionSheet isOpen message={message} isOwn={false}
      currentUserId="owner" {...callbacks} replyEnabled={false} />);
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    rerender(<MessageActionSheet isOpen message={message} isOwn={false}
      currentUserId="owner" {...callbacks} replyEnabled />);
    expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();
  });
});
