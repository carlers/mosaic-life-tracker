import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { DEFAULT_GESTURE_SHORTCUT_SETTINGS } from '../../src/lib/gestureShortcuts';

const mocks = vi.hoisted(() => ({
  setting: null as unknown,
  featureEnabled: true,
  socialEnabled: true,
  searchEnabled: true,
}));

vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: (key: string) => key === 'gestureShortcuts' ? mocks.setting : undefined,
  }),
}));
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: (flag: string) =>
    flag === 'mosaic_disable_all_social' ? mocks.socialEnabled
    : flag === 'mosaic_disable_task_search' ? mocks.searchEnabled
    : mocks.featureEnabled,
}));

import { GestureShortcutsProvider } from '../../src/hooks/GestureShortcutsProvider';
import { useGestureShortcuts } from '../../src/hooks/gestureShortcutsContext';

function Probe() {
  const { actionFor, dispatch } = useGestureShortcuts();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { mosaicGestureRequest?: string } | null;
  return (
    <div>
      <span data-testid="path">{location.pathname + location.search}</span>
      <span data-testid="intent">{state?.mosaicGestureRequest ?? 'none'}</span>
      <span data-testid="alerts-action">{actionFor('nav:notifications') ?? 'none'}</span>
      <span data-testid="me-action">{actionFor('nav:account') ?? 'none'}</span>
      <button onClick={() => dispatch('settings')}>Open Settings</button>
      <button onClick={() => dispatch('menu')}>Open Menu</button>
      <button onClick={() => dispatch('search')}>Open Search</button>
      <button onClick={() => dispatch('alerts')}>Open Alerts</button>
      <button onClick={() => navigate(-1)}>Back</button>
    </div>
  );
}

function mount() {
  return render(
    <MemoryRouter initialEntries={['/notifications']}>
      <GestureShortcutsProvider><Probe /></GestureShortcutsProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mocks.setting = null;
  mocks.featureEnabled = true;
  mocks.socialEnabled = true;
  mocks.searchEnabled = true;
});

describe('gesture shortcut route dispatch', () => {
  it('does not navigate without explicit opt-in, including malformed or older settings', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/notifications');
    expect(screen.getByTestId('me-action')).toHaveTextContent('none');
  });

  it('keeps real route history when navigating from an inactive tab', () => {
    mocks.setting = { ...DEFAULT_GESTURE_SHORTCUT_SETTINGS, enabled: true };
    mount();
    expect(screen.getByTestId('me-action')).toHaveTextContent('settings');
    fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/settings');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/notifications');
  });

  it('uses Home route intents instead of duplicating Home-owned overlays', () => {
    mocks.setting = { ...DEFAULT_GESTURE_SHORTCUT_SETTINGS, enabled: true };
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Open Menu' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/home');
    expect(screen.getByTestId('intent')).toHaveTextContent('menu');
  });

  it('blocks unavailable search and social routes without altering saved settings', () => {
    mocks.setting = {
      ...DEFAULT_GESTURE_SHORTCUT_SETTINGS,
      enabled: true,
      assignments: { ...DEFAULT_GESTURE_SHORTCUT_SETTINGS.assignments, 'nav:notifications': 'alerts' },
    };
    mocks.socialEnabled = false;
    mocks.searchEnabled = false;
    mount();
    expect(screen.getByTestId('alerts-action')).toHaveTextContent('none');
    fireEvent.click(screen.getByRole('button', { name: 'Open Search' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/notifications');
    fireEvent.click(screen.getByRole('button', { name: 'Open Alerts' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/notifications');
    fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/settings');
  });

  it('honors the operator kill switch without deleting assignments', () => {
    mocks.setting = { ...DEFAULT_GESTURE_SHORTCUT_SETTINGS, enabled: true };
    mocks.featureEnabled = false;
    mount();
    expect(screen.getByTestId('me-action')).toHaveTextContent('none');
    fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/notifications');
  });
});
