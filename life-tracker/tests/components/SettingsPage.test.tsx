import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateMocks = vi.hoisted(() => ({
  checkForUpdate: vi.fn<(onProgress?: (stage: string) => void) => Promise<'up-to-date' | 'update-available'>>(),
  requestInstall: vi.fn<() => Promise<'accepted' | 'dismissed' | 'unavailable'>>(),
  installed: false,
}));
beforeEach(() => {
  updateMocks.checkForUpdate.mockReset().mockResolvedValue('up-to-date');
  updateMocks.requestInstall.mockReset().mockResolvedValue('accepted');
  updateMocks.installed = false;
  window.localStorage.clear();
});

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { $id: 'user_1', email: 'user@example.com' },
    logout: vi.fn().mockResolvedValue(true),
  }),
}));
vi.mock('../../src/hooks/usePwaLifecycle', () => ({
  usePwaLifecycle: () => ({
    checkForUpdate: updateMocks.checkForUpdate,
    requestInstall: updateMocks.requestInstall,
    installed: updateMocks.installed,
  }),
}));
vi.mock('../../src/hooks/useAppearance', () => ({
  useAppearance: () => ({
    mode: 'system',
    resolvedTheme: 'dark',
    setAppearanceMode: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock('../../src/db/database', () => ({
  destroyDatabase: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/components/modals/AccountSettingsSheet', () => ({ AccountSettingsSheet: () => null }));
vi.mock('../../src/components/modals/ChangeEmailSheet', () => ({ ChangeEmailSheet: () => null }));
vi.mock('../../src/components/modals/ChangePasswordSheet', () => ({ ChangePasswordSheet: () => null }));
vi.mock('../../src/components/modals/TodoMateImportSheet', () => ({
  TodoMateImportSheet: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div>TodoMate import sheet</div> : null,
}));
vi.mock('../../src/components/modals/ExportDataSheet', () => ({
  ExportDataSheet: ({
    isOpen,
    onBackupComplete,
    onRestoreComplete,
  }: {
    isOpen: boolean;
    onBackupComplete?: (completedAt: string) => void;
    onRestoreComplete?: (completedAt: string) => void;
  }) =>
    isOpen ? (
      <div>
        <button
          type="button"
          onClick={() => onBackupComplete?.('2026-09-27T01:00:00.000Z')}
        >
          Complete backup test
        </button>
        <button
          type="button"
          onClick={() => onRestoreComplete?.('2026-09-27T02:00:00.000Z')}
        >
          Complete restore test
        </button>
      </div>
    ) : null,
}));
vi.mock('../../src/components/modals/SyncStatusSheet', () => ({ SyncStatusSheet: () => null }));
vi.mock('../../src/lib/deleteUserData', () => ({
  deleteAllUserData: vi.fn().mockResolvedValue({ totalRows: 0 }),
}));

import { SettingsPage } from '../../src/pages/SettingsPage';

// Regression: §24.13 (update checks expose meaningful stages and PWA install state).
describe('SettingsPage navigation, updates, and data controls', () => {
  it('shows the app version and dedicated update/install controls', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('0.1.0')).toBeInTheDocument();
    expect(screen.getByTestId('app-build-info')).toHaveTextContent(/branch: local/);
    expect(screen.getByTestId('app-build-info')).toHaveTextContent(/commit: local/);
    expect(
      screen.getByRole('button', { name: /Check for Updates/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Install App' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Backup & Restore' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Import from TodoMate' })
    ).toBeInTheDocument();
  });

  it('requests PWA installation from the dedicated Settings control', async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Install App' }));

    await waitFor(() => expect(updateMocks.requestInstall).toHaveBeenCalledOnce());
  });

  it('shows Already installed instead of an install action for an installed PWA', () => {
    updateMocks.installed = true;

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Already installed' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install App' })).toBeNull();
  });

  it('opens the TodoMate transfer surface from Settings', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Import from TodoMate' }));

    expect(screen.getByText('TodoMate import sheet')).toBeInTheDocument();
  });

  it('shows and updates the last backup and restore activity', async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Last backup: Never')).toBeInTheDocument();
    expect(screen.getByText('Last restore: Never')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Backup & Restore' }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete backup test' }));

    expect(screen.getByText(/Last backup:.*2026/)).toBeInTheDocument();
    expect(screen.getByText('Last restore: Never')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Complete restore test' }));

    expect(screen.getByText(/Last restore:.*2026/)).toBeInTheDocument();
  });

  it('announces useful progress stages instead of a generic Checking label', async () => {
    updateMocks.checkForUpdate.mockImplementationOnce(async (onProgress) => {
      onProgress?.('preparing');
      await Promise.resolve();
      onProgress?.('checking');
      await new Promise((resolve) => setTimeout(resolve, 0));
      onProgress?.('update-found');
      onProgress?.('downloading');
      return 'update-available';
    });
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Check for Updates/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      /Preparing update check|Checking for a new version|Update found|Downloading update/
    );
    await waitFor(() =>
      expect(updateMocks.checkForUpdate).toHaveBeenCalledOnce()
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Update (downloaded|ready|found)/
    );
  });

  // Regression: §2 (remote deletion remains distinct from local clearing).
  it('offers Delete All User Data as a separate destructive confirmation', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete All User Data' }));

    expect(screen.getByRole('dialog', { name: 'Delete All User Data' })).toBeInTheDocument();
    expect(screen.getByText(/does not delete your login account/i)).toBeInTheDocument();
  });

  // Regression: §24.13 (app-update checks are independent from data sync).
  it('offers a dedicated update check and reports an up-to-date result', async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Check for Updates/i }));

    expect(updateMocks.checkForUpdate).toHaveBeenCalledOnce();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Mosaic is up to date.'
    );
  });

  // Regression: §2 (Preferences is the Settings child route for behavior and display choices).
  it('opens the Preferences route instead of exposing behavior toggles on Settings', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/preferences" element={<div>Preferences route</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Preferences/i }));

    expect(screen.getByText('Preferences route')).toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: 'Keep adding in same category' })
    ).toBeNull();
  });
});
