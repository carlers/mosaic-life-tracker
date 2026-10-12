import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HamburgerMenu } from '../../src/components/home/HamburgerMenu';

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog" aria-label="Menu">{children}</div> : null,
}));

afterEach(() => { vi.restoreAllMocks(); });

it('opens the warmed hamburger sheet on its first click without a blank commit', async () => {
  const onOpenBacklog = vi.fn();
  render(<HamburgerMenu onOpenBacklog={onOpenBacklog} onOpenBucketList={vi.fn()} />);
  const menu = screen.getByRole('button', { name: 'Open menu' });
  fireEvent.mouseEnter(menu);
  await act(async () => {
    await import('../../src/components/ui/BottomSheet');
    await Promise.resolve();
    await Promise.resolve();
  });
  fireEvent.click(menu);
  expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Backlogs' }));
  expect(onOpenBacklog).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
});
