import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ChatReplyPhotoThumbnail } from '../../src/components/messages/ChatReplyPhotoThumbnail';
import { getChatPhotoUrl } from '../../src/lib/chatPhotoStorage';

vi.mock('../../src/lib/chatPhotoStorage', () => ({
  getChatPhotoUrl: vi.fn(),
}));

describe('chat photo reply thumbnail lifecycle', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('fetches under the current owner and releases the local object URL on change/unmount', async () => {
    const revoke = vi.fn();
    Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, writable: true, configurable: true });
    vi.mocked(getChatPhotoUrl).mockImplementation(async (_userId, fileId) => 'blob:' + fileId);
    const { rerender, unmount } = render(<ChatReplyPhotoThumbnail userId="owner-A" fileId="chat_a" />);
    expect(await screen.findByRole('img', { name: 'Quoted photo' })).toHaveAttribute('src', 'blob:chat_a');
    expect(getChatPhotoUrl).toHaveBeenCalledWith('owner-A', 'chat_a');
    rerender(<ChatReplyPhotoThumbnail userId="owner-B" fileId="chat_b" />);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Quoted photo' })).toHaveAttribute('src', 'blob:chat_b'));
    expect(getChatPhotoUrl).toHaveBeenCalledWith('owner-B', 'chat_b');
    expect(revoke).toHaveBeenCalledWith('blob:chat_a');
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:chat_b');
  });

  it('renders unavailable state for missing photos without leaking a broken image', async () => {
    vi.mocked(getChatPhotoUrl).mockResolvedValueOnce(null);
    render(<ChatReplyPhotoThumbnail userId="owner-A" fileId="chat_missing" />);
    await waitFor(() => expect(getChatPhotoUrl).toHaveBeenCalledWith('owner-A', 'chat_missing'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Quoted photo unavailable')).toBeInTheDocument();
  });
});
