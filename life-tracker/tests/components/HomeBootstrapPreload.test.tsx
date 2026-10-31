import React, { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Isolate Home module import from local DB/carousel providers. It must prime
// the SAME prepared component that renders after cached-account bootstrap.
const loadHomePage = vi.hoisted(() => vi.fn(async () => ({
  HomePage: () => <p>Ready Home</p>,
})));
vi.mock('../../src/components/layout/routeModuleLoaders', () => ({
  loadHomePage,
}));

describe('returning account Home startup module preload', () => {
  it('has no extra lazy reveal when bootstrap imported Home before the first mount', async () => {
    vi.resetModules();
    loadHomePage.mockClear();
    const { preloadHomePage } = await import('../../src/lib/homePreload');
    const { HomeRoutePage } = await import('../../src/components/layout/routePageComponents');
    const first = preloadHomePage();
    expect(preloadHomePage()).toBe(first);
    await first;
    render(<Suspense fallback={<p>Opening Home</p>}><HomeRoutePage /></Suspense>);
    expect(screen.getByText('Ready Home')).toBeInTheDocument();
    expect(screen.queryByText('Opening Home')).not.toBeInTheDocument();
    expect(loadHomePage).toHaveBeenCalledTimes(1);
  });
});
