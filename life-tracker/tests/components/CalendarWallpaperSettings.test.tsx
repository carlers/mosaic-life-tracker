import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CalendarWallpaperSettings } from '../../src/components/settings/CalendarWallpaperSettings';

afterEach(cleanup);

describe('Calendar wallpaper settings', () => {
  it('uses None by default and lets the owner select a bundled wallpaper', () => {
    const onChange = vi.fn();
    render(<CalendarWallpaperSettings value="none" dim={55} scope="grid" onChange={onChange} onDimChange={vi.fn()} onScopeChange={vi.fn()} otherPages={false} onOtherPagesChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'No wallpaper' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('slider', { name: 'Darken wallpaper' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Show wallpaper on other pages' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Aurora wallpaper' }));
    expect(onChange).toHaveBeenCalledWith('aurora');
  });

  it('exposes the dimming control for a selected preset and supports reset', () => {
    const onChange = vi.fn();
    const onDimChange = vi.fn();
    render(<CalendarWallpaperSettings value="forest" dim={60} scope="grid" onChange={onChange} onDimChange={onDimChange} onScopeChange={vi.fn()} otherPages={false} onOtherPagesChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Evergreen wallpaper' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByRole('slider', { name: 'Darken wallpaper' }), { target: { value: '70' } });
    expect(onDimChange).toHaveBeenCalledWith(70);
    const slider = screen.getByRole('slider', { name: 'Darken wallpaper' });
    expect(slider.getAttribute('min')).toBe('0');
    expect(slider.getAttribute('max')).toBe('100');
    expect(slider.getAttribute('step')).toBe('1');
    fireEvent.change(slider, { target: { value: '0' } });
    fireEvent.change(slider, { target: { value: '100' } });
    expect(onDimChange).toHaveBeenCalledWith(0);
    expect(onDimChange).toHaveBeenCalledWith(100);
    fireEvent.click(screen.getByRole('button', { name: 'No wallpaper' }));
    expect(onChange).toHaveBeenCalledWith('none');
  });
  it('offers grid versus full-Home coverage without changing the selected preset', () => {
    const onScopeChange = vi.fn();
    render(<CalendarWallpaperSettings value="dusk" dim={0} scope="grid" onChange={vi.fn()} onDimChange={vi.fn()} onScopeChange={onScopeChange} otherPages={false} onOtherPagesChange={vi.fn()} />);
    const grid = screen.getByRole('radio', { name: 'Calendar grid only' });
    const home = screen.getByRole('radio', { name: 'Full Home (headers and friends)' });
    expect((grid as HTMLInputElement).checked).toBe(true);
    fireEvent.click(home);
    expect(onScopeChange).toHaveBeenCalledWith('home');
  });
  it('offers a default-off separate opt-in for other protected pages', () => {
    const onOtherPagesChange = vi.fn();
    const { rerender } = render(
      <CalendarWallpaperSettings value="aurora" dim={55} scope="grid" otherPages={false}
        onChange={vi.fn()} onDimChange={vi.fn()} onScopeChange={vi.fn()}
        onOtherPagesChange={onOtherPagesChange} />
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Show wallpaper on other pages' });
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    fireEvent.click(checkbox);
    expect(onOtherPagesChange).toHaveBeenCalledWith(true);
    rerender(
      <CalendarWallpaperSettings value="aurora" dim={55} scope="grid" otherPages
        onChange={vi.fn()} onDimChange={vi.fn()} onScopeChange={vi.fn()}
        onOtherPagesChange={onOtherPagesChange} />
    );
    expect((screen.getByRole('checkbox', { name: 'Show wallpaper on other pages' }) as HTMLInputElement).checked).toBe(true);
  });
});
