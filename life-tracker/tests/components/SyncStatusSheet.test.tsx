import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
const statusRef = vi.hoisted(() => ({
  current: {
    isSyncing: false,
    lastSync: null as string | null,
    errors: [] as string[],
  },
}));
const listenersRef = vi.hoisted(() => ({
  current: [] as ((s: unknown) => void)[],
}));
const forceSyncMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../../src/db/sync', () => ({
  getSyncStatus: () => statusRef.current,
  subscribeToSyncStatus: (listener: (s: unknown) => void) => {
    listenersRef.current.push(listener);
    listener(statusRef.current);
    return () => {
      const idx = listenersRef.current.indexOf(listener);
      if (idx > -1) listenersRef.current.splice(idx, 1);
    };
  },
  forceSync: forceSyncMock,
}));
import { SyncStatusSheet } from '../../src/components/modals/SyncStatusSheet';
beforeEach(() => {
  statusRef.current = { isSyncing: false, lastSync: null, errors: [] };
  listenersRef.current = [];
  forceSyncMock.mockReset();
  forceSyncMock.mockResolvedValue(undefined);
  document.body.style.overflow = '';
});
describe('SyncStatusSheet', () => {
  it('shows "Up to date" and "Never" when no sync has happened', () => {
    render(<SyncStatusSheet isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Up to date')).toBeInTheDocument();
    expect(screen.getByText('Last synced Never')).toBeInTheDocument();
  });
  it('shows the error count and lists every error when errors exist', () => {
    statusRef.current = {
      isSyncing: false,
      lastSync: '2026-01-01T00:00:00.000Z',
      errors: ['tasks: boom', 'diary: boom'],
    };
    render(<SyncStatusSheet isOpen onClose={vi.fn()} />);
    expect(screen.getByText('2 errors')).toBeInTheDocument();
    expect(screen.getByText('tasks: boom')).toBeInTheDocument();
    expect(screen.getByText('diary: boom')).toBeInTheDocument();
  });
  it('shows "Syncing…" while isSyncing is true', () => {
    statusRef.current = {
      isSyncing: true,
      lastSync: null,
      errors: [],
    };
    render(<SyncStatusSheet isOpen onClose={vi.fn()} />);
    // The status line and the manual-sync button both render "Syncing…".
    expect(screen.getAllByText('Syncing…').length).toBeGreaterThan(0);
  });
  it('updates when the status listener fires after open', () => {
    render(<SyncStatusSheet isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Up to date')).toBeInTheDocument();
    act(() => {
      statusRef.current = {
        isSyncing: false,
        lastSync: '2026-06-01T00:00:00.000Z',
        errors: ['tasks: late failure'],
      };
      listenersRef.current.forEach((l) => l(statusRef.current));
    });
    expect(screen.getByText('1 error')).toBeInTheDocument();
    expect(screen.getByText('tasks: late failure')).toBeInTheDocument();
  });
  it('the Sync Now button calls forceSync and disables itself for 2s', async () => {
    vi.useFakeTimers();
    try {
      render(<SyncStatusSheet isOpen onClose={vi.fn()} />);
      const button = screen.getByText('Sync Now').closest('button');
      expect(button).not.toBeNull();
      expect(button).not.toBeDisabled();
      fireEvent.click(button as Element);
      expect(forceSyncMock).toHaveBeenCalledTimes(1);
      // Immediately disabled after the click.
      expect(button).toBeDisabled();
      // A second click within the cooldown is a no-op.
      fireEvent.click(button as Element);
      expect(forceSyncMock).toHaveBeenCalledTimes(1);
      // After the 2s cooldown the button re-enables.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });
      expect(button).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
