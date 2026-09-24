import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { $id: 'user_1', email: 'user@example.com' },
    logout: vi.fn().mockResolvedValue(true),
  }),
}));
vi.mock('../../src/hooks/usePwaLifecycle', () => ({
  usePwaLifecycle: () => ({ checkForUpdate: vi.fn().mockResolvedValue('up-to-date') }),
}));
vi.mock('../../src/hooks/useAppearance', () => ({
  useAppearance: () => ({
    mode: 'system',
    resolvedTheme: 'dark',
    setAppearanceMode: vi.fn().mockResolvedValue(undefined),
    contentWidthMode: 'full',
    sheetWidthMode: 'full',
    setContentWidthMode: vi.fn().mockResolvedValue(undefined),
    setSheetWidthMode: vi.fn().mockResolvedValue(undefined),
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

import { SettingsPage } from '../../src/pages/SettingsPage';

describe('SettingsPage screen navigation', () => {
  // Regression: task acceptance — Screen is a real Settings child page, not a BottomSheet.
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
