import React, { Suspense } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createPreparedRoutePage } from '../../src/components/layout/createPreparedRoutePage';
import { SETTINGS_SUBPAGE_PRELOAD_TARGETS } from '../../src/components/layout/primaryRoutePreload';

describe('prepared route pages and swipe previews', () => {
  it('renders both warm preview and destination immediately without suspense', async () => {
    const load = vi.fn(async () => () => <p>Settings ready</p>);
    const { Component, preload } = createPreparedRoutePage(load);
    const pending = preload();
    expect(preload()).toBe(pending);
    await pending;
    render(
      <Suspense fallback={<p>Opening Settings</p>}>
        <Component />
        <Component />
      </Suspense>
    );
    expect(screen.getAllByText('Settings ready')).toHaveLength(2);
    expect(screen.queryByText('Opening Settings')).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('uses the existing fallback when a route is genuinely cold', async () => {
    let resolve!: (Page: React.FC) => void;
    const load = vi.fn(() => new Promise<React.FC>((done) => { resolve = done; }));
    const { Component } = createPreparedRoutePage(load);
    render(<Suspense fallback={<p>Opening Preferences</p>}><Component /></Suspense>);
    expect(screen.getByText('Opening Preferences')).toBeInTheDocument();
    await act(async () => {
      resolve(() => <p>Preferences ready</p>);
      await Promise.resolve();
    });
    expect(await screen.findByText('Preferences ready')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('retries a failed preload on the next cold mount', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('offline chunk'))
      .mockResolvedValueOnce(() => <p>Recovered page</p>);
    const { Component, preload } = createPreparedRoutePage(load);
    await expect(preload()).rejects.toThrow('offline chunk');
    render(<Suspense fallback={<p>Opening page</p>}><Component /></Suspense>);
    expect(await screen.findByText('Recovered page')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('includes all navigable Settings subpages in proactive warmup', () => {
    expect(SETTINGS_SUBPAGE_PRELOAD_TARGETS).toEqual([
      '/settings/preferences',
      '/settings/notifications',
      '/settings/releases',
      '/profile',
    ]);
  });
});
