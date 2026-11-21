import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
vi.mock('../../src/lib/useWallpaperSource', () => ({
  useWallpaperSource: (id: string) => id === 'none' ? null : '/wallpapers/aurora.svg',
}));
import { CalendarWallpaperBackdrop } from '../../src/components/home/views/CalendarWallpaperBackdrop';

const settings = vi.hoisted(() => ({ id: 'aurora', dim: 55, scope: 'grid', material: 'soft' }));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: (key: string) => {
      if (key === 'calendarWallpaper') return settings.id;
      if (key === 'calendarWallpaperDim') return settings.dim;
      if (key === 'calendarWallpaperScope') return settings.scope;
      if (key === 'calendarWallpaperMaterial') return settings.material;
      return undefined;
    },
  }),
}));

afterEach(() => {
  cleanup();
  settings.id = 'aurora';
  settings.dim = 55;
  settings.scope = 'grid';
  settings.material = 'soft';
});

const example = () => (
  <div className="mosaic-app-layout" data-testid="app-layout">
    <div data-testid="primary-route-width-frame">
      <div className="mosaic-home-workspace" data-testid="home-workspace">
        <div data-testid="calendar-grid">
          <CalendarWallpaperBackdrop />
        </div>
      </div>
    </div>
  </div>
);

describe('Calendar wallpaper paint ownership', () => {
  it('keeps grid mode beneath Calendar content, with no Home wrapper change', () => {
    const { container } = render(example());
    const grid = screen.getByTestId('calendar-grid');
    expect(grid.querySelector('[data-calendar-wallpaper-image="true"]')).not.toBeNull();
    expect(container.querySelector('[data-home-wallpaper-paint]')).toBeNull();
  });

  it('keeps the image mounted when Solid material is selected', () => {
    settings.material = 'solid';
    const { container } = render(example());
    expect(container.querySelector('[data-calendar-wallpaper-image]')?.getAttribute('data-wallpaper-material')).toBe('solid');
  });

  it('moves the same single non-interactive backdrop behind Home headers and cleans up', async () => {
    settings.scope = 'home';
    const { rerender, unmount } = render(example());
    const home = screen.getByTestId('home-workspace');
    const layout = screen.getByTestId('app-layout');
    const grid = screen.getByTestId('calendar-grid');
    await waitFor(() => {
      expect(layout.querySelector('[data-home-wallpaper-paint="true"]')?.parentElement).toBe(layout);
    });
    const paint = layout.querySelector('[data-calendar-wallpaper-image="true"]');
    expect(paint?.parentElement).toBe(layout);
    expect(home.contains(paint)).toBe(false);
    expect(grid.contains(paint)).toBe(false);
    expect(paint?.getAttribute('data-home-wallpaper-paint')).toBe('true');
    expect(paint?.getAttribute('aria-hidden')).toBe('true');

    settings.scope = 'grid';
    rerender(example());
    expect(layout.querySelector('[data-home-wallpaper-paint]')).toBeNull();
    expect(grid.querySelector('[data-calendar-wallpaper-image="true"]')).not.toBeNull();
    unmount();
    expect(layout.querySelector('[data-home-wallpaper-paint]')).toBeNull();
  });

  it('renders no layer when the preset is disabled, even with Home coverage selected', () => {
    settings.id = 'none';
    settings.scope = 'home';
    const { container } = render(example());
    expect(container.querySelector('[data-calendar-wallpaper-image]')).toBeNull();
    expect(container.querySelector('[data-home-wallpaper-paint]')).toBeNull();
  });
});
