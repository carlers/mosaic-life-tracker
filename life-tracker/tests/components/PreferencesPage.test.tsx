import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  setAppearanceMode: vi.fn().mockResolvedValue(undefined),
  setReduceAnimations: vi.fn().mockResolvedValue(undefined),
  setAccentColor: vi.fn().mockResolvedValue(undefined),
  setContentWidthMode: vi.fn().mockResolvedValue(undefined),
  setSheetWidthMode: vi.fn().mockResolvedValue(undefined),
  getSetting: vi.fn(),
  setSetting: vi.fn().mockResolvedValue(undefined),

}));

beforeEach(() => {
  mocks.setAppearanceMode.mockClear();
  mocks.setReduceAnimations.mockClear();
  mocks.setAccentColor.mockClear();
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
    reduceAnimations: false,
    setReduceAnimations: mocks.setReduceAnimations,
    accentColor: '#10B981',
    setAccentColor: mocks.setAccentColor,
    contentWidthMode: 'full',
    sheetWidthMode: 'full',
    setContentWidthMode: mocks.setContentWidthMode,
    setSheetWidthMode: mocks.setSheetWidthMode,
  }),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'test-user' } }),
}));

vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: mocks.getSetting,
    setSetting: mocks.setSetting,
  }),
}));

vi.mock('../../src/hooks/useHolidays', () => ({
  useHolidayCountries: () => [
    { countryCode: 'PH', name: 'Philippines' },
    { countryCode: 'US', name: 'United States' },
  ],
}));

import { PreferencesPage } from '../../src/pages/PreferencesPage';


function choosePreference(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: new RegExp('^' + label + ':') }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}

