import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const appearanceMocks = vi.hoisted(() => ({
  setAppearanceMode: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { $id: 'user_1', email: 'user@example.com' },
    logout: vi.fn().mockResolvedValue(true),
  }),
}));
vi.mock('../../src/hooks/usePwaLifecycle', () => ({
  usePwaLifecycle: () => ({ checkForUpdate: vi.fn().mockResolvedValue('up-to-date') }),
}));
vi.mock('../../src/hooks/AppearanceProvider', () => ({
  useAppearance: () => ({
    mode: 'system',
    resolvedTheme: 'dark',
    setAppearanceMode: appearanceMocks.setAppearanceMode,
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

describe('SettingsPage appearance', () => {
  // Regression: PROJECT_REFERENCE.md §2 — Settings exposes all four functional appearance choices.
  it('opens Screen appearance controls and applies the selected mode', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Screen/i }));

    expect(screen.getByRole('dialog', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'System' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Black' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(appearanceMocks.setAppearanceMode).toHaveBeenCalledWith('light');
  });
});
