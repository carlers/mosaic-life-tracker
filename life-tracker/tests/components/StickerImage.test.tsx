import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StickerImage } from '../../src/components/messages/StickerImage';

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  listeners: new Set<() => void>(),
  status: 'offline',
}));
vi.mock('../../src/lib/stickerStorage', () => ({ loadStickerImage: mocks.load }));
vi.mock('../../src/lib/connectivity', () => ({
  getConnectivitySnapshot: () => ({ status: mocks.status }),
  subscribeToConnectivity: (listener: () => void) => {
    mocks.listeners.add(listener);
    return () => mocks.listeners.delete(listener);
  },
}));

describe('chat sticker network budget and reconnection', () => {
  let observe!: IntersectionObserverCallback;
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.listeners.clear();
    mocks.status = 'offline';
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { observe = callback; }
      observe() {}
      disconnect() {}
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads only near viewport, then retries once connectivity is restored', async () => {
    mocks.load.mockResolvedValueOnce(null).mockResolvedValueOnce('blob:kitten');
    render(<StickerImage fileId={'stk_' + 'a'.repeat(32)} viewerId="owner" label="Kitten" />);
    expect(mocks.load).not.toHaveBeenCalled();
    await act(async () => {
      observe([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    await waitFor(() => expect(mocks.load).toHaveBeenCalledOnce());
    expect(screen.getByRole('img', { name: /sticker unavailable or loading: kitten/i })).toBeTruthy();

    await act(async () => {
      mocks.status = 'online';
      for (const listener of mocks.listeners) listener();
    });
    await waitFor(() => expect(screen.getByRole('img', { name: 'Kitten' })).toBeTruthy());
    expect(mocks.load).toHaveBeenCalledTimes(2);

    await act(async () => {
      mocks.status = 'offline';
      for (const listener of mocks.listeners) listener();
      mocks.status = 'online';
      for (const listener of mocks.listeners) listener();
    });
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });
});
