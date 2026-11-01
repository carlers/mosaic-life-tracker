import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageDocument } from '../../src/db/schema';

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => isOpen ? <div>{children}</div> : null,
}));
import { MessageActionSheet } from '../../src/components/messages/MessageActionSheet';
import { ReactionRow } from '../../src/components/messages/ReactionRow';
import { MessageComposer } from '../../src/components/messages/MessageComposer';

const message = {
  id: 'msg_control', content: 'Original text', taskRefTitle: '', isUnsent: false,
  senderId: 'owner', userId: 'owner', recipientId: 'peer', reactions: '',
} as MessageDocument;

beforeEach(() => vi.clearAllMocks());

describe('non-destructive chat controls', () => {
  it('hides new reactions in the action sheet without suppressing reply or unsend', () => {
    const onReact = vi.fn();
    const { rerender } = render(<MessageActionSheet isOpen message={message} isOwn currentUserId="owner"
      onClose={vi.fn()} onReply={vi.fn()} onCopy={vi.fn()} onUnsend={vi.fn()}
      onReact={onReact} onMoreEmoji={vi.fn()} reactionsEnabled={false} />);
    expect(screen.queryByRole('button', { name: 'React 👍' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More reactions' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reply' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Unsend' })).toBeEnabled();
    rerender(<MessageActionSheet isOpen message={message} isOwn currentUserId="owner"
      onClose={vi.fn()} onReply={vi.fn()} onCopy={vi.fn()} onUnsend={vi.fn()}
      onReact={onReact} onMoreEmoji={vi.fn()} reactionsEnabled />);
    fireEvent.click(screen.getByRole('button', { name: 'React 👍' }));
    expect(onReact).toHaveBeenCalledExactlyOnceWith('👍');
  });

  it('keeps historical reaction badges readable but not actionable while paused', () => {
    const onToggle = vi.fn();
    const props = { reactions: [{ emoji: '❤️', userIds: ['owner'] }], currentUserId: 'owner', isOutgoing: true };
    const { rerender } = render(<ReactionRow {...props} />);
    expect(screen.getByRole('button', { name: 'Reaction ❤️: 1' })).toBeDisabled();
    expect(screen.getByText('❤️')).toBeVisible();
    rerender(<ReactionRow {...props} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'React with ❤️' }));
    expect(onToggle).toHaveBeenCalledExactlyOnceWith('❤️');
  });

  it('keeps text composition while hiding paused photo and sticker initiators', () => {
    const onSend = vi.fn();
    const { rerender } = render(<MessageComposer onSend={onSend} />);
    expect(screen.queryByRole('button', { name: 'Attach photo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open stickers' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeVisible();
    rerender(<MessageComposer onSend={onSend} onSendPhoto={vi.fn()} onOpenStickers={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Attach photo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Open stickers' })).toBeEnabled();
  });

  it('hides optional message copying without changing reply, unsend or historical text', () => {
    const onCopy = vi.fn();
    const props = { isOpen: true, message, isOwn: true, currentUserId: 'owner',
      onClose: vi.fn(), onReply: vi.fn(), onCopy, onUnsend: vi.fn(),
      onReact: vi.fn(), onMoreEmoji: vi.fn() };
    const { rerender } = render(<MessageActionSheet {...props} copyEnabled={false} />);
    expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reply' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Unsend' })).toBeEnabled();
    rerender(<MessageActionSheet {...props} copyEnabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

});
