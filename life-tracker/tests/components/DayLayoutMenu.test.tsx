import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const pausedControls = vi.hoisted(() => new Set<string>());
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: (flag: string) => !pausedControls.has(flag),
}));
vi.mock('../../src/lib/featureControls', () => ({
  isFeatureEnabled: (flag: string) => !pausedControls.has(flag),
}));


import { DayLayoutMenu } from '../../src/components/home/views/DayLayoutMenu';

const settings = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
  setSetting: vi.fn(async (key: string, value: unknown) => { settings.values[key] = value; }),
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: (key: string, fallback: unknown) => settings.values[key] ?? fallback,
    setSetting: settings.setSetting,
  }),
}));
beforeEach(() => pausedControls.clear());

describe('Day View layout control', () => {
  beforeEach(() => {
    settings.values = {};
    settings.setSetting.mockClear();
  });
  it('preserves Bottom as default and saves left/right using existing synced keys', async () => {
    const { rerender } = render(<DayLayoutMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Change Day View layout' }));
    expect(screen.getByRole('menuitemradio', { name: 'Bottom' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Left' }));
    await waitFor(() => expect(settings.setSetting).toHaveBeenCalledWith('dayDetailPresentation', 'panel'));
    expect(settings.values.dayPanelSide).toBe('left');
    expect(settings.values.dayDetailPresentation).toBe('panel');
    rerender(<DayLayoutMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Change Day View layout' }));
    expect(screen.getByRole('menuitemradio', { name: 'Left' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Right' }));
    await waitFor(() => expect(settings.values.dayPanelSide).toBe('right'));
  });
  it('saves height and disables height choices in Bottom mode', async () => {
    settings.values.dayDetailPresentation = 'panel';
    const { rerender } = render(<DayLayoutMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Change Day View layout' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Full screen height' }));
    await waitFor(() => expect(settings.values.dayPanelHeight).toBe('screen'));
    rerender(<DayLayoutMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Change Day View layout' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Bottom' }));
    await waitFor(() => expect(settings.values.dayDetailPresentation).toBe('sheet'));
    rerender(<DayLayoutMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Change Day View layout' }));
    expect(screen.getByRole('menuitemradio', { name: 'Full screen height' })).toBeDisabled();
  });
  it('closes on Escape without changing preferences', async () => {
    render(<DayLayoutMenu />);
    const trigger = screen.getByRole('button', { name: 'Change Day View layout' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'Day View layout' })).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(settings.setSetting).not.toHaveBeenCalled();
  });
});

describe('Day View layout menu in clipped sheets and panels', () => {
  it('renders its options outside overflow-hidden ancestors and dismisses on outside pointerdown', async () => {
    const { container } = render(<div style={{ overflow: 'hidden', height: 35 }}><DayLayoutMenu /></div>);
    fireEvent.click(screen.getByRole('button', { name: 'Change Day View layout' }));
    const menu = await screen.findByRole('menu', { name: 'Day View layout' });
    expect(menu.parentElement).toBe(document.body);
    expect(container.contains(menu)).toBe(false);
    fireEvent.pointerDown(menu);
    expect(menu).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });
});

describe('Portaled layout menu keyboard behavior', () => {
  it('keeps Tab and arrow navigation inside the floating menu even when its trigger is clipped', () => {
    render(<div style={{ overflow: 'hidden', height: 32 }}><DayLayoutMenu /></div>);
    const trigger = screen.getByRole('button', { name: 'Change Day View layout' });
    fireEvent.click(trigger);
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Tab' });
    const bottom = screen.getByRole('menuitemradio', { name: 'Bottom' });
    expect(bottom).toHaveFocus();
    fireEvent.keyDown(bottom, { key: 'ArrowDown' });
    const left = screen.getByRole('menuitemradio', { name: 'Left' });
    expect(left).toHaveFocus();
    fireEvent.keyDown(left, { key: 'Tab', shiftKey: true });
    expect(bottom).toHaveFocus();
    fireEvent.keyDown(bottom, { key: 'Tab', shiftKey: true });
    expect(trigger).toHaveFocus();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
  it('pauses the quick layout switch without clearing saved preferences', () => {
    settings.values.dayPanelSide = 'left';
    settings.values.dayDetailPresentation = 'panel';
    pausedControls.add('mosaic_disable_day_view_layout_switch');
    const { rerender } = render(<DayLayoutMenu />);
    expect(screen.queryByRole('button', { name: 'Change Day View layout' })).not.toBeInTheDocument();
    expect(settings.values.dayPanelSide).toBe('left');
    pausedControls.clear();
    rerender(<DayLayoutMenu />);
    expect(screen.getByRole('button', { name: 'Change Day View layout' })).toBeEnabled();
    expect(settings.setSetting).not.toHaveBeenCalled();
  });

});
