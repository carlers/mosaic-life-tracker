import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import OtherPagesWallpaper from '../../src/components/layout/OtherPagesWallpaper';

const settings = vi.hoisted(() => ({
  home: 'aurora' as string,
  scope: 'grid' as string,
  material: 'soft' as string,
  legacy: false,
  pages: undefined as unknown,
  sources: [] as string[],
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: (key: string) => key === 'calendarWallpaperPages' ? settings.pages
      : key === 'calendarWallpaperScope' ? settings.scope
      : key === 'calendarWallpaper' ? settings.home
      : key === 'calendarWallpaperOtherPages' ? settings.legacy
      : key === 'calendarWallpaperDim' ? 80
      : key === 'calendarWallpaperMaterial' ? settings.material : undefined,
  }),
}));
vi.mock('../../src/lib/useWallpaperSource', () => ({
  useWallpaperSource: (id: string) => {
    settings.sources.push(id);
    return id === 'none' ? null : `/wallpapers/${id}`;
  },
}));
afterEach(() => {
  cleanup();
  settings.home = 'aurora';
  settings.scope = 'grid';
  settings.material = 'soft';
  settings.legacy = false;
  settings.pages = undefined;
  settings.sources = [];
});

const subject = (path: string) => (
  <MemoryRouter key={path} initialEntries={[path]}><OtherPagesWallpaper /></MemoryRouter>
);

function RouteWallpaperHarness() {
  const navigate = useNavigate();
  return <>
    <button onClick={() => navigate('/explore')}>Explore</button>
    <button onClick={() => navigate('/home')}>Home</button>
    <OtherPagesWallpaper />
  </>;
}

describe('Per-page private wallpaper', () => {
  it('defaults to off for every page even with a selected Home wallpaper', () => {
    const { container } = render(subject('/explore'));
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).toBeNull();
  });
  it('marks only visible owner wallpapers with the chosen material', () => {
    settings.pages = { explore: 'aurora' };
    const { container, rerender } = render(subject('/explore'));
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')?.getAttribute('data-wallpaper-material')).toBe('soft');
    settings.material = 'solid';
    rerender(subject('/explore'));
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')?.getAttribute('data-wallpaper-material')).toBe('solid');
    settings.pages = { explore: 'off' };
    rerender(subject('/explore'));
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).toBeNull();
  });
  it('changes only its named page and keeps all other pages off', () => {
    settings.pages = { explore: 'forest', chat: 'upload:1' };
    const { container, rerender } = render(subject('/explore'));
    expect(container.querySelector('[data-other-pages-wallpaper-paint="true"]')).not.toBeNull();
    expect(settings.sources.at(-1)).toBe('forest');
    rerender(subject('/notifications'));
    expect(settings.sources.at(-1)).toBe('none');
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).toBeNull();
    rerender(subject('/messages/friend'));
    expect(settings.sources.at(-1)).toBe('upload:1');
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).not.toBeNull();
  });
  it('retains the Home grid-only image lease while other route wallpapers are off', () => {
    settings.scope = 'grid';
    settings.home = 'upload:2';
    settings.pages = { explore: 'off', alerts: 'off' };
    const { container, getByRole } = render(
      <MemoryRouter initialEntries={['/home']}><RouteWallpaperHarness /></MemoryRouter>
    );
    expect(settings.sources).toContain('upload:2');
    expect(container.querySelector('[data-home-wallpaper-paint]')).toBeNull();
    fireEvent.click(getByRole('button', { name: 'Explore' }));
    expect(settings.sources).toContain('upload:2');
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).toBeNull();
    fireEvent.click(getByRole('button', { name: 'Home' }));
    expect(settings.sources).toContain('upload:2');
    expect(container.querySelector('[data-home-wallpaper-paint]')).toBeNull();
  });

  it('keeps the same wallpaper DOM paint across Home and Explore navigation', () => {
    settings.scope = 'home';
    settings.pages = { explore: 'home' };
    const { container, getByRole } = render(
      <MemoryRouter initialEntries={['/home']}><RouteWallpaperHarness /></MemoryRouter>
    );
    const paint = container.querySelector('[data-home-wallpaper-paint]');
    expect(paint).not.toBeNull();
    expect(settings.sources).toContain('aurora');
    fireEvent.click(getByRole('button', { name: 'Explore' }));
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).toBe(paint);
    fireEvent.click(getByRole('button', { name: 'Home' }));
    expect(container.querySelector('[data-home-wallpaper-paint]')).toBe(paint);
  });

  it('never paints Home or a friend calendar, even if old global preference was on', () => {
    settings.legacy = true;
    const { container, rerender } = render(subject('/friends/abc'));
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).toBeNull();
    rerender(subject('/home'));
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).toBeNull();
    rerender(subject('/settings'));
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).not.toBeNull();
  });
  it('keeps soft placeholder state on the owning app shell only and removes it on material change', () => {
    settings.pages = { explore: 'forest' };
    const content = () => (
      <MemoryRouter initialEntries={['/explore']}>
        <div className="mosaic-app-layout" data-testid="wallpaper-shell"><OtherPagesWallpaper /></div>
        <div className="mosaic-app-layout" data-testid="unrelated-shell" />
      </MemoryRouter>
    );
    const { container, rerender, unmount } = render(content());
    const shell = container.querySelector('[data-testid="wallpaper-shell"]');
    const unrelated = container.querySelector('[data-testid="unrelated-shell"]');
    expect(shell?.getAttribute('data-mosaic-soft-wallpaper-placeholder')).toBe('true');
    expect(unrelated?.hasAttribute('data-mosaic-soft-wallpaper-placeholder')).toBe(false);

    settings.material = 'solid';
    rerender(content());
    expect(shell?.hasAttribute('data-mosaic-soft-wallpaper-placeholder')).toBe(false);

    settings.material = 'soft';
    rerender(content());
    expect(shell?.getAttribute('data-mosaic-soft-wallpaper-placeholder')).toBe('true');

    settings.pages = { explore: 'off' };
    rerender(content());
    expect(shell?.hasAttribute('data-mosaic-soft-wallpaper-placeholder')).toBe(false);
    unmount();
    expect(shell?.hasAttribute('data-mosaic-soft-wallpaper-placeholder')).toBe(false);
  });

  it('marks full-home soft wallpaper but not grid-only Home wallpaper', () => {
    settings.scope = 'home';
    const content = () => (
      <MemoryRouter initialEntries={['/home']}>
        <div className="mosaic-app-layout" data-testid="home-shell"><OtherPagesWallpaper /></div>
      </MemoryRouter>
    );
    const { container, rerender } = render(content());
    const shell = container.querySelector('[data-testid="home-shell"]');
    expect(shell?.getAttribute('data-mosaic-soft-wallpaper-placeholder')).toBe('true');
    settings.scope = 'grid';
    rerender(content());
    expect(shell?.hasAttribute('data-mosaic-soft-wallpaper-placeholder')).toBe(false);
  });

});
