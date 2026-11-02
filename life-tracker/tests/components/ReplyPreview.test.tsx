import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReplyPreview } from '../../src/components/messages/ReplyPreview';

vi.mock('../../src/components/messages/ChatReplyPhotoThumbnail', () => ({
  ChatReplyPhotoThumbnail: ({ userId, fileId }: { userId: string; fileId: string }) =>
    <img alt="Quoted photo" data-owner={userId} data-file-id={fileId} />,
}));

describe('photo reply previews', () => {
  it('shows the existing photo thumbnail and caption in a composer reply', async () => {
    render(<ReplyPreview senderName="Friend" content={'[Photo]\nAt the beach'}
      photoFileId="chat_original" photoUserId="userA" variant="composer" />);
    const photo = await screen.findByRole('img', { name: 'Quoted photo' });
    expect(photo).toHaveAttribute('data-file-id', 'chat_original');
    expect(photo).toHaveAttribute('data-owner', 'userA');
    expect(screen.getByText('At the beach')).toBeInTheDocument();
    expect(screen.queryByText('[Photo]')).not.toBeInTheDocument();
  });

  it('shows the thumbnail for a quote inside a sent message, without uploading', async () => {
    render(<ReplyPreview senderName="You" content="[Photo]"
      photoFileId="chat_original" photoUserId="userB" variant="bubble" />);
    expect(await screen.findByRole('img', { name: 'Quoted photo' })).toBeInTheDocument();
    expect(screen.getByText('Photo')).toBeInTheDocument();
  });

  it('never shows a thumbnail for a deleted source or text-only reply', () => {
    const { rerender } = render(<ReplyPreview senderName="Friend" content="hello" />);
    expect(screen.queryByRole('img', { name: 'Quoted photo' })).not.toBeInTheDocument();
    rerender(<ReplyPreview senderName="Friend" content="[Photo]"
      photoFileId="chat_original" photoUserId="userB" isDeleted />);
    expect(screen.queryByRole('img', { name: 'Quoted photo' })).not.toBeInTheDocument();
    expect(screen.getByText('Message deleted')).toBeInTheDocument();
  });
});
