import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';

const statusRef = vi.hoisted(() => ({
  current: {
    isSyncing: false,
    lastSync: null as string | null,
    errors: [] as string[],
  },
}));
const listenersRef = vi.hoisted(() => ({
  current: [] as ((status: unknown) => void)[],
}));
const forceSyncMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../src/lib/syncStatus', () => ({
  getSyncStatus: () => statusRef.current,
  subscribeToSyncStatus: (listener: (status: unknown) => void) => {
    listenersRef.current.push(listener);
    listener(statusRef.current);
    return () => {
      const index = listenersRef.current.indexOf(listener);
      if (index > -1) listenersRef.current.splice(index, 1);
    };
  },
}));
vi.mock('../../src/db/sync', () => ({
  forceSync: forceSyncMock,
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_A' } }),
}));
vi.mock('../../src/hooks/useConnectivity', () => ({
  useConnectivity: () => true,
}));
vi.mock('../../src/hooks/useOfflineReadiness', () => ({
  useOfflineReadiness: () => ({
    dataReadyAt: null,
    shellReadyAt: null,
    isReady: false,
  }),
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
  it('shows first-sync and offline-preparation state when no sync has happened', () => {
    render(<SyncStatusSheet isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Waiting for first sync')).toBeInTheDocument();
    expect(
      screen.getByText('This device has not completed a sync yet.')
    ).toBeInTheDocument();
    expect(screen.getByText('Preparing offline access')).toBeInTheDocument();
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

    expect(screen.getAllByText('Syncing…').length).toBeGreaterThan(0);
  });

  it('updates when the status listener fires after open', () => {
    render(<SyncStatusSheet isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Waiting for first sync')).toBeInTheDocument();

    act(() => {
      statusRef.current = {
        isSyncing: false,
        lastSync: '2026-06-01T00:00:00.000Z',
        errors: ['tasks: late failure'],
      };
      listenersRef.current.forEach((listener) =>
        listener(statusRef.current)
      );
    });

    expect(screen.getByText('1 error')).toBeInTheDocument();
    expect(screen.getByText('tasks: late failure')).toBeInTheDocument();
  });

  it('the Sync Now button calls forceSync for the active user and disables itself for 2s', async () => {
    vi.useFakeTimers();
    try {
      render(<SyncStatusSheet isOpen onClose={vi.fn()} />);
      const button = screen.getByText('Sync Now').closest('button');
      expect(button).not.toBeNull();
      expect(button).not.toBeDisabled();

      fireEvent.click(button as Element);
      await vi.runAllTicks();

      await waitFor(() =>
        expect(forceSyncMock).toHaveBeenCalledWith('user_A')
      );
      expect(button).toBeDisabled();

      fireEvent.click(button as Element);
      expect(forceSyncMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });
      expect(button).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
