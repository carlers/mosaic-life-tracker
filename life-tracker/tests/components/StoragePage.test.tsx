import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  usage: vi.fn(),
  clear: vi.fn(),
  cloud: vi.fn(),
  currentUser: 'owner-a',
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: mocks.currentUser } }),
}));
vi.mock('../../src/lib/deviceStorageUsage', () => ({ readDeviceStorageUsage: mocks.usage }));
vi.mock('../../src/lib/imageCache', () => ({ clearAllCachedImages: mocks.clear }));
vi.mock('../../src/lib/cloudMediaUsage', () => ({ scanOwnerReferencedCloudMedia: mocks.cloud }));
vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));
import { StoragePage } from '../../src/pages/StoragePage';

beforeEach(() => {
  mocks.clear.mockReset().mockResolvedValue(undefined);
  mocks.cloud.mockReset().mockImplementation(async (ownerId: string) => ({
    ownerId, checkedAt: '2026-10-31T00:00:00.000Z',
    verified: { bytes: 100, count: 1 },
    byKind: { tasks: { bytes: 100, count: 1 }, diary: { bytes: 0, count: 0 }, profile: { bytes: 0, count: 0 }, multiple: { bytes: 0, count: 0 } },
    largest: [{ kind: 'tasks', bytes: 100 }], unavailable: 0, truncated: false, coverage: 'referenced-media-only',
  }));
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

  it('only requests cloud metadata after explicit input, preserving account isolation', async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/settings/data/storage']}><StoragePage /></MemoryRouter>
    );
    expect(mocks.cloud).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Check referenced cloud photos' }));
    await waitFor(() => expect(mocks.cloud).toHaveBeenCalledExactlyOnceWith('owner-a', expect.any(AbortSignal)));
    expect(await screen.findByText('Verified referenced subtotal')).toBeInTheDocument();
    expect(screen.getAllByText('100 B').length).toBeGreaterThan(0);
    expect(screen.getByText(/Unreferenced, missing and chat files are excluded/)).toBeInTheDocument();
    mocks.currentUser = 'owner-b';
    rerender(<MemoryRouter initialEntries={['/settings/data/storage']}><StoragePage /></MemoryRouter>);
    expect(screen.queryByText('Verified referenced subtotal')).toBeNull();
  });

  it('aborts the active scan when the signed-in account changes', async () => {
    let observedSignal: AbortSignal | undefined;
    mocks.cloud.mockImplementationOnce((_ownerId: string, signal: AbortSignal) => {
      observedSignal = signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
      });
    });
    const { rerender } = render(<MemoryRouter initialEntries={['/settings/data/storage']}><StoragePage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Check referenced cloud photos' }));
    await waitFor(() => expect(observedSignal).toBeDefined());
    mocks.currentUser = 'owner-b';
    rerender(<MemoryRouter initialEntries={['/settings/data/storage']}><StoragePage /></MemoryRouter>);
    await waitFor(() => expect(observedSignal?.aborted).toBe(true));
    expect(screen.queryByText('Verified referenced subtotal')).toBeNull();
    expect(screen.queryByText('Cloud photos could not be checked. Verify your connection and sign-in.')).toBeNull();
  });

  it('reports cloud file failures as partial without offering cloud deletion', async () => {
    mocks.cloud.mockResolvedValueOnce({
      ownerId: 'owner-a', checkedAt: '2026-10-31T00:00:00.000Z',
      verified: { count: 0, bytes: 0 },
      byKind: { tasks: { count: 0, bytes: 0 }, diary: { count: 0, bytes: 0 }, profile: { count: 0, bytes: 0 }, multiple: { count: 0, bytes: 0 } },
      largest: [], unavailable: 2, truncated: true, coverage: 'referenced-media-only',
    });
    render(<MemoryRouter initialEntries={['/settings/data/storage']}><StoragePage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Check referenced cloud photos' }));
    expect(await screen.findByText(/Partial inventory: additional referenced files/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete cloud/i })).toBeNull();
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
