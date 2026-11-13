import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CalendarWallpaperSettings } from '../../src/components/settings/CalendarWallpaperSettings';

afterEach(cleanup);

describe('Calendar wallpaper settings', () => {
  it('uses None by default and lets the owner select a bundled wallpaper', () => {
    const onChange = vi.fn();
    render(<CalendarWallpaperSettings value="none" dim={55} onChange={onChange} onDimChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'No wallpaper' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('slider', { name: 'Darken wallpaper' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Aurora wallpaper' }));
    expect(onChange).toHaveBeenCalledWith('aurora');
  });

  it('exposes the dimming control for a selected preset and supports reset', () => {
    const onChange = vi.fn();
    const onDimChange = vi.fn();
    render(<CalendarWallpaperSettings value="forest" dim={60} onChange={onChange} onDimChange={onDimChange} />);
    expect(screen.getByRole('button', { name: 'Evergreen wallpaper' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByRole('slider', { name: 'Darken wallpaper' }), { target: { value: '70' } });
    expect(onDimChange).toHaveBeenCalledWith(70);
    fireEvent.click(screen.getByRole('button', { name: 'No wallpaper' }));
    expect(onChange).toHaveBeenCalledWith('none');
  });
});
