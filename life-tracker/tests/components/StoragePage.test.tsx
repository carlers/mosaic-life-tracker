import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  usage: vi.fn(),
  clear: vi.fn(),
  currentUser: 'owner-a',
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: mocks.currentUser } }),
}));
vi.mock('../../src/lib/deviceStorageUsage', () => ({ readDeviceStorageUsage: mocks.usage }));
vi.mock('../../src/lib/imageCache', () => ({ clearAllCachedImages: mocks.clear }));
vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));
import { StoragePage } from '../../src/pages/StoragePage';

beforeEach(() => {
  mocks.clear.mockReset().mockResolvedValue(undefined);
  mocks.currentUser = 'owner-a';
  mocks.usage.mockReset().mockImplementation(async (ownerId: string) => ({
    ownerId,
    origin: { usedBytes: 900, quotaBytes: 3000 },
    persistent: false,
    downloadedImages: { bytes: 200, count: 2 },
    pendingImages: { bytes: 75, count: 1 },
  }));
});

describe('Storage page safe device cleanup', () => {
  it('labels estimates and account/device distinctions and requires confirmation', async () => {
    render(<MemoryRouter initialEntries={['/settings/data/storage']}><StoragePage /></MemoryRouter>);
    expect(await screen.findByText(/Estimated browser storage used/)).toBeInTheDocument();
    expect(screen.getByText(/Downloaded images \(all accounts on this device\)/)).toBeInTheDocument();
    expect(screen.getByText(/Pending photo uploads \(this account\)/)).toBeInTheDocument();
    const open = screen.getByRole('button', { name: 'Clear downloaded images' });
    expect(open).toBeEnabled();
    fireEvent.click(open);
    expect(screen.getByRole('dialog')).toHaveTextContent('Pending uploads, tasks, Diary and app files are kept.');
    expect(mocks.clear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(open);
    fireEvent.click(screen.getByRole('button', { name: 'Clear cache' }));
    await waitFor(() => expect(mocks.clear).toHaveBeenCalledTimes(1));
    expect(mocks.usage).toHaveBeenCalledWith('owner-a');
  });

  it('never offers a cache clear when inventory is unavailable', async () => {
    mocks.usage.mockResolvedValueOnce({
      ownerId: 'owner-a', origin: null, persistent: null,
      downloadedImages: null, pendingImages: null,
    });
    render(<MemoryRouter initialEntries={['/settings/data/storage']}><StoragePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clear downloaded images' })).toBeDisabled());
    expect(mocks.clear).not.toHaveBeenCalled();
  });
});
