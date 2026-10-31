import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StickerPackSheet } from '../../src/components/messages/StickerPackSheet';
import { packStickerMessage } from '../../src/lib/stickerPacks';

const controls = vi.hoisted(() => ({ discoveryEnabled: true }));
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: (name: string) => name !== 'stickerPackDiscovery' || controls.discoveryEnabled,
}));
vi.mock('../../src/lib/featureControls', () => ({
  isFeatureEnabled: (name: string) => name !== 'stickerPackDiscovery' || controls.discoveryEnabled,
}));

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}));

describe('StickerPackSheet', () => {
  beforeEach(() => { controls.discoveryEnabled = true; window.localStorage.clear(); });

  it('offers direct single-tap sends without an import or Appwrite upload', () => {
    const onPick = vi.fn();
    render(<StickerPackSheet isOpen ownerId="one" onPick={onPick} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Send Sending love' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send Sending love' }));
    expect(onPick).toHaveBeenCalledExactlyOnceWith('reactions', 'love');
    expect(packStickerMessage(...(onPick.mock.calls[0] as [string, string]))).toContain('[mp1:');
  });

  it('hides pack discovery without losing previously installed packs or GIPHY', () => {
    const onPick = vi.fn();
    const view = render(<StickerPackSheet isOpen ownerId="one" onPick={onPick} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Discover' }));
    fireEvent.click(screen.getByRole('button', { name: 'Little Critters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Install Little Critters' }));

    controls.discoveryEnabled = false;
    view.rerender(<StickerPackSheet isOpen ownerId="one" onPick={onPick} onClose={vi.fn()} />);
    expect(screen.queryByRole('tab', { name: 'Discover' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Install Little Critters' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'GIPHY' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Little Critters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send Kitty' }));
    expect(onPick).toHaveBeenCalledWith('critters', 'cat');
  });

  it('discovers and bookmarks new packs without copying any images', () => {
    const onPick = vi.fn();
    render(<StickerPackSheet isOpen ownerId="one" onPick={onPick} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Discover' }));
    fireEvent.click(screen.getByRole('button', { name: 'Little Critters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Install Little Critters' }));
    fireEvent.click(screen.getByRole('tab', { name: 'My Packs' }));
    expect(screen.getByRole('button', { name: 'Little Critters' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Little Critters' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search stickers' }), {
      target: { value: 'kit' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Kitty' }));
    expect(onPick).toHaveBeenCalledWith('critters', 'cat');
  });
});
