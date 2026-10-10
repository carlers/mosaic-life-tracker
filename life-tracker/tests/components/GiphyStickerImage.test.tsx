import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GiphyStickerImage } from '../../src/components/messages/GiphyStickerImage';
import { useBubbleGestures } from '../../src/hooks/useBubbleGestures';

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

/** Match the real message bubble's pointer capture, rather than clicking a sticker in isolation. */
function GestureHost({ onReply }: { onReply: () => void }) {
  const { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } =
    useBubbleGestures({ onSwipeReply: onReply });
  return (
    <div data-testid="chat-bubble" role="button" tabIndex={0}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      <GiphyStickerImage id="valid_id" label="Cat hello" />
    </div>
  );
}

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

  it('lets touch and keyboard playback controls escape the bubble pointer capture, preserving swipe-to-reply on the artwork', async () => {
    const onReply = vi.fn();
    const { getByTestId } = render(<GestureHost onReply={onReply} />);
    const bubble = getByTestId('chat-bubble');
    const capture = vi.fn();
    Object.defineProperty(bubble, 'setPointerCapture', { configurable: true, value: capture });
    const play = await screen.findByRole('button', { name: 'Play animation: Cat hello' });
    const start = { pointerId: 5, pointerType: 'touch', button: 0, clientX: 100, clientY: 100 };

    // Before this fix the image *was* the button: pointerdown bubbled to
    // useBubbleGestures, which captured touch events and swallowed mobile clicks.
    fireEvent.pointerDown(play, start);
    fireEvent.pointerUp(play, start);
    expect(capture).not.toHaveBeenCalled();
    fireEvent.click(play);
    expect(screen.getByRole('img', { name: 'Cat hello' })).toHaveAttribute('src', media.animatedUrl);
    const pause = screen.getByRole('button', { name: 'Pause animation: Cat hello' });
    fireEvent.keyDown(pause, { key: 'Enter' });
    fireEvent.click(pause);
    expect(screen.getByRole('img', { name: 'Cat hello' })).toHaveAttribute('src', media.displayUrl);
    expect(capture).not.toHaveBeenCalled();

    // The image still belongs to the bubble for directional reply gestures.
    const art = screen.getByRole('img', { name: 'Cat hello' });
    fireEvent.pointerDown(art, { ...start, pointerId: 6 });
    expect(capture).toHaveBeenCalledWith(6);
    fireEvent.pointerMove(bubble, { ...start, pointerId: 6, clientX: 170 });
    fireEvent.pointerUp(bubble, { ...start, pointerId: 6, clientX: 170 });
    expect(onReply).toHaveBeenCalledTimes(1);
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
