import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  syncedMode: 'system' as unknown,
  syncedAccentColor: undefined as unknown,
  isLoading: false,
  setSetting: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { $id: 'user_1' },
  }),
}));

vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    isLoading: mocks.isLoading,
    getSetting: (key: string, fallback?: unknown) => {
      if (key === 'appearanceMode') return mocks.syncedMode ?? fallback;
      if (key === 'accentColor') return mocks.syncedAccentColor ?? fallback;
      return fallback;
    },
    setSetting: mocks.setSetting,
  }),
}));

import { AppearanceProvider } from '../../src/hooks/AppearanceProvider';
import { useAppearance } from '../../src/hooks/useAppearance';

function Consumer() {
  const {
    mode,
    resolvedTheme,
    accentColor,
    setAppearanceMode,
    setAccentColor,
    reduceAnimations,
    effectiveReducedMotion,
    setReduceAnimations,
  } = useAppearance();
  return (
    <div>
      <output data-testid="appearance-mode">{mode}</output>
      <output data-testid="resolved-theme">{resolvedTheme}</output>
      <output data-testid="accent-color">{accentColor}</output>
      <output data-testid="reduce-animations">{String(reduceAnimations)}</output>
      <output data-testid="effective-motion">{String(effectiveReducedMotion)}</output>
      <button type="button" onClick={() => void setAppearanceMode('light')}>
        Use light
      </button>
      <button type="button" onClick={() => void setReduceAnimations(true)}>
        Reduce app motion
      </button>
      <button type="button" onClick={() => void setAccentColor('#3B82F6')}>
        Use blue accent
      </button>
    </div>
  );
}

describe('AppearanceProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.syncedMode = 'system';
    mocks.syncedAccentColor = undefined;
    mocks.isLoading = false;
    mocks.setSetting.mockClear();
    vi.unstubAllGlobals();
  });

  // Regression: §2 (appearance changes are immediate, cached, and synced).
  it('applies and persists selected appearance mode and accent color', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    render(
      <AppearanceProvider>
        <Consumer />
      </AppearanceProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use light' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use blue accent' }));

    expect(screen.getByTestId('appearance-mode')).toHaveTextContent('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('mosaic_appearance_mode')).toBe('light');
    expect(mocks.setSetting).toHaveBeenCalledWith('appearanceMode', 'light');

    expect(screen.getByTestId('accent-color')).toHaveTextContent('#3B82F6');
    expect(document.documentElement.dataset.accentColor).toBe('#3B82F6');
    expect(document.documentElement.style.getPropertyValue('--mosaic-accent')).toBe(
      '#3B82F6'
    );
    expect(localStorage.getItem('mosaic_accent_color:user_1')).toBe('#3B82F6');
    expect(mocks.setSetting).toHaveBeenCalledWith('accentColor', '#3B82F6');
  });

  it('syncs Reduce animations and caches the choice for the current user', () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: false, media: query,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    render(<AppearanceProvider><Consumer /></AppearanceProvider>);
    expect(screen.getByTestId('reduce-animations')).toHaveTextContent('false');
    fireEvent.click(screen.getByRole('button', { name: 'Reduce app motion' }));
    expect(screen.getByTestId('reduce-animations')).toHaveTextContent('true');
    expect(document.documentElement.dataset.reduceMotion).toBe('true');
    expect(localStorage.getItem('mosaic_reduce_animations_user_1')).toBe('true');
    expect(mocks.setSetting).toHaveBeenCalledWith('reduceAnimations', true);
  });

  it('reacts to live OS motion changes even with the app preference disabled', () => {
    let reduced = false;
    let listener: (() => void) | undefined;
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query,
      get matches() { return query === '(prefers-reduced-motion: reduce)' && reduced; },
      addEventListener: (_: string, callback: () => void) => {
        if (query === '(prefers-reduced-motion: reduce)') listener = callback;
      },
      removeEventListener: vi.fn(),
    })));
    render(<AppearanceProvider><Consumer /></AppearanceProvider>);
    expect(screen.getByTestId('reduce-animations')).toHaveTextContent('false');
    expect(screen.getByTestId('effective-motion')).toHaveTextContent('false');
    reduced = true;
    act(() => listener?.());
    expect(screen.getByTestId('effective-motion')).toHaveTextContent('true');
    expect(screen.getByTestId('reduce-animations')).toHaveTextContent('false');
    expect(document.documentElement.dataset.reduceMotion).toBe('true');
  });

  // Regression: §2 (System appearance follows prefers-color-scheme live).
  it('updates the resolved theme when the system preference changes', () => {
    let listener: ((event: MediaQueryListEvent) => void) | null = null;
    let matches = false;
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      get matches() {
        return query === '(prefers-color-scheme: dark)' ? matches : false;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, next: (event: MediaQueryListEvent) => void) => {
        if (query === '(prefers-color-scheme: dark)') listener = next;
      },
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    render(
      <AppearanceProvider>
        <Consumer />
      </AppearanceProvider>
    );

    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');

    matches = true;
    act(() => {
      listener?.({ matches: true } as MediaQueryListEvent);
    });

    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('uses the synced accent instead of the cached value when settings are ready', () => {
    localStorage.setItem('mosaic_accent_color:user_1', '#EC4899');
    mocks.syncedAccentColor = '#8B5CF6';

    render(
      <AppearanceProvider>
        <Consumer />
      </AppearanceProvider>
    );

    expect(screen.getByTestId('accent-color')).toHaveTextContent('#8B5CF6');
    expect(document.documentElement.dataset.accentColor).toBe('#8B5CF6');
  });
});
