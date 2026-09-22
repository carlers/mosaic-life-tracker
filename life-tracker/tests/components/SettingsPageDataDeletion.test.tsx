// Regression: PROJECT_REFERENCE.md §2 — remote-data deletion is distinct from local clearing.
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { $id: 'user_1', email: 'user@example.com' },
    logout: vi.fn().mockResolvedValue(true),
  }),
}));
vi.mock('../../src/components/ui/SettingsRow', () => ({
  SettingsRow: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}>{label}</button>
  ),
}));
vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, title, children }: { isOpen: boolean; title?: string; children: React.ReactNode }) =>
    isOpen ? <section aria-label={title}>{children}</section> : null,
}));
vi.mock('../../src/components/modals/AccountSettingsSheet', () => ({ AccountSettingsSheet: () => null }));
vi.mock('../../src/components/modals/ChangeEmailSheet', () => ({ ChangeEmailSheet: () => null }));
vi.mock('../../src/components/modals/ChangePasswordSheet', () => ({ ChangePasswordSheet: () => null }));
vi.mock('../../src/components/modals/ExportDataSheet', () => ({ ExportDataSheet: () => null }));
vi.mock('../../src/components/modals/SyncStatusSheet', () => ({ SyncStatusSheet: () => null }));
vi.mock('../../src/db/database', () => ({ destroyDatabase: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../src/lib/deleteUserData', () => ({
  deleteAllUserData: vi.fn().mockResolvedValue({ totalRows: 0 }),
}));

import { SettingsPage } from '../../src/pages/SettingsPage';

describe('SettingsPage data deletion', () => {
  it('offers Delete All User Data as a separate destructive confirmation', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete All User Data' }));

    expect(screen.getByRole('region', { name: 'Delete All User Data' })).toBeInTheDocument();
    expect(screen.getByText(/does not delete your login account/i)).toBeInTheDocument();
  });
});
