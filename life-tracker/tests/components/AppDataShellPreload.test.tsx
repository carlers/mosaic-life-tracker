import React, { act, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, expect, it, vi } from 'vitest';

// Importing the complete live app shell would also load providers/database
// into a unit test. The mock isolates the real module-loader resolution path.
vi.mock('../../src/components/layout/AppDataShell', () => ({
  AppDataShell: () => null,
}));
afterEach(() => vi.restoreAllMocks());

it('exposes a preloaded shell on the first render without suspending', async () => {
  vi.resetModules();
  const {
    getLoadedAppDataShell,
    subscribeLoadedAppDataShell,
    loadAppDataShell,
  } = await import('../../src/components/layout/routeModuleLoaders');

  const notified = vi.fn();
  const unsubscribe = subscribeLoadedAppDataShell(notified);
  expect(getLoadedAppDataShell()).toBeNull();

  const firstLoad = loadAppDataShell();
  const secondLoad = loadAppDataShell();
  expect(firstLoad).toBe(secondLoad);
  const loaded = await firstLoad;
  expect(getLoadedAppDataShell()).toBe(loaded.AppDataShell);
  expect(notified).toHaveBeenCalledTimes(1);
  unsubscribe();

  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const observed: Array<boolean> = [];
  function PreloadedShellStatus() {
    const Shell = useSyncExternalStore(
      subscribeLoadedAppDataShell, getLoadedAppDataShell,
    );
    observed.push(Boolean(Shell));
    return <span>{Shell ? 'preloaded' : 'pending'}</span>;
  }
  try {
    act(() => { flushSync(() => root.render(<PreloadedShellStatus />)); });
    expect(host.textContent).toBe('preloaded');
    expect(observed[0]).toBe(true);
    await loadAppDataShell();
    expect(notified).toHaveBeenCalledTimes(1);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it('publishes module resolution to an already mounted subscriber once', async () => {
  vi.resetModules();
  const {
    getLoadedAppDataShell,
    subscribeLoadedAppDataShell,
    loadAppDataShell,
  } = await import('../../src/components/layout/routeModuleLoaders');
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  function ShellStatus() {
    const Shell = useSyncExternalStore(
      subscribeLoadedAppDataShell, getLoadedAppDataShell,
    );
    return <span>{Shell ? 'ready' : 'loading'}</span>;
  }
  try {
    act(() => { flushSync(() => root.render(<ShellStatus />)); });
    expect(host.textContent).toBe('loading');
    await act(async () => { await loadAppDataShell(); });
    expect(host.textContent).toBe('ready');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
