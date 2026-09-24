import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const updateMocks = vi.hoisted(() => ({
  checkForUpdate: vi.fn(
    async (onProgress?: (stage: string) => void) => {
      onProgress?.('preparing');
      await Promise.resolve();
      onProgress?.('checking');
      await new Promise((resolve) => setTimeout(resolve, 0));
      onProgress?.('update-found');
      onProgress?.('downloading');
      return 'update-available' as const;
    }
  ),
}));

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
vi.mock('../../src/db/database', () => ({
  destroyDatabase: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/components/modals/AccountSettingsSheet', () => ({ AccountSettingsSheet: () => null }));
vi.mock('../../src/components/modals/ChangeEmailSheet', () => ({ ChangeEmailSheet: () => null }));
vi.mock('../../src/components/modals/ChangePasswordSheet', () => ({ ChangePasswordSheet: () => null }));
vi.mock('../../src/components/modals/ExportDataSheet', () => ({ ExportDataSheet: () => null }));
vi.mock('../../src/components/modals/SyncStatusSheet', () => ({ SyncStatusSheet: () => null }));
vi.mock('../../src/components/settings/AppearanceSettingsSheet', () => ({ AppearanceSettingsSheet: () => null }));

import { SettingsPage } from '../../src/pages/SettingsPage';

// Regression: PROJECT_REFERENCE.md §24.13 — version/update controls precede
// destructive data controls and update checks expose meaningful stages.
describe('SettingsPage release/update controls', () => {
  it('shows version 0.0.1 and places update checking before destructive data controls', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('0.0.1')).toBeInTheDocument();
    const check = screen.getByRole('button', { name: /Check for Updates/i });
    const deletion = screen.getByRole('button', { name: 'Delete All User Data' });
    expect(
      Boolean(
        check.compareDocumentPosition(deletion) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
  });

  it('announces useful progress stages instead of a generic Checking label', async () => {
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
});
