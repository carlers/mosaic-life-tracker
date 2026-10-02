import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  setAppearanceMode: vi.fn().mockResolvedValue(undefined),
  setContentWidthMode: vi.fn().mockResolvedValue(undefined),
  setSheetWidthMode: vi.fn().mockResolvedValue(undefined),
  getSetting: vi.fn(),
  setSetting: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  mocks.setAppearanceMode.mockClear();
  mocks.setContentWidthMode.mockClear();
  mocks.setSheetWidthMode.mockClear();
  mocks.setSetting.mockClear();
  mocks.getSetting.mockImplementation((key: string, defaultValue?: unknown) => {
    if (key === 'weekStartsOnSunday') return true;
    return defaultValue;
  });
});

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

vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: mocks.getSetting,
    setSetting: mocks.setSetting,
  }),
}));

import { PreferencesPage } from '../../src/pages/PreferencesPage';

describe('PreferencesPage', () => {
  // Regression: §2 (Preferences owns display/layout and synced behavior controls).
  it('exposes existing screen choices and the requested behavior preferences', () => {
    render(
      <MemoryRouter>
        <PreferencesPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /^Light/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Comfortable/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Compact/ }));

    expect(mocks.setAppearanceMode).toHaveBeenCalledWith('light');
    expect(mocks.setContentWidthMode).toHaveBeenCalledWith('comfortable');
    expect(mocks.setSheetWidthMode).toHaveBeenCalledWith('compact');

    const continuous = screen.getByRole('switch', {
      name: 'Keep adding in same category',
    });
    const taskPosition = screen.getByRole('switch', {
      name: 'Add new tasks to top',
    });
    const sunday = screen.getByRole('switch', {
      name: 'Start week on Sunday',
    });
    const collapse = screen.getByRole('switch', {
      name: 'Show collapse button for categories',
    });
    const todayTag = screen.getByRole('switch', {
      name: 'Show Today tag beside date header',
    });

    expect(continuous).toHaveAttribute('aria-checked', 'false');
    expect(taskPosition).toHaveAttribute('aria-checked', 'false');
    expect(sunday).toHaveAttribute('aria-checked', 'true');
    expect(collapse).toHaveAttribute('aria-checked', 'false');
    expect(todayTag).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(continuous);
    fireEvent.click(taskPosition);
    fireEvent.click(sunday);
    fireEvent.click(collapse);
    fireEvent.click(todayTag);

    expect(mocks.setSetting).toHaveBeenCalledWith('continueAddingTasks', true);
    expect(mocks.setSetting).toHaveBeenCalledWith('addTasksToTop', true);
    expect(mocks.setSetting).toHaveBeenCalledWith('weekStartsOnSunday', false);
    expect(mocks.setSetting).toHaveBeenCalledWith('showCategoryCollapseButton', true);
    expect(mocks.setSetting).toHaveBeenCalledWith('showDayViewTodayTag', true);
  });
});
