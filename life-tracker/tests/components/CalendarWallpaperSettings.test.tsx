import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CalendarWallpaperSettings } from '../../src/components/settings/CalendarWallpaperSettings';
import { resolveWallpaperPageChoices } from '../../src/lib/wallpaperPageSettings';

afterEach(cleanup);
const props = () => ({
  value: 'aurora' as const,
  dim: 55,
  scope: 'grid' as const,
  pages: resolveWallpaperPageChoices(undefined),
  uploadSlots: [0, 2] as const,
  onChange: vi.fn(), onDimChange: vi.fn(), onScopeChange: vi.fn(), onPageChange: vi.fn(),
});
describe('Mosaic wallpaper settings', () => {
  it('renders styled independent page selectors without native checkbox or radio', () => {
    const input = props();
    render(<CalendarWallpaperSettings {...input} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByRole('combobox', { name: /Explore wallpaper/ })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: /Alerts wallpaper/ })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: /Settings subpages wallpaper/ })).toBeTruthy();
    expect(screen.getAllByRole('combobox')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'No wallpaper' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'No wallpaper' }));
    expect(input.onChange).toHaveBeenCalledWith('none');
  });
  it('offers Mosaic selection buttons for grid/full Home and full brightness range', () => {
    const input = props();
    render(<CalendarWallpaperSettings {...input} />);
    expect(screen.getByRole('button', { name: 'Calendar grid only' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Full Home (headers and friends)' }));
    expect(input.onScopeChange).toHaveBeenCalledWith('home');
    const slider = screen.getByRole('slider', { name: 'Darken wallpaper' });
    expect(slider.getAttribute('min')).toBe('0');
    expect(slider.getAttribute('max')).toBe('100');
    expect(slider.getAttribute('step')).toBe('1');
    fireEvent.change(slider, { target: { value: '100' } });
    expect(input.onDimChange).toHaveBeenCalledWith(100);
  });
  it('allows a page wallpaper even if Home is disabled and exposes uploaded options', () => {
    const input = { ...props(), value: 'none' as const };
    render(<CalendarWallpaperSettings {...input} />);
    expect(screen.queryByRole('button', { name: 'Calendar grid only' })).toBeNull();
    expect(screen.getByRole('combobox', { name: /Explore wallpaper/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('combobox', { name: /Explore wallpaper/ }));
    const uploadChoice = screen.getByRole('option', { name: 'My photo 1' });
    fireEvent.click(uploadChoice);
    expect(input.onPageChange).toHaveBeenCalledWith('explore', 'upload:0');
  });
});
