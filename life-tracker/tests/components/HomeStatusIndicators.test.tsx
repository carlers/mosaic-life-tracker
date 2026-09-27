import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  online: true,
  sync: {
    isSyncing: false,
    lastSync: '2026-09-27T01:00:00.000Z' as string | null,
    errors: [] as string[],
  },
  readiness: {
    dataReadyAt: '2026-09-27T01:00:00.000Z' as string | null,
    shellReadyAt: '2026-09-27T01:00:00.000Z' as string | null,
    isReady: true,
  },
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_A' } }),
}));
vi.mock('../../src/hooks/useConnectivity', () => ({
  useConnectivity: () => state.online,
}));
vi.mock('../../src/hooks/useSyncStatus', () => ({
  useSyncStatus: () => state.sync,
}));
vi.mock('../../src/hooks/useOfflineReadiness', () => ({
  useOfflineReadiness: () => state.readiness,
}));
vi.mock('../../src/components/modals/SyncStatusSheet', () => ({
  SyncStatusSheet: ({
    isOpen,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) => (isOpen ? <div>Sync status detail</div> : null),
}));

import { HomeStatusIndicators } from '../../src/components/home/HomeStatusIndicators';

describe('HomeStatusIndicators', () => {
  beforeEach(() => {
    state.online = true;
    state.sync = {
      isSyncing: false,
      lastSync: '2026-09-27T01:00:00.000Z',
      errors: [],
    };
    state.readiness = {
      dataReadyAt: '2026-09-27T01:00:00.000Z',
      shellReadyAt: '2026-09-27T01:00:00.000Z',
      isReady: true,
    };
  });

  // Regression: §24.18 (Home exposes connection and sync/readiness status).
  it('exposes online and offline-ready sync state with named controls', () => {
    render(<HomeStatusIndicators />);

    expect(
      screen.getByRole('button', { name: 'Online' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Synced and ready offline' })
    ).toBeInTheDocument();
  });

  it('never presents an active sync while the device is offline', () => {
    state.online = false;
    state.sync = {
      isSyncing: true,
      lastSync: '2026-09-27T01:00:00.000Z',
      errors: [],
    };

    render(<HomeStatusIndicators />);

    expect(
      screen.getByRole('button', { name: 'Offline' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sync paused while offline' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Syncing' })).toBeNull();
  });

  it('opens the shared sync-status surface from the connectivity control', async () => {
    render(<HomeStatusIndicators />);

    fireEvent.click(screen.getByRole('button', { name: 'Online' }));

    expect(await screen.findByText('Sync status detail')).toBeInTheDocument();
  });
});
