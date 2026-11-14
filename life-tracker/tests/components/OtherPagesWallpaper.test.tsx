import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import OtherPagesWallpaper from '../../src/components/layout/OtherPagesWallpaper';

const settings = vi.hoisted(() => ({
  home: 'aurora' as string,
  legacy: false,
  pages: undefined as unknown,
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: (key: string) => key === 'calendarWallpaperPages' ? settings.pages
      : key === 'calendarWallpaper' ? settings.home
      : key === 'calendarWallpaperOtherPages' ? settings.legacy
      : key === 'calendarWallpaperDim' ? 80 : undefined,
  }),
}));
vi.mock('../../src/lib/useWallpaperSource', () => ({
  useWallpaperSource: (id: string) => id === 'none' ? null : `/wallpapers/${id}`,
}));
afterEach(() => {
  cleanup();
  settings.home = 'aurora';
  settings.legacy = false;
  settings.pages = undefined;
});

describe('Per-page private wallpaper', () => {
  it('defaults to off for every page even with a selected Home wallpaper', () => {
    const { container } = render(<OtherPagesWallpaper pathname="/explore" />);
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).toBeNull();
  });
  it('changes only its named page and keeps all other pages off', () => {
    settings.pages = { explore: 'forest', chat: 'upload:1' };
    const { container, rerender } = render(<OtherPagesWallpaper pathname="/explore" />);
    expect(container.querySelector('[data-other-pages-wallpaper-paint="true"]')).not.toBeNull();
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')?.getAttribute('style')).toContain('forest');
    rerender(<OtherPagesWallpaper pathname="/notifications" />);
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).toBeNull();
    rerender(<OtherPagesWallpaper pathname="/messages/friend" />);
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).not.toBeNull();
  });
  it('never paints Home or a friend calendar, even if old global preference was on', () => {
    settings.legacy = true;
    const { container, rerender } = render(<OtherPagesWallpaper pathname="/friends/abc" />);
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).toBeNull();
    rerender(<OtherPagesWallpaper pathname="/home" />);
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).toBeNull();
    rerender(<OtherPagesWallpaper pathname="/settings" />);
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).not.toBeNull();
  });
});
