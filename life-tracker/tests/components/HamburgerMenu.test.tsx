import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HamburgerMenu } from '../../src/components/home/HamburgerMenu';

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog" aria-label="Menu">{children}</div> : null,
}));

vi.mock('../../src/components/modals/CategoryManagerSheet', () => ({
  CategoryManagerSheet: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div role="dialog" aria-label="Categories manager">
      <button type="button" onClick={onClose}>Close categories</button>
    </div> : null,
}));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('opens the warmed Categories manager on its first committed render after menu load', async () => {
  let idleWarm: (() => void) | null = null;
  vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
    idleWarm = () => callback({ didTimeout: false, timeRemaining: () => 50 });
    return 1;
  });
  vi.stubGlobal('cancelIdleCallback', vi.fn());
  render(<HamburgerMenu onOpenBacklog={vi.fn()} onOpenBucketList={vi.fn()} onOpenUncompleted={vi.fn()} />);
  await act(async () => {
    if (!idleWarm) throw new Error('Menu warmup was not scheduled');
    idleWarm();
    const { preloadHamburgerMenuBottomSheet } = await import('../../src/lib/hamburgerMenuLayers');
    await preloadHamburgerMenuBottomSheet();
    await import('../../src/components/ui/BottomSheet');
    await Promise.resolve();
    await Promise.resolve();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  await act(async () => {
    const { preloadHamburgerMenuCategoryManager } = await import('../../src/lib/hamburgerMenuLayers');
    await preloadHamburgerMenuCategoryManager();
    await Promise.resolve();
    await Promise.resolve();
  });
  // Menu content is a separate lazy chunk; its action may appear after the trigger.
  // The nested Categories manager must still mount immediately once clicked.
  fireEvent.click(await screen.findByRole('button', { name: 'Categories' }));
  // Synchronous assertion: a settled import must not first suspend into a null fallback.
  expect(screen.getByRole('dialog', { name: 'Categories manager' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close categories' }));
  expect(screen.queryByRole('dialog', { name: 'Categories manager' })).not.toBeInTheDocument();
});

it('opens the warmed hamburger sheet on its first click without a blank commit', async () => {
  // The actual first-open path warms from Home's idle window, with no hover.
  let idleWarm: (() => void) | null = null;
  vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
    idleWarm = () => callback({ didTimeout: false, timeRemaining: () => 50 });
    return 1;
  });
  vi.stubGlobal('cancelIdleCallback', vi.fn());
  const onOpenBacklog = vi.fn();
  const onOpenUncompleted = vi.fn();
  render(<HamburgerMenu onOpenBacklog={onOpenBacklog} onOpenBucketList={vi.fn()} onOpenUncompleted={onOpenUncompleted} />);
  const menu = screen.getByRole('button', { name: 'Open menu' });
  await act(async () => {
    if (!idleWarm) throw new Error('Menu warmup was not scheduled');
    idleWarm();
    const { preloadHamburgerMenuBottomSheet } = await import('../../src/lib/hamburgerMenuLayers');
    await preloadHamburgerMenuBottomSheet();
    await import('../../src/components/ui/BottomSheet');
    await Promise.resolve();
    await Promise.resolve();
  });
  fireEvent.click(menu);
  expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Backlogs' }));
  expect(onOpenBacklog).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
  fireEvent.click(menu);
  fireEvent.click(screen.getByRole('button', { name: 'Uncompleted Tasks' }));
  expect(onOpenUncompleted).toHaveBeenCalledTimes(1);
});
