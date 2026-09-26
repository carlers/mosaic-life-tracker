import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateMocks = vi.hoisted(() => ({
  checkForUpdate: vi.fn<(onProgress?: (stage: string) => void) => Promise<'up-to-date' | 'update-available'>>(),
}));
const settingsMocks = vi.hoisted(() => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}));

beforeEach(() => {
  updateMocks.checkForUpdate.mockReset().mockResolvedValue('up-to-date');
  settingsMocks.getSetting.mockReset().mockReturnValue(false);
  settingsMocks.setSetting.mockReset().mockResolvedValue(undefined);
});

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { $id: 'user_1', email: 'user@example.com' },
    logout: vi.fn().mockResolvedValue(true),
  }),
}));
vi.mock('../../src/hooks/usePwaLifecycle', () => ({
  usePwaLifecycle: () => ({ checkForUpdate: updateMocks.checkForUpdate }),
}));
vi.mock('../../src/hooks/useAppearance', () => ({
  useAppearance: () => ({
    mode: 'system',
    resolvedTheme: 'dark',
    setAppearanceMode: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: settingsMocks.getSetting,
    setSetting: settingsMocks.setSetting,
  }),
}));
vi.mock('../../src/db/database', () => ({
  destroyDatabase: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/components/modals/AccountSettingsSheet', () => ({ AccountSettingsSheet: () => null }));
vi.mock('../../src/components/modals/ChangeEmailSheet', () => ({ ChangeEmailSheet: () => null }));
vi.mock('../../src/components/modals/ChangePasswordSheet', () => ({ ChangePasswordSheet: () => null }));
vi.mock('../../src/components/modals/ExportDataSheet', () => ({ ExportDataSheet: () => null }));
vi.mock('../../src/components/modals/SyncStatusSheet', () => ({ SyncStatusSheet: () => null }));
vi.mock('../../src/lib/deleteUserData', () => ({
  deleteAllUserData: vi.fn().mockResolvedValue({ totalRows: 0 }),
}));

import { SettingsPage } from '../../src/pages/SettingsPage';
import { CONTINUE_ADDING_TASKS_SETTING_KEY } from '../../src/lib/taskCreationPreferences';

// Regression: PROJECT_REFERENCE.md §24.13 — version/update controls precede
// destructive data controls and update checks expose meaningful stages.
describe('SettingsPage navigation, updates, and data controls', () => {
  it('shows version 0.1.0 and places update checking before destructive data controls', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('0.1.0')).toBeInTheDocument();
    expect(screen.getByTestId('app-build-info')).toHaveTextContent(/branch: local/);
    expect(screen.getByTestId('app-build-info')).toHaveTextContent(/commit: local/);
    const check = screen.getByRole('button', { name: /Check for Updates/i });
    const deletion = screen.getByRole('button', { name: 'Delete All User Data' });
    expect(
      Boolean(
        check.compareDocumentPosition(deletion) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
  });

  // Regression: PROJECT_REFERENCE.md §2 — continuous task entry is a synced Settings toggle.
  it('toggles continuous task entry for the same category', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    const toggle = screen.getByRole('switch', {
      name: 'Keep adding in same category',
    });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);

    expect(settingsMocks.setSetting).toHaveBeenCalledWith(
      CONTINUE_ADDING_TASKS_SETTING_KEY,
      true
    );
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

  // Regression: PROJECT_REFERENCE.md §2 — remote deletion is distinct from local clearing.
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

  // Regression: PROJECT_REFERENCE.md §24.13 — update checks are not data sync.
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

  // Regression: task acceptance — Screen is a Settings child route, not an appearance sheet.
  it('opens the Screen route instead of an appearance dialog', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/screen" element={<div>Screen settings route</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Screen/i }));

    expect(screen.getByText('Screen settings route')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Appearance' })).toBeNull();
  });
});