describe('PreferencesPage', () => {
  it('exposes independent holiday color customization', async () => {
    render(<MemoryRouter><PreferencesPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Choose where accent color appears' }));
    const holidayScope = screen.getByRole('switch', { name: 'Holiday labels and dates' });
    expect(holidayScope).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(holidayScope);
    expect(mocks.setSetting).toHaveBeenCalledWith('uiColor:holidays', true);
  });

  it('offers separate placement switches for Settings icons and navbar glyphs without changing the app color', () => {
    render(<MemoryRouter><PreferencesPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Choose where accent color appears' }));
    expect(screen.getByRole('switch', { name: 'Navigation icons and labels' })).toHaveAttribute('aria-checked', 'false');
    const settingsIcons = screen.getByRole('switch', { name: 'Settings and subpage icons' });
    expect(settingsIcons).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Settings and subpage text' })).toBeInTheDocument();
    fireEvent.click(settingsIcons);
    expect(mocks.setSetting).toHaveBeenCalledWith('uiColor:settingsIcons', true);
    expect(mocks.setAccentColor).not.toHaveBeenCalled();
  });

  it('groups accent placement under Accent color and toggles general interface text independently', () => {
    render(<MemoryRouter><PreferencesPage /></MemoryRouter>);
    const accentSection = screen.getByRole('region', { name: 'Accent color' });
    expect(accentSection).toContainElement(screen.getByRole('button', { name: 'Choose accent color' }));
    const placementButton = screen.getByRole('button', { name: 'Choose where accent color appears' });
    expect(accentSection).toContainElement(placementButton);
    fireEvent.click(placementButton);
    const generalText = screen.getByRole('switch', { name: 'General page text' });
    expect(generalText).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(generalText);
    expect(mocks.setSetting).toHaveBeenCalledWith('uiColor:generalText', true);
    expect(mocks.setAccentColor).not.toHaveBeenCalled();
  });

  it('offers friend carousel and sheet text as independent default-off placements', () => {
    render(<MemoryRouter><PreferencesPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Choose where accent color appears' }));
    const carousel = screen.getByRole('switch', { name: 'Friend carousel selection and labels' });
    const sheet = screen.getByRole('switch', { name: 'Bottom sheet headings and labels' });
    expect(carousel).toHaveAttribute('aria-checked', 'false');
    expect(sheet).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(carousel);
    expect(mocks.setSetting).toHaveBeenCalledWith('uiColor:friendCarousel', true);
    expect(mocks.setAccentColor).not.toHaveBeenCalled();
  });

  // Regression: §2 (Preferences owns display/layout and synced behavior controls).
  it('exposes existing screen choices and the requested behavior preferences', async () => {
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
    choosePreference('Open day details as', 'Side panel when space allows');
    choosePreference('Day panel position', 'Left');
    expect(mocks.setSetting).toHaveBeenCalledWith('dayDetailPresentation', 'panel');
    expect(mocks.setSetting).toHaveBeenCalledWith('dayPanelSide', 'left');
    choosePreference('Day panel height', 'Screen height');
    expect(mocks.setSetting).toHaveBeenCalledWith('dayPanelHeight', 'screen');

    fireEvent.click(screen.getByRole('button', { name: 'Choose accent color' }));
    expect(screen.getByRole('dialog', { name: 'Accent color' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Select color #3B82F6' }));
    expect(mocks.setAccentColor).toHaveBeenCalledWith('#3B82F6');

    const reduceAnimations = screen.getByRole('switch', { name: 'Reduce animations' });
    expect(reduceAnimations).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(reduceAnimations);
    expect(mocks.setReduceAnimations).toHaveBeenCalledWith(true);

    const escapeBack = screen.getByRole('switch', { name: 'Escape navigates back' });
    expect(escapeBack).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(escapeBack);
    expect(mocks.setSetting).toHaveBeenCalledWith('escapeAsBack', true);

    const continuous = screen.getByRole('switch', {
      name: 'Keep adding in same category',
    });
    const taskPosition = screen.getByRole('switch', {
      name: 'Add new tasks to top',
    });
    expect(screen.getByRole('combobox', { name: /^Days visible on small screens:/ })).toHaveTextContent('7 days');
    choosePreference('Days visible on small screens', '3 days');
    expect(mocks.setSetting).toHaveBeenCalledWith('calendarZoomDays', 3);
    choosePreference('Days visible on small screens', '4 days');
    expect(mocks.setSetting).toHaveBeenCalledWith('calendarZoomDays', 4);
    const pinch = screen.getByRole('switch', { name: 'Pinch to change visible days' });
    expect(pinch).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(pinch);
    expect(mocks.setSetting).toHaveBeenCalledWith('calendarPinchZoom', true);
    const sticky = screen.getByRole('switch', { name: 'Keep weekday header visible' });
    expect(sticky).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sticky);
    expect(mocks.setSetting).toHaveBeenCalledWith('stickyCalendarWeekdayHeader', true);
    const sunday = screen.getByRole('switch', {
      name: 'Start week on Sunday',
    });
    const collapse = screen.getByRole('switch', {
      name: 'Show collapse button for categories',
    });
    const todayTag = screen.getByRole('switch', {
      name: 'Show Today tag beside date header',
    });
    const holidays = screen.getByRole('switch', {
      name: 'Show holidays',
    });
    expect(continuous).toHaveAttribute('aria-checked', 'false');
    expect(taskPosition).toHaveAttribute('aria-checked', 'false');
    expect(sunday).toHaveAttribute('aria-checked', 'true');
    expect(collapse).toHaveAttribute('aria-checked', 'false');
    expect(todayTag).toHaveAttribute('aria-checked', 'false');
    expect(holidays).toHaveAttribute('aria-checked', 'false');

    choosePreference('Task completion order', 'Completed last');
    expect(mocks.setSetting).toHaveBeenCalledWith('taskCompletionSort', 'completed-last');

    fireEvent.click(continuous);
    fireEvent.click(taskPosition);
    fireEvent.click(sunday);
    fireEvent.click(collapse);
    fireEvent.click(todayTag);
    fireEvent.click(holidays);
    choosePreference('Holiday region', 'Philippines');
    choosePreference('Holiday types', 'Public holidays only');

    expect(mocks.setSetting).toHaveBeenCalledWith('continueAddingTasks', true);
    expect(mocks.setSetting).toHaveBeenCalledWith('addTasksToTop', true);
    expect(mocks.setSetting).toHaveBeenCalledWith('weekStartsOnSunday', false);
    expect(mocks.setSetting).toHaveBeenCalledWith('showCategoryCollapseButton', true);
    expect(mocks.setSetting).toHaveBeenCalledWith('showDayViewTodayTag', true);
    expect(mocks.setSetting).toHaveBeenCalledWith('showHolidays', true);
    expect(mocks.setSetting).toHaveBeenCalledWith('holidayRegion', 'PH');
    expect(mocks.setSetting).toHaveBeenCalledWith('holidayTypes', 'public');
  });

  it('defaults to hiding the persistent Day View category action and saves explicit opt-in', () => {
    const { unmount } = render(<MemoryRouter><PreferencesPage /></MemoryRouter>);
    const toggle = screen.getByRole('switch', { name: 'Always show Add category in Day View' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(mocks.setSetting).toHaveBeenCalledWith('showAddCategoryInDayView', true);
    unmount();

    mocks.getSetting.mockImplementation((key: string, defaultValue?: unknown) =>
      key === 'showAddCategoryInDayView' ? true : defaultValue
    );
    render(<MemoryRouter><PreferencesPage /></MemoryRouter>);
    const enabled = screen.getByRole('switch', { name: 'Always show Add category in Day View' });
    expect(enabled).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(enabled);
    expect(mocks.setSetting).toHaveBeenCalledWith('showAddCategoryInDayView', false);
  });

  it('keeps pinch gestures opt-in for malformed stored values', () => {
    mocks.getSetting.mockImplementation((key: string, defaultValue?: unknown) =>
      key === 'calendarPinchZoom' ? 'true' : defaultValue
    );
    render(<MemoryRouter><PreferencesPage /></MemoryRouter>);
    expect(screen.getByRole('switch', { name: 'Pinch to change visible days' }))
      .toHaveAttribute('aria-checked', 'false');
  });

  it('defaults to confirming task deletion and persists explicit opt-out or opt-in', () => {
    const view = render(<MemoryRouter><PreferencesPage /></MemoryRouter>);
    const toggle = screen.getByRole('switch', { name: 'Confirm individual task deletion' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(mocks.setSetting).toHaveBeenCalledWith('confirmTaskDelete', false);
    view.unmount();

    mocks.getSetting.mockImplementation((key: string, defaultValue?: unknown) =>
      key === 'confirmTaskDelete' ? false : defaultValue
    );
    const saved = render(<MemoryRouter><PreferencesPage /></MemoryRouter>);
    const disabled = screen.getByRole('switch', { name: 'Confirm individual task deletion' });
    expect(disabled).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(disabled);
    expect(mocks.setSetting).toHaveBeenCalledWith('confirmTaskDelete', true);
    saved.unmount();

    // Unrecognized values fail safe rather than silently disabling confirmation.
    mocks.getSetting.mockImplementation((key: string, defaultValue?: unknown) =>
      key === 'confirmTaskDelete' ? 'false' : defaultValue
    );
    render(<MemoryRouter><PreferencesPage /></MemoryRouter>);
    expect(screen.getByRole('switch', { name: 'Confirm individual task deletion' }))
      .toHaveAttribute('aria-checked', 'true');
  });

  it('persists the selected incomplete calendar task accent and defaults to unchanged appearance', () => {
    const { unmount } = render(
      <MemoryRouter><PreferencesPage /></MemoryRouter>
    );
    expect(screen.getByRole('combobox', { name: /^Incomplete calendar task color:/ })).toHaveTextContent('Default');
    choosePreference('Incomplete calendar task color', 'Category text');
    expect(mocks.setSetting).toHaveBeenCalledWith('incompleteTaskBlockColor', 'text');
    choosePreference('Incomplete calendar task color', 'Category border');
    expect(mocks.setSetting).toHaveBeenCalledWith('incompleteTaskBlockColor', 'border');
    unmount();

    mocks.getSetting.mockImplementation((key: string, defaultValue?: unknown) =>
      key === 'incompleteTaskBlockColor' ? 'border' : defaultValue
    );
    const saved = render(<MemoryRouter><PreferencesPage /></MemoryRouter>);
    expect(screen.getByRole('combobox', { name: /^Incomplete calendar task color:/ })).toHaveTextContent('Category border');
    saved.unmount();

    mocks.getSetting.mockImplementation((key: string, defaultValue?: unknown) =>
      key === 'incompleteTaskBlockColor' ? 'invalid' : defaultValue
    );
    render(<MemoryRouter><PreferencesPage /></MemoryRouter>);
    expect(screen.getByRole('combobox', { name: /^Incomplete calendar task color:/ })).toHaveTextContent('Default');
  });

});
