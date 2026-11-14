import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import OtherPagesWallpaper from '../../src/components/layout/OtherPagesWallpaper';

const preferences = vi.hoisted(() => ({ enabled: false, preset: 'aurora', dim: 55 }));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: (key: string) => {
      if (key === 'calendarWallpaperOtherPages') return preferences.enabled;
      if (key === 'calendarWallpaper') return preferences.preset;
      if (key === 'calendarWallpaperDim') return preferences.dim;
      return undefined;
    },
  }),
}));

afterEach(() => {
  cleanup();
  preferences.enabled = false;
  preferences.preset = 'aurora';
  preferences.dim = 55;
});

describe('Other protected pages wallpaper opt-in', () => {
  it('renders no wallpaper unless explicitly enabled', () => {
    const { container } = render(<OtherPagesWallpaper />);
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).toBeNull();
  });

  it('paints an inert stationary image with the same selected preset and dimming', () => {
    preferences.enabled = true;
    preferences.dim = 90;
    render(<OtherPagesWallpaper />);
    const paint = document.querySelector('[data-other-pages-wallpaper-paint="true"]');
    expect(paint).not.toBeNull();
    expect(paint?.getAttribute('aria-hidden')).toBe('true');
    expect(paint?.className).toContain('pointer-events-none');
  });

  it('cleans up on opt-out, None, or an invalid synced preset', () => {
    preferences.enabled = true;
    const { container, rerender } = render(<OtherPagesWallpaper />);
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).not.toBeNull();
    preferences.enabled = false;
    rerender(<OtherPagesWallpaper />);
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).toBeNull();
    preferences.enabled = true;
    preferences.preset = 'none';
    rerender(<OtherPagesWallpaper />);
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).toBeNull();
    preferences.preset = 'http://external';
    rerender(<OtherPagesWallpaper />);
    expect(screen.queryByLabelText('Other pages wallpaper')).toBeNull();
    expect(container.querySelector('[data-other-pages-wallpaper-paint]')).toBeNull();
  });
});
