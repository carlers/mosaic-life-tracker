import React, { Suspense } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createPreparedRoutePage } from '../../src/components/layout/createPreparedRoutePage';
import { SETTINGS_SUBPAGE_PRELOAD_TARGETS } from '../../src/components/layout/primaryRoutePreload';

describe('shared prepared routes including Settings children', () => {
  it('renders warm preview and real route without a second lazy fallback', async () => {
    const load = vi.fn(async () => () => <span>Ready</span>);
    const { Component, preload } = createPreparedRoutePage(load);
    const pending = preload();
    expect(preload()).toBe(pending);
    await pending;
    render(<Suspense fallback={<span>Opening</span>}><Component /><Component /></Suspense>);
    expect(screen.getAllByText('Ready')).toHaveLength(2);
    expect(screen.queryByText('Opening')).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('retains the cold fallback and renders after the module resolves', async () => {
    let resolve!: (component: React.FC) => void;
    const load = vi.fn(() => new Promise<React.FC>((done) => { resolve = done; }));
    const { Component } = createPreparedRoutePage(load);
    render(<Suspense fallback={<span>Opening</span>}><Component /></Suspense>);
    expect(screen.getByText('Opening')).toBeInTheDocument();
    await act(async () => { resolve(() => <span>Ready</span>); await Promise.resolve(); });
    expect(await screen.findByText('Ready')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('retries a rejected preload on a later mount', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline import')).mockResolvedValueOnce(() => <span>Recovered</span>);
    const { Component, preload } = createPreparedRoutePage(load);
    await expect(preload()).rejects.toThrow('offline import');
    render(<Suspense fallback={<span>Opening</span>}><Component /></Suspense>);
    expect(await screen.findByText('Recovered')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('warms Settings parents and subpage modules, including new category routes', () => {
    expect(SETTINGS_SUBPAGE_PRELOAD_TARGETS).toEqual([
      '/settings/account', '/settings/data', '/settings/about',
      '/settings/preferences', '/settings/notifications', '/settings/releases',
      '/profile',
    ]);
  });
});
