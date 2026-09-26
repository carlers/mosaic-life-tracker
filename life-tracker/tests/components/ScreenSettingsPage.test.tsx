import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  setAppearanceMode: vi.fn().mockResolvedValue(undefined),
  setContentWidthMode: vi.fn().mockResolvedValue(undefined),
  setSheetWidthMode: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/hooks/useAppearance', () => ({
  useAppearance: () => ({
    mode: 'system',
    resolvedTheme: 'dark',
    setAppearanceMode: mocks.setAppearanceMode,
    contentWidthMode: 'full',
    sheetWidthMode: 'full',
    setContentWidthMode: mocks.setContentWidthMode,
    setSheetWidthMode: mocks.setSheetWidthMode,
  }),
}));

import { ScreenSettingsPage } from '../../src/pages/ScreenSettingsPage';

describe('ScreenSettingsPage', () => {
  // Regression: task acceptance — Screen owns appearance plus large-screen width preferences.
  it('exposes appearance, content-width, and bottom-sheet choices', () => {
    render(
      <MemoryRouter>
        <ScreenSettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Screen' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /^Light/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Comfortable/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Wide/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Compact/ }));

    expect(mocks.setAppearanceMode).toHaveBeenCalledWith('light');
    expect(mocks.setContentWidthMode).toHaveBeenCalledWith('comfortable');
    expect(mocks.setContentWidthMode).toHaveBeenCalledWith('wide');
    expect(mocks.setSheetWidthMode).toHaveBeenCalledWith('compact');
    expect(screen.getByText(/70%/i)).toBeInTheDocument();
    expect(screen.getByText(/85%/i)).toBeInTheDocument();
    expect(screen.getByText(/540px/i)).toBeInTheDocument();
  });
});
