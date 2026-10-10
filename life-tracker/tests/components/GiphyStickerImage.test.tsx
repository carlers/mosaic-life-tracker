import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GiphyStickerImage } from '../../src/components/messages/GiphyStickerImage';

const provider = vi.hoisted(() => ({
  getGiphySticker: vi.fn(),
  sendGiphyAnalytics: vi.fn(),
}));

vi.mock('../../src/lib/giphyStickers', () => ({
  giphyEnabled: true,
  getGiphySticker: provider.getGiphySticker,
  sendGiphyAnalytics: provider.sendGiphyAnalytics,
}));

const media = {
  id: 'valid_id',
  label: 'Cat hello',
  previewUrl: 'https://media.giphy.com/preview_still.gif',
  displayUrl: 'https://media.giphy.com/chat_still.gif',
  animatedUrl: 'https://media.giphy.com/chat.webp',
  analytics: {},
  creator: 'artist',
  pageUrl: 'https://giphy.com/stickers/valid_id',
};

describe('static-first GIPHY sticker playback', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', undefined);
    provider.getGiphySticker.mockReset().mockResolvedValue(media);
    provider.sendGiphyAnalytics.mockReset();
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('loads the still by default; plays and pauses on tap, without a second metadata request', async () => {
    render(<GiphyStickerImage id="valid_id" label="Cat hello" />);
    const play = await screen.findByRole('button', { name: 'Play animation: Cat hello' });
    expect(screen.getByRole('img', { name: 'Cat hello' })).toHaveAttribute('src', media.displayUrl);
    fireEvent.click(play);
    expect(screen.getByRole('img', { name: 'Cat hello' })).toHaveAttribute('src', media.animatedUrl);
    expect(screen.getByRole('button', { name: 'Pause animation: Cat hello' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Pause animation: Cat hello' }));
    expect(screen.getByRole('img', { name: 'Cat hello' })).toHaveAttribute('src', media.displayUrl);
    expect(provider.getGiphySticker).toHaveBeenCalledTimes(1);
  });

  it('autoplays only when allowed, but respects Reduce Motion and explicit user play', async () => {
    const view = render(<GiphyStickerImage id="valid_id" label="Cat hello" autoplay reducedMotion />);
    await screen.findByRole('button', { name: 'Play animation: Cat hello' });
    expect(screen.getByRole('img', { name: 'Cat hello' })).toHaveAttribute('src', media.displayUrl);
    fireEvent.click(screen.getByRole('button', { name: 'Play animation: Cat hello' }));
    expect(screen.getByRole('img', { name: 'Cat hello' })).toHaveAttribute('src', media.animatedUrl);
    view.rerender(<GiphyStickerImage id="valid_id" label="Cat hello" autoplay reducedMotion={false} />);
    expect(screen.getByRole('img', { name: 'Cat hello' })).toHaveAttribute('src', media.animatedUrl);
    expect(provider.getGiphySticker).toHaveBeenCalledTimes(1);
    view.unmount();

    render(<GiphyStickerImage id="valid_id" label="Cat hello" autoplay />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause animation: Cat hello' })).toBeInTheDocument());
    expect(screen.getByRole('img', { name: 'Cat hello' })).toHaveAttribute('src', media.animatedUrl);
  });

  it('shows readable fallback if the provider withdraws an image', async () => {
    provider.getGiphySticker.mockResolvedValueOnce(null);
    render(<GiphyStickerImage id="missing" label="Missing cat" />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('GIPHY sticker unavailable: Missing cat'));
    expect(screen.queryByRole('img')).toBeNull();
  });
});
