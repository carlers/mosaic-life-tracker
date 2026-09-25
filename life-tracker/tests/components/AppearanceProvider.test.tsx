import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  syncedMode: 'system' as unknown,
  isLoading: false,
  setSetting: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    isLoading: mocks.isLoading,
    getSetting: (key: string, fallback?: unknown) =>
      key === 'appearanceMode' ? mocks.syncedMode ?? fallback : fallback,
    setSetting: mocks.setSetting,
  }),
}));

import { AppearanceProvider } from '../../src/hooks/AppearanceProvider';
import { useAppearance } from '../../src/hooks/useAppearance';

function Consumer() {
  const { mode, resolvedTheme, setAppearanceMode } = useAppearance();
  return (
    <div>
      <output data-testid="appearance-mode">{mode}</output>
      <output data-testid="resolved-theme">{resolvedTheme}</output>
      <button type="button" onClick={() => void setAppearanceMode('light')}>
        Use light
      </button>
    </div>
  );
}

describe('AppearanceProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.syncedMode = 'system';
    mocks.isLoading = false;
    mocks.setSetting.mockClear();
    vi.unstubAllGlobals();
  });

  // Regression: PROJECT_REFERENCE.md §2 — mode changes are immediate, cached, and synced.
  it('applies and persists a selected appearance mode', () => {
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

    expect(screen.getByTestId('appearance-mode')).toHaveTextContent('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('mosaic_appearance_mode')).toBe('light');
    expect(mocks.setSetting).toHaveBeenCalledWith('appearanceMode', 'light');
  });

  // Regression: PROJECT_REFERENCE.md §2 — System follows prefers-color-scheme live.
  it('updates the resolved theme when the system preference changes', () => {
    let listener: ((event: MediaQueryListEvent) => void) | null = null;
    let matches = false;
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() {
        return matches;
      },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: (_type: string, next: (event: MediaQueryListEvent) => void) => {
        listener = next;
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
});
