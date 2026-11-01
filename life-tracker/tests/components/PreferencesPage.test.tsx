import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
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

vi.mock('../../src/components/modals/CategoryManagerSheet', () => ({
  CategoryManagerSheet: ({isOpen, onClose}: {isOpen:boolean;onClose:()=>void}) =>
    isOpen ? <div role="dialog" aria-label="Category manager">
      <button onClick={onClose}>Close category manager</button>
    </div> : null,
}));

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

function renderPreference(section: 'appearance' | 'tasks' | 'day-view' | 'calendar' | 'navigation' | 'diary') {
  return render(<MemoryRouter initialEntries={['/settings/preferences/' + section]}><PreferencesPage /></MemoryRouter>);
}

describe('PreferencesPage', () => {
  it('opens Category Manager from Tasks & Categories settings without navigation', async () => {
    renderPreference('tasks');
    fireEvent.click(screen.getByRole('button', {name:'Manage categories'}));
    await waitFor(() => expect(screen.getByRole('dialog',{name:'Category manager'})).toBeInTheDocument());
    expect(screen.getByRole('heading',{name:'Tasks & Categories'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Close category manager'}));
    expect(screen.queryByRole('dialog',{name:'Category manager'})).toBeNull();
  });

  it('renders the requested destination rather than the current route during swipe preview', () => {
    render(
      <MemoryRouter initialEntries={['/settings/preferences/calendar']}>
        <PreferencesPage previewPathname="/settings/preferences/appearance" />
      </MemoryRouter>
    );
    expect(screen.getByRole('radio', { name: /^Light/ })).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Show holidays' })).toBeNull();
  });

  it('shows six category destinations without mounting all controls', () => {
    render(<MemoryRouter initialEntries={['/settings/preferences']}><PreferencesPage /></MemoryRouter>);
    for (const label of ['Appearance & Layout', 'Tasks & Categories', 'Day View', 'Calendar', 'Diary', 'Navigation & Input']) {
      expect(screen.getByRole('button', { name: label })).toBeEnabled();
    }
    expect(screen.queryByRole('switch', { name: 'Reduce animations' })).toBeNull();
  });
  it('exposes independent holiday color customization', async () => {
    renderPreference('appearance');
    fireEvent.click(screen.getByRole('button', { name: 'Choose where accent color appears' }));
    const holidayScope = screen.getByRole('switch', { name: 'Holiday labels and dates' });
    expect(holidayScope).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(holidayScope);
    expect(mocks.setSetting).toHaveBeenCalledWith('uiColor:holidays', true);
  });

  it('offers separate placement switches for Settings icons and navbar glyphs without changing the app color', () => {
    renderPreference('appearance');
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
    renderPreference('appearance');
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
    renderPreference('appearance');
    fireEvent.click(screen.getByRole('button', { name: 'Choose where accent color appears' }));
    const carousel = screen.getByRole('switch', { name: 'Friend carousel selection and labels' });
    const sheet = screen.getByRole('switch', { name: 'Bottom sheet headings and labels' });
    expect(carousel).toHaveAttribute('aria-checked', 'false');
    expect(sheet).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(carousel);
    expect(mocks.setSetting).toHaveBeenCalledWith('uiColor:friendCarousel', true);
    expect(mocks.setAccentColor).not.toHaveBeenCalled();
  });

  // Regression: §2 — existing setting keys/defaults remain unchanged after categorization.
  it('keeps appearance and layout choices editable', () => {
    renderPreference('appearance');
    fireEvent.click(screen.getByRole('radio', { name: /^Light/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Comfortable/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Compact/ }));
    expect(mocks.setAppearanceMode).toHaveBeenCalledWith('light');
    expect(mocks.setContentWidthMode).toHaveBeenCalledWith('comfortable');
    expect(mocks.setSheetWidthMode).toHaveBeenCalledWith('compact');
    fireEvent.click(screen.getByRole('button', { name: 'Choose accent color' }));
    expect(screen.getByRole('dialog', { name: 'Accent color' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Select color #3B82F6' }));
    expect(mocks.setAccentColor).toHaveBeenCalledWith('#3B82F6');
    fireEvent.click(screen.getByRole('switch', { name: 'Reduce animations' }));
    expect(mocks.setReduceAnimations).toHaveBeenCalledWith(true);
  });

  it('keeps calendar and day-panel preferences editable', () => {
    renderPreference('calendar');
    expect(screen.getByRole('combobox', { name: /^Days visible on small screens:/ })).toHaveTextContent('7 days');
    choosePreference('Days visible on small screens', '3 days');
    choosePreference('Days visible on small screens', '4 days');
    expect(mocks.setSetting).toHaveBeenCalledWith('calendarZoomDays', 3);
    expect(mocks.setSetting).toHaveBeenCalledWith('calendarZoomDays', 4);
    expect(screen.getByRole('switch', { name: 'Pinch to change visible days' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('switch', { name: 'Pinch to change visible days' }));
    expect(mocks.setSetting).toHaveBeenCalledWith('calendarPinchZoom', true);
    fireEvent.click(screen.getByRole('switch', { name: 'Keep weekday header visible' }));
    expect(mocks.setSetting).toHaveBeenCalledWith('stickyCalendarWeekdayHeader', true);
    expect(screen.getByRole('switch', { name: 'Start week on Sunday' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('switch', { name: 'Start week on Sunday' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Show holidays' }));
    choosePreference('Holiday region', 'Philippines');
    choosePreference('Holiday types', 'Public holidays only');
    expect(mocks.setSetting).toHaveBeenCalledWith('weekStartsOnSunday', false);
    expect(mocks.setSetting).toHaveBeenCalledWith('showHolidays', true);
    expect(mocks.setSetting).toHaveBeenCalledWith('holidayRegion', 'PH');
    expect(mocks.setSetting).toHaveBeenCalledWith('holidayTypes', 'public');
  });

  it('keeps task controls and category flags editable', () => {
    renderPreference('tasks');
    const continuous = screen.getByRole('switch', { name: 'Keep adding in same category' });
    const taskPosition = screen.getByRole('switch', { name: 'Add new tasks to top' });
    expect(continuous).toHaveAttribute('aria-checked', 'false');
    expect(taskPosition).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(continuous);
    fireEvent.click(taskPosition);
    expect(mocks.setSetting).toHaveBeenCalledWith('continueAddingTasks', true);
    expect(mocks.setSetting).toHaveBeenCalledWith('addTasksToTop', true);
  });

  it('keeps navigation and diary options in their dedicated pages', () => {
    const view = renderPreference('navigation');
    fireEvent.click(screen.getByRole('switch', { name: 'Escape navigates back' }));
    expect(mocks.setSetting).toHaveBeenCalledWith('escapeAsBack', true);
    view.unmount();
    renderPreference('diary');
    fireEvent.click(screen.getByRole('switch', { name: 'Show diary in Day View' }));
    expect(mocks.setSetting).toHaveBeenCalledWith('showDiaryInDayView', true);
    expect(screen.queryByRole('switch', { name: 'Show holidays' })).toBeNull();
  });

  it('defaults to hiding the persistent Day View category action and saves explicit opt-in', () => {
    const { unmount } = renderPreference('day-view');
    const toggle = screen.getByRole('switch', { name: 'Always show Add category in Day View' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(mocks.setSetting).toHaveBeenCalledWith('showAddCategoryInDayView', true);
    unmount();

    mocks.getSetting.mockImplementation((key: string, defaultValue?: unknown) =>
      key === 'showAddCategoryInDayView' ? true : defaultValue
    );
    renderPreference('day-view');
    const enabled = screen.getByRole('switch', { name: 'Always show Add category in Day View' });
    expect(enabled).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(enabled);
    expect(mocks.setSetting).toHaveBeenCalledWith('showAddCategoryInDayView', false);
  });

  it('keeps Day View sorting, layout, categories and related settings together', () => {
    renderPreference('day-view');
    choosePreference('Timeline arrangement', 'Completed last');
    expect(mocks.setSetting).toHaveBeenCalledWith('dayTimelineSortBasis', 'completion-last');
    choosePreference('Categories and Backlogs task order', 'Completed last');
    expect(mocks.setSetting).toHaveBeenCalledWith('taskCompletionSort', 'completed-last');
    choosePreference('Open day details as', 'Side panel when space allows');
    choosePreference('Day panel position', 'Left');
    choosePreference('Day panel height', 'Screen height');
    expect(mocks.setSetting).toHaveBeenCalledWith('dayDetailPresentation', 'panel');
    expect(mocks.setSetting).toHaveBeenCalledWith('dayPanelSide', 'left');
    expect(mocks.setSetting).toHaveBeenCalledWith('dayPanelHeight', 'screen');
    fireEvent.click(screen.getByRole('switch', { name: 'Show Today tag beside date header' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Show collapse button for categories' }));
    expect(mocks.setSetting).toHaveBeenCalledWith('showDayViewTodayTag', true);
    expect(mocks.setSetting).toHaveBeenCalledWith('showCategoryCollapseButton', true);
    expect(screen.getByRole('button', { name: 'Tasks & Categories' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Calendar' })).toBeEnabled();
    expect(screen.queryByRole('switch', { name: 'Show holidays' })).toBeNull();
  });

  it('returns directly to the selected calendar day after opening Day View settings', () => {
    const HomeProbe = () => {
      const location = useLocation();
      return <div data-testid="home-return-day">{String((location.state as { openDayViewDate?: string } | null)?.openDayViewDate)}</div>;
    };
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/settings/preferences/day-view',
        state: { parentPath: '/home', dayViewReturnDate: '2026-10-20' },
      }]}>
        <Routes>
          <Route path="/settings/preferences/day-view" element={<PreferencesPage />} />
          <Route path="/home" element={<HomeProbe />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('home-return-day')).toHaveTextContent('2026-10-20');
  });

  it('keeps pinch gestures opt-in for malformed stored values', () => {
    mocks.getSetting.mockImplementation((key: string, defaultValue?: unknown) =>
      key === 'calendarPinchZoom' ? 'true' : defaultValue
    );
    renderPreference('calendar');
    expect(screen.getByRole('switch', { name: 'Pinch to change visible days' }))
      .toHaveAttribute('aria-checked', 'false');
  });

  it('defaults to confirming task deletion and persists explicit opt-out or opt-in', () => {
    const view = renderPreference('tasks');
    const toggle = screen.getByRole('switch', { name: 'Confirm individual task deletion' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(mocks.setSetting).toHaveBeenCalledWith('confirmTaskDelete', false);
    view.unmount();

    mocks.getSetting.mockImplementation((key: string, defaultValue?: unknown) =>
      key === 'confirmTaskDelete' ? false : defaultValue
    );
    const saved = renderPreference('tasks');
    const disabled = screen.getByRole('switch', { name: 'Confirm individual task deletion' });
    expect(disabled).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(disabled);
    expect(mocks.setSetting).toHaveBeenCalledWith('confirmTaskDelete', true);
    saved.unmount();

    // Unrecognized values fail safe rather than silently disabling confirmation.
    mocks.getSetting.mockImplementation((key: string, defaultValue?: unknown) =>
      key === 'confirmTaskDelete' ? 'false' : defaultValue
    );
    renderPreference('tasks');
    expect(screen.getByRole('switch', { name: 'Confirm individual task deletion' }))
      .toHaveAttribute('aria-checked', 'true');
  });

  it('persists the selected incomplete calendar task accent and defaults to unchanged appearance', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/settings/preferences/tasks']}><PreferencesPage /></MemoryRouter>
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
    const saved = renderPreference('tasks');
    expect(screen.getByRole('combobox', { name: /^Incomplete calendar task color:/ })).toHaveTextContent('Category border');
    saved.unmount();

    mocks.getSetting.mockImplementation((key: string, defaultValue?: unknown) =>
      key === 'incompleteTaskBlockColor' ? 'invalid' : defaultValue
    );
    renderPreference('tasks');
    expect(screen.getByRole('combobox', { name: /^Incomplete calendar task color:/ })).toHaveTextContent('Default');
  });

});
