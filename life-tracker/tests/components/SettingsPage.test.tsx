import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  logout: vi.fn<() => Promise<boolean>>(),
  deleteAccount: vi.fn<(confirmation: string) => Promise<boolean>>(),
}));

const updateMocks = vi.hoisted(() => ({
  applyUpdate: vi.fn<() => Promise<boolean>>(),
  checkForUpdate: vi.fn<
    (onProgress?: (stage: string) => void) => Promise<
      'up-to-date' | 'update-available' | 'update-in-progress'
    >
  >(),
  updateAvailable: false,
}));
beforeEach(() => {
  updateMocks.applyUpdate.mockReset().mockResolvedValue(true);
  updateMocks.checkForUpdate.mockReset().mockResolvedValue('up-to-date');
  updateMocks.updateAvailable = false;
  authMocks.logout.mockReset().mockResolvedValue(true);
  authMocks.deleteAccount.mockReset().mockResolvedValue(true);
  window.localStorage.clear();
});

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { $id: 'user_1', email: 'user@example.com' },
    logout: authMocks.logout,
    deleteAccount: authMocks.deleteAccount,
  }),
}));
vi.mock('../../src/hooks/usePwaLifecycle', () => ({
  usePwaLifecycle: () => ({
    applyUpdate: updateMocks.applyUpdate,
    checkForUpdate: updateMocks.checkForUpdate,
    updateAvailable: updateMocks.updateAvailable,
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
vi.mock('../../src/lib/buildInfo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/buildInfo')>();
  return {
    ...actual,
    APP_BUILD_INFO: {
      ...actual.APP_BUILD_INFO,
      commitMessage: 'feat: add alerts\n\n- Send friend notifications\n- Improve loading',
    },
  };
});
import { SettingsPage } from '../../src/pages/SettingsPage';
import { APP_VERSION } from '../../src/lib/appVersion';

// Regression: §24.13 (update checks expose meaningful stages).
describe('SettingsPage navigation, updates, and data controls', () => {
  it('separates working settings from future destinations and keeps data actions discoverable', () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);

    const available = screen.getByRole('region', { name: 'Account & preferences' });
    expect(within(available).getByRole('button', { name: /Profile/i })).toBeEnabled();
    expect(within(available).getByRole('button', { name: /Account/i })).toBeEnabled();
    expect(within(available).getByRole('button', { name: /Preferences/i })).toBeEnabled();
    expect(within(available).getByRole('button', { name: /Notifications/i })).toBeEnabled();

    const upcoming = screen.getByRole('region', { name: 'Coming soon' });
    for (const label of ['Privacy', 'App Permissions', 'Announcements',
      'My stickers', 'Information', 'FAQs']) {
      expect(within(upcoming).getByRole('button', {
        name: new RegExp(label + ' Coming soon', 'i'),
      })).toBeInTheDocument();
    }
    fireEvent.click(within(upcoming).getByRole('button', { name: /App Permissions/i }));
    expect(screen.getByRole('status')).toHaveTextContent('Coming soon');

    const data = screen.getByRole('region', { name: 'Data & sync' });
    expect(within(data).getByRole('button', { name: 'Sync Status' })).toBeEnabled();
    expect(within(data).getByRole('button', { name: 'Backup & Restore' })).toBeEnabled();
    expect(within(data).getByLabelText('Backup activity')).toHaveTextContent('Last backup: Never');
    expect(within(data).getByRole('button', { name: 'Import from TodoMate' })).toBeEnabled();

    const about = screen.getByRole('region', { name: 'About & updates' });
    expect(within(about).getByText('Version')).toBeInTheDocument();
    expect(within(about).getByRole('button', { name: /Check for Updates/i })).toBeEnabled();
    const safety = screen.getByRole('region', { name: 'Data deletion' });
    expect(within(safety).getByRole('button', { name: 'Delete Account' })).toBeEnabled();
    expect(within(safety).getByRole('button', { name: 'Clear Local Data' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeEnabled();
  });

  it('shows the app version and a dedicated update control', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    const versionToggle = screen.getByText('Version').closest('summary');
    expect(versionToggle).not.toBeNull();
    expect(screen.getByText(APP_VERSION)).toBeInTheDocument();
    const versionDetails = screen.getByTestId('app-version-details');
    expect(versionDetails).not.toHaveAttribute('open');
    expect(screen.getByTestId('app-build-info')).not.toBeVisible();

    fireEvent.click(versionToggle!);
    expect(versionDetails).toHaveAttribute('open');
    expect(screen.getByTestId('app-build-info')).toBeVisible();
    expect(screen.getByTestId('app-build-info')).toHaveTextContent(/appwrite: production|appwrite: scratch|appwrite: custom|appwrite: unknown/);
    expect(screen.getByTestId('app-build-info')).toHaveTextContent(/branch: local/);
    expect(screen.getByTestId('app-build-info')).toHaveTextContent(/commit: local/);

    fireEvent.click(versionToggle!);
    expect(versionDetails).not.toHaveAttribute('open');
    expect(screen.getByText(APP_VERSION)).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Check for Updates/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Backup & Restore' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Import from TodoMate' })
    ).toBeInTheDocument();
  });

  it('expands and collapses the full deployment commit message within Version details', () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    const versionDetails = screen.getByTestId('app-version-details');
    fireEvent.click(screen.getByText('Version').closest('summary')!);
    expect(versionDetails).toHaveAttribute('open');
    const summary = screen.getByText('message: feat: add alerts').closest('summary');
    expect(summary).not.toBeNull();
    const details = summary!.closest('details');
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(summary!);
    expect(details).toHaveAttribute('open');
    expect(details).toHaveTextContent('- Send friend notifications');
    expect(details).toHaveTextContent('- Improve loading');
    fireEvent.click(summary!);
    expect(details).not.toHaveAttribute('open');
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
    expect(
      screen.getByRole('button', { name: /Update now/i })
    ).toBeInTheDocument();
  });

  it('keeps a long-running update download honest after the foreground wait ends', async () => {
    updateMocks.checkForUpdate.mockImplementationOnce(async (onProgress) => {
      onProgress?.('downloading');
      onProgress?.('background-download');
      return 'update-in-progress';
    });
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Check for Updates/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Update is still downloading in the background.'
    );
  });

  it('turns the update row into the install action when a worker is ready', async () => {
    updateMocks.updateAvailable = true;
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Update now/i }));

    await waitFor(() => expect(updateMocks.applyUpdate).toHaveBeenCalledOnce());
    expect(updateMocks.checkForUpdate).not.toHaveBeenCalled();
  });

  // Regression: explicit account erasure requires typed confirmation and stays
  // distinct from the local-only clear action.
  it('requires DELETE before requesting permanent account deletion', async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));

    const dialog = screen.getByRole('dialog', { name: 'Delete Account' });
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByText(/messages exchanged with friends/i)
    ).toBeInTheDocument();

    const confirm = within(dialog).getByLabelText('Type DELETE to confirm');
    const deleteButton = within(dialog).getByRole('button', {
      name: 'Delete Account',
    });
    expect(deleteButton).toBeDisabled();

    fireEvent.change(confirm, { target: { value: 'delete' } });
    expect(deleteButton).toBeDisabled();

    fireEvent.change(confirm, { target: { value: 'DELETE' } });
    expect(deleteButton).toBeEnabled();
    fireEvent.click(deleteButton);

    await waitFor(() =>
      expect(authMocks.deleteAccount).toHaveBeenCalledWith('DELETE')
    );
    expect(authMocks.logout).not.toHaveBeenCalled();
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
