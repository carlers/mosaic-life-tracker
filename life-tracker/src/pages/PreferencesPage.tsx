import React, { useState } from 'react';
import { Waves } from 'lucide-react';
import {
  ArrowUp,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronsUpDown,
  Globe2,
  ListFilter,
  ListPlus,
  Keyboard,
  BookOpenText,
  UsersRound,
  Palette,
  Tag,
  Sticker,
  Trash2,
  Clock3,
  CalendarPlus2,
  CheckCircle2,
  ListOrdered,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppearance } from '../hooks/useAppearance';
import { APPEARANCE_MODES, type AppearanceMode } from '../lib/appearance';
import {
  CONTENT_WIDTH_MODES,
  SHEET_WIDTH_MODES,
  type ContentWidthMode,
  type SheetWidthMode,
} from '../lib/screenLayout';
import { SettingsRow } from '../components/ui/SettingsRow';
import { MosaicSelect } from '../components/ui/MosaicSelect';
import { BottomSheet } from '../components/ui/BottomSheet';
import { ColorPalettePicker } from '../components/ui/ColorPalettePicker';
import { UiColorSettings } from '../components/ui/UiColorSettings';
import { ACCENT_COLOR_PALETTES } from '../constants/colors';
import { useSettings } from '../hooks/useSettings';
import { useKeyboardShortcuts } from '../hooks/keyboardShortcutsContext';
import {
  ADD_TASKS_TO_TOP_SETTING_KEY,
  CONFIRM_TASK_DELETE_SETTING_KEY,
  shouldConfirmTaskDelete,
  GIPHY_AUTOPLAY_SETTING_KEY,
  TASK_COMPLETION_SORT_SETTING_KEY,
  SHOW_TASK_CREATED_TIME_SETTING_KEY,
  SHOW_TASK_COMPLETED_TIME_SETTING_KEY,
  TASK_TIMESTAMP_LABEL_STYLE_SETTING_KEY,
  DAY_VIEW_MODE_SETTING_KEY,
  TIMELINE_DIRECTION_SETTING_KEY,
  TIMELINE_SORT_BASIS_SETTING_KEY,
  INCOMPLETE_TASK_BLOCK_COLOR_SETTING_KEY,
  resolveIncompleteTaskBlockColorMode,
  SHARED_LABEL_MODE_SETTING_KEY,
  SHOW_PENDING_SHARES_SETTING_KEY,
  ESCAPE_AS_BACK_SETTING_KEY,
  KEYBOARD_SHORTCUTS_SETTING_KEY,
  CONTINUE_ADDING_TASKS_SETTING_KEY,
  SHOW_CATEGORY_COLLAPSE_SETTING_KEY,
  SHOW_ADD_CATEGORY_IN_DAY_VIEW_SETTING_KEY,
  HOLIDAY_REGION_SETTING_KEY,
  HOLIDAY_TYPES_SETTING_KEY,
  SHOW_DAY_VIEW_TODAY_TAG_SETTING_KEY,
  SHOW_DIARY_IN_DAY_VIEW_SETTING_KEY,
  SHOW_DIARY_TODAY_SHORTCUT_SETTING_KEY,
  DIARY_DAY_VIEW_HEIGHT_SETTING_KEY,
  DIARY_DAY_VIEW_POSITION_SETTING_KEY,
  resolveDiaryDayViewHeight,
  resolveDiaryDayViewPosition,
  SHOW_HOLIDAYS_SETTING_KEY,
  WEEK_STARTS_ON_SUNDAY_SETTING_KEY,
  DAY_DETAIL_PRESENTATION_SETTING_KEY,
  DAY_PANEL_SIDE_SETTING_KEY,
  DAY_PANEL_HEIGHT_SETTING_KEY,
  resolveDayPanelHeight,
  resolveDayDetailPresentation,
  CALENDAR_ZOOM_DAYS_SETTING_KEY,
  CALENDAR_PINCH_ZOOM_SETTING_KEY,
  CALENDAR_TASK_PREVIEW_LIMIT_SETTING_KEY,
  CALENDAR_TASK_PREVIEW_LIMITS,
  resolveCalendarTaskPreviewLimit,
  STICKY_CALENDAR_WEEKDAY_HEADER_SETTING_KEY,
  resolveCalendarZoomDays,
} from '../lib/preferences';
import {
  inferHolidayRegion,
  normalizeHolidayRegion,
  resolveHolidayTypesSetting,
  type HolidayTypesSetting,
} from '../lib/holidays';
import { useHolidayCountries } from '../hooks/useHolidays';
import { resolveTaskCompletionSortMode, type TaskCompletionSortMode } from '../lib/taskOrder';
import { hasExpectedRouteParent, makeRouteParentState } from '../lib/primarySwipeNavigation';
import { useSettingsTargetFocus } from '../lib/settingsSearch';
import { resolveDayViewMode, resolveTimelineDirection, resolveTimelineSortBasis, resolveTimestampLabelStyle } from '../lib/taskTimeline';
interface ChoiceCopy {
  label: string;
  description: string;
}

const APPEARANCE_COPY: Record<AppearanceMode, ChoiceCopy> = {
  system: { label: 'System', description: 'Follow your device appearance.' },
  dark: { label: 'Dark', description: 'Use Mosaic’s charcoal dark palette.' },
  light: { label: 'Light', description: 'Use light surfaces with dark text.' },
  black: {
    label: 'Black',
    description: 'Use true-black primary surfaces for OLED displays.',
  },
};

const CONTENT_WIDTH_COPY: Record<ContentWidthMode, ChoiceCopy> = {
  full: {
    label: 'Full screen',
    description: 'Use the full available app width.',
  },
  comfortable: {
    label: 'Comfortable',
    description:
      'Center app content at 70% of the screen, capped at 960px, on tablets and larger.',
  },
  wide: {
    label: 'Wide',
    description: 'Center app content at 85% of the screen on tablets and larger.',
  },
};

const SHEET_WIDTH_COPY: Record<SheetWidthMode, ChoiceCopy> = {
  full: {
    label: 'Full width',
    description: 'Let bottom sheets span the available screen width.',
  },
  compact: {
    label: 'Compact',
    description:
      'Center bottom sheets at up to 540px wide on tablets and larger.',
  },
};

interface SelectSettingRowProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}

function SelectSettingRow({
  id,
  icon,
  label,
  value,
  onChange,
  options,
  placeholder,
}: SelectSettingRowProps) {
  return (
    <div data-setting-label={label} className="flex w-full items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="mosaic-settings-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2A2A2A]" aria-hidden="true">
          {icon}
        </div>
        <label htmlFor={id} className="mosaic-settings-label text-base font-medium text-white">{label}</label>
      </div>
      <MosaicSelect
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        options={placeholder ? [{ value: '', label: placeholder }, ...options] : options}
        className="max-w-[12rem]"
      />
    </div>
  );
}

interface ChoiceGroupProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  copy: Record<T, ChoiceCopy>;
  onChange: (value: T) => void | Promise<void>;
}

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  copy,
  onChange,
}: ChoiceGroupProps<T>) {
  return (
    <section data-setting-label={label} className="border-b border-[#333333] px-4 py-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </h2>
      <div role="radiogroup" aria-label={label} className="space-y-1">
        {options.map((option) => {
          const selected = option === value;
          const optionCopy = copy[option];
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => void onChange(option)}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[#2A2A2A] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              <span className="min-w-0">
                <span className="mosaic-settings-copy block text-sm font-semibold text-white">
                  {optionCopy.label}
                </span>
                <span className="mosaic-settings-copy mt-0.5 block text-xs leading-relaxed text-gray-400">
                  {optionCopy.description}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  selected
                    ? 'border-emerald-500 bg-emerald-500 text-black'
                    : 'border-[#444444] text-transparent'
                }`}
              >
                <Check size={14} strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export const PreferencesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const section = location.pathname.startsWith('/settings/preferences/') ? location.pathname.slice('/settings/preferences/'.length) : null;
  const titles: Record<string, string> = { tasks: 'Tasks & Categories', calendar: 'Calendar & Day View', diary: 'Diary', navigation: 'Navigation & Input', appearance: 'Appearance & Layout' };
  useSettingsTargetFocus(location.pathname, location.search);
  const {
    mode,
    setAppearanceMode,
    reduceAnimations,
    setReduceAnimations,
    accentColor,
    setAccentColor,
    contentWidthMode,
    sheetWidthMode,
    setContentWidthMode,
    setSheetWidthMode,
  } = useAppearance();
  const { getSetting, setSetting } = useSettings();
  const { openGuide } = useKeyboardShortcuts();
  const shortcutsEnabled = getSetting(KEYBOARD_SHORTCUTS_SETTING_KEY, true) !== false;
  const holidayCountries = useHolidayCountries();
  const [isAccentPickerOpen, setIsAccentPickerOpen] = useState(false);
  const escapeAsBack = getSetting(ESCAPE_AS_BACK_SETTING_KEY, false) === true;
  const continueAddingTasks =
    getSetting(CONTINUE_ADDING_TASKS_SETTING_KEY, false) === true;
  const giphyAutoplay = getSetting(GIPHY_AUTOPLAY_SETTING_KEY, false) === true;
  const addTasksToTop =
    getSetting(ADD_TASKS_TO_TOP_SETTING_KEY, false) === true;
  const confirmTaskDelete = shouldConfirmTaskDelete(getSetting(CONFIRM_TASK_DELETE_SETTING_KEY));
  const taskSortMode = resolveTaskCompletionSortMode(
    getSetting(TASK_COMPLETION_SORT_SETTING_KEY, 'manual')
  );
  const showTaskCreatedTime = getSetting(SHOW_TASK_CREATED_TIME_SETTING_KEY, false) === true;
  const showTaskCompletedTime = getSetting(SHOW_TASK_COMPLETED_TIME_SETTING_KEY, false) === true;
  const timestampLabelStyle = resolveTimestampLabelStyle(getSetting(TASK_TIMESTAMP_LABEL_STYLE_SETTING_KEY, 'icons'));
  const dayViewMode = resolveDayViewMode(getSetting(DAY_VIEW_MODE_SETTING_KEY, 'categories'));
  const timelineDirection = resolveTimelineDirection(getSetting(TIMELINE_DIRECTION_SETTING_KEY, 'desc'));
  const timelineSortBasis = resolveTimelineSortBasis(getSetting(TIMELINE_SORT_BASIS_SETTING_KEY, 'completion'));
  const incompleteTaskBlockColor = resolveIncompleteTaskBlockColorMode(
    getSetting(INCOMPLETE_TASK_BLOCK_COLOR_SETTING_KEY, 'default')
  );
  const shareLabelMode = getSetting(SHARED_LABEL_MODE_SETTING_KEY, 'names') === 'count' ? 'count' : 'names';
  const showPendingShares = getSetting(SHOW_PENDING_SHARES_SETTING_KEY, false) === true;
  const dayDetailPresentation = resolveDayDetailPresentation(getSetting(DAY_DETAIL_PRESENTATION_SETTING_KEY, 'sheet'));
  const dayPanelSide = getSetting(DAY_PANEL_SIDE_SETTING_KEY, 'right') === 'left' ? 'left' : 'right';
  const dayPanelHeight = resolveDayPanelHeight(getSetting(DAY_PANEL_HEIGHT_SETTING_KEY, 'grid'));
  const calendarZoomDays = resolveCalendarZoomDays(getSetting(CALENDAR_ZOOM_DAYS_SETTING_KEY, 7));
  const calendarPinchZoom = getSetting(CALENDAR_PINCH_ZOOM_SETTING_KEY, false) === true;
  const calendarTaskPreviewLimit = resolveCalendarTaskPreviewLimit(getSetting(CALENDAR_TASK_PREVIEW_LIMIT_SETTING_KEY, 'unlimited'));
  const stickyWeekdayHeader = getSetting(STICKY_CALENDAR_WEEKDAY_HEADER_SETTING_KEY, false) === true;
  const weekStartsOnSunday =
    getSetting(WEEK_STARTS_ON_SUNDAY_SETTING_KEY, true) === true;
  const showCategoryCollapse =
    getSetting(SHOW_CATEGORY_COLLAPSE_SETTING_KEY, false) === true;
  const alwaysShowAddCategory =
    getSetting(SHOW_ADD_CATEGORY_IN_DAY_VIEW_SETTING_KEY, false) === true;
  const showDayViewTodayTag =
    getSetting(SHOW_DAY_VIEW_TODAY_TAG_SETTING_KEY, false) === true;
  const showDiaryInDayView = getSetting(SHOW_DIARY_IN_DAY_VIEW_SETTING_KEY, false) === true;
  const showDiaryTodayShortcut = getSetting(SHOW_DIARY_TODAY_SHORTCUT_SETTING_KEY, true) === true;
  const diaryDayViewHeight = resolveDiaryDayViewHeight(getSetting(DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, 'compact'));
  const diaryDayViewPosition = resolveDiaryDayViewPosition(getSetting(DIARY_DAY_VIEW_POSITION_SETTING_KEY, 'top'));
  const showHolidays =
    getSetting(SHOW_HOLIDAYS_SETTING_KEY, false) === true;
  const storedHolidayRegion = normalizeHolidayRegion(
    getSetting(HOLIDAY_REGION_SETTING_KEY, '')
  );
  const holidayRegion = storedHolidayRegion || inferHolidayRegion();
  const holidayTypes = resolveHolidayTypesSetting(
    getSetting(HOLIDAY_TYPES_SETTING_KEY, 'public-and-observances')
  );
  const holidayRegionOptions = [
    ...(holidayRegion &&
    !holidayCountries.some((country) => country.countryCode === holidayRegion)
      ? [{ value: holidayRegion, label: holidayRegion }]
      : []),
    ...holidayCountries.map((country) => ({
      value: country.countryCode,
      label: country.name,
    })),
  ];
  const holidayTypeOptions: readonly {
    value: HolidayTypesSetting;
    label: string;
  }[] = [
    { value: 'public', label: 'Public holidays only' },
    {
      value: 'public-and-observances',
      label: 'Public holidays + observances',
    },
  ];

  const handleToggleHolidays = async () => {
    const next = !showHolidays;
    const writes: Promise<void>[] = [];
    if (next && !storedHolidayRegion && holidayRegion) {
      writes.push(setSetting(HOLIDAY_REGION_SETTING_KEY, holidayRegion));
    }
    writes.push(setSetting(SHOW_HOLIDAYS_SETTING_KEY, next));
    await Promise.all(writes);
  };

  const handleBack = () => {
    const fromSearch = section && location.state && typeof location.state === 'object' && 'parentPath' in location.state && location.state.parentPath === '/settings';
    const parent = fromSearch ? '/settings' : section ? '/settings/preferences' : '/settings';
    if (hasExpectedRouteParent(location.key, location.state, parent)) {
      navigate(-1);
    } else {
      navigate(parent, { replace: true });
    }
  };

  return (
    <div className="mosaic-settings-page flex min-h-full flex-col">
      <div className="sticky top-0 z-20 flex items-center justify-center border-b border-[#333333] bg-[#111111] px-4 py-3">
        <button
          type="button"
          onClick={handleBack}
          onPointerDown={(event) => event.stopPropagation()}
          className="mosaic-settings-icon absolute left-4 rounded-lg p-2 text-gray-400 transition-colors hover:bg-[#2A2A2A] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label="Back"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="text-lg font-bold text-white">{section ? (titles[section] ?? 'Preferences') : 'Preferences'}</h1>
      </div>

      <div className="flex-1 pb-24">
        {!section && (
          <nav aria-label="Preference categories" className="py-2">
            <SettingsRow icon={<Palette size={18} aria-hidden="true" />} label="Appearance & Layout" onClick={() => navigate('/settings/preferences/appearance', { state: makeRouteParentState('/settings/preferences') })} />
            <SettingsRow icon={<ListPlus size={18} aria-hidden="true" />} label="Tasks & Categories" onClick={() => navigate('/settings/preferences/tasks', { state: makeRouteParentState('/settings/preferences') })} />
            <SettingsRow icon={<CalendarDays size={18} aria-hidden="true" />} label="Calendar & Day View" onClick={() => navigate('/settings/preferences/calendar', { state: makeRouteParentState('/settings/preferences') })} />
            <SettingsRow icon={<BookOpenText size={18} aria-hidden="true" />} label="Diary" onClick={() => navigate('/settings/preferences/diary', { state: makeRouteParentState('/settings/preferences') })} />
            <SettingsRow icon={<Keyboard size={18} aria-hidden="true" />} label="Navigation & Input" onClick={() => navigate('/settings/preferences/navigation', { state: makeRouteParentState('/settings/preferences') })} />
          </nav>
        )}
        {section === 'tasks' && (<>
        <section className="border-b border-[#333333] py-2">
          <h2 className="px-4 pb-1 pt-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Tasks
          </h2>
          <SettingsRow
            icon={<ListPlus size={18} className="text-emerald-500" aria-hidden="true" />}
            label="Keep adding in same category"
            showChevron={false}
            isToggle
            checked={continueAddingTasks}
            onClick={() =>
              void setSetting(
                CONTINUE_ADDING_TASKS_SETTING_KEY,
                !continueAddingTasks
              )
            }
          />
          <SettingsRow
            icon={<ArrowUp size={18} className="text-gray-400" aria-hidden="true" />}
            label="Add new tasks to top"
            showChevron={false}
            isToggle
            checked={addTasksToTop}
            onClick={() =>
              void setSetting(
                ADD_TASKS_TO_TOP_SETTING_KEY,
                !addTasksToTop
              )
            }
          />
          <SettingsRow
            icon={<Trash2 size={18} className="text-red-400" aria-hidden="true" />}
            label="Confirm individual task deletion"
            showChevron={false}
            isToggle
            checked={confirmTaskDelete}
            onClick={() => void setSetting(CONFIRM_TASK_DELETE_SETTING_KEY, !confirmTaskDelete)}
          />
          <SettingsRow
            icon={<CalendarPlus2 size={18} className="text-gray-400" aria-hidden="true" />}
            label="Show task creation time"
            showChevron={false}
            isToggle
            checked={showTaskCreatedTime}
            onClick={() => void setSetting(SHOW_TASK_CREATED_TIME_SETTING_KEY, !showTaskCreatedTime)}
          />
          <SettingsRow
            icon={<CheckCircle2 size={18} className="text-gray-400" aria-hidden="true" />}
            label="Show task completion time"
            showChevron={false}
            isToggle
            checked={showTaskCompletedTime}
            onClick={() => void setSetting(SHOW_TASK_COMPLETED_TIME_SETTING_KEY, !showTaskCompletedTime)}
          />
          <SelectSettingRow
            id="task-timestamp-label-style"
            icon={<Clock3 size={18} className="text-gray-400" aria-hidden="true" />}
            label="Timestamp labels"
            value={timestampLabelStyle}
            options={[{ value: 'icons', label: 'Icons' }, { value: 'text', label: 'Text' }]}
            onChange={value => void setSetting(TASK_TIMESTAMP_LABEL_STYLE_SETTING_KEY, resolveTimestampLabelStyle(value))}
          />
          <SelectSettingRow
            id="day-view-default-mode"
            icon={<ListOrdered size={18} className="text-gray-400" aria-hidden="true" />}
            label="Day View display"
            value={dayViewMode}
            options={[{ value: 'categories', label: 'Categories' }, { value: 'timeline', label: 'Timeline' }]}
            onChange={value => void setSetting(DAY_VIEW_MODE_SETTING_KEY, resolveDayViewMode(value))}
          />
          <SelectSettingRow
            id="day-view-timeline-sort-basis"
            icon={<ListOrdered size={18} className="text-gray-400" aria-hidden="true" />}
            label="Timeline sort by"
            value={timelineSortBasis}
            options={[{ value: 'completion', label: 'Completion first' }, { value: 'creation', label: 'Creation first' }]}
            onChange={value => void setSetting(TIMELINE_SORT_BASIS_SETTING_KEY, resolveTimelineSortBasis(value))}
          />
          <SelectSettingRow
            id="day-view-timeline-direction"
            icon={<ListOrdered size={18} className="text-gray-400" aria-hidden="true" />}
            label="Timeline order"
            value={timelineDirection}
            options={[{ value: 'desc', label: 'Newest first' }, { value: 'asc', label: 'Oldest first' }]}
            onChange={value => void setSetting(TIMELINE_DIRECTION_SETTING_KEY, resolveTimelineDirection(value))}
          />
          <SelectSettingRow
            id="task-completion-sort"
            icon={<ListFilter size={18} className="text-gray-400" aria-hidden="true" />}
            label="Task completion order"
            value={taskSortMode}
            options={[
              { value: 'manual', label: 'Manual' },
              { value: 'completed-first', label: 'Completed first' },
              { value: 'completed-last', label: 'Completed last' },
            ]}
            onChange={(value) => void setSetting(
              TASK_COMPLETION_SORT_SETTING_KEY,
              resolveTaskCompletionSortMode(value) as TaskCompletionSortMode
            )}
          />
          <SelectSettingRow
            id="incomplete-task-block-color"
            icon={<Palette size={18} className="text-gray-400" aria-hidden="true" />}
            label="Incomplete calendar task color"
            value={incompleteTaskBlockColor}
            options={[
              { value: 'default', label: 'Default' },
              { value: 'text', label: 'Category text' },
              { value: 'border', label: 'Category border' },
            ]}
            onChange={(value) => void setSetting(
              INCOMPLETE_TASK_BLOCK_COLOR_SETTING_KEY,
              resolveIncompleteTaskBlockColorMode(value)
            )}
          />
          <SelectSettingRow
            id="shared-task-label"
            icon={<UsersRound size={18} className="text-gray-400" aria-hidden="true" />}
            label="Shared task labels"
            value={shareLabelMode}
            options={[
              { value: 'names', label: 'Friends names' },
              { value: 'count', label: 'Number of friends' },
            ]}
            onChange={(value) => void setSetting(
              SHARED_LABEL_MODE_SETTING_KEY, value === 'count' ? 'count' : 'names'
            )}
          />
          <SettingsRow
            icon={<UsersRound size={18} className="text-gray-400" aria-hidden="true" />}
            label="Show pending shared invitations"
            showChevron={false}
            isToggle
            checked={showPendingShares}
            onClick={() => void setSetting(SHOW_PENDING_SHARES_SETTING_KEY, !showPendingShares)}
          />
          <SettingsRow
            icon={<ListPlus size={18} className="text-gray-400" aria-hidden="true" />}
            label="Always show Add category in Day View"
            showChevron={false}
            isToggle
            checked={alwaysShowAddCategory}
            onClick={() => void setSetting(
              SHOW_ADD_CATEGORY_IN_DAY_VIEW_SETTING_KEY, !alwaysShowAddCategory
            )}
          />
          <SettingsRow
            icon={<ChevronsUpDown size={18} className="text-gray-400" aria-hidden="true" />}
            label="Show collapse button for categories"
            showChevron={false}
            isToggle
            checked={showCategoryCollapse}
            onClick={() =>
              void setSetting(
                SHOW_CATEGORY_COLLAPSE_SETTING_KEY,
                !showCategoryCollapse
              )
            }
          />
        </section>

        </>)}
        {section === 'calendar' && (<>
        <section className="border-b border-[#333333] py-2">
          <h2 className="px-4 pb-1 pt-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Calendar
          </h2>
          <SelectSettingRow
            id="day-detail-presentation" icon={<CalendarDays size={18} className="text-gray-400" aria-hidden="true" />}
            label="Open day details as" value={dayDetailPresentation}
            options={[{ value: 'sheet', label: 'Bottom sheet (default)' }, { value: 'panel', label: 'Side panel when space allows' }]}
            onChange={value => void setSetting(DAY_DETAIL_PRESENTATION_SETTING_KEY, resolveDayDetailPresentation(value))}
          />
          <SelectSettingRow
            id="day-panel-side" icon={<CalendarDays size={18} className="text-gray-400" aria-hidden="true" />}
            label="Day panel position" value={dayPanelSide}
            options={[{ value: 'right', label: 'Right (default)' }, { value: 'left', label: 'Left' }]}
            onChange={value => void setSetting(DAY_PANEL_SIDE_SETTING_KEY, value === 'left' ? 'left' : 'right')}
          />
          <SelectSettingRow
            id="day-panel-height" icon={<CalendarDays size={18} className="text-gray-400" aria-hidden="true" />}
            label="Day panel height" value={dayPanelHeight}
            options={[{ value: 'grid', label: 'Match month grid (default)' }, { value: 'screen', label: 'Screen height' }]}
            onChange={value => void setSetting(DAY_PANEL_HEIGHT_SETTING_KEY, resolveDayPanelHeight(value))}
          />
          <SelectSettingRow
            id="calendar-zoom-days"
            icon={<CalendarDays size={18} className="text-gray-400" aria-hidden="true" />}
            label="Days visible on small screens"
            value={String(calendarZoomDays)}
            options={[
              { value: '7', label: '7 days (default)' },
              { value: '4', label: '4 days' },
              { value: '3', label: '3 days' },
            ]}
            onChange={(value) => void setSetting(
              CALENDAR_ZOOM_DAYS_SETTING_KEY,
              resolveCalendarZoomDays(value)
            )}
          />
          <SelectSettingRow
            id="calendar-task-preview-limit"
            icon={<CalendarDays size={18} className="text-gray-400" aria-hidden="true" />}
            label="Maximum visible tasks per day"
            value={String(calendarTaskPreviewLimit)}
            options={[
              ...CALENDAR_TASK_PREVIEW_LIMITS.map(limit => ({ value: String(limit), label: String(limit) })),
              { value: 'unlimited', label: 'Unlimited (default)' },
            ]}
            onChange={value => void setSetting(
              CALENDAR_TASK_PREVIEW_LIMIT_SETTING_KEY,
              resolveCalendarTaskPreviewLimit(value)
            )}
          />
          <SettingsRow
            icon={<CalendarDays size={18} className="text-gray-400" aria-hidden="true" />}
            label="Pinch to change visible days"
            showChevron={false}
            isToggle
            checked={calendarPinchZoom}
            onClick={() => void setSetting(CALENDAR_PINCH_ZOOM_SETTING_KEY, !calendarPinchZoom)}
          />
          <SettingsRow
            icon={<CalendarDays size={18} className="text-gray-400" aria-hidden="true" />}
            label="Keep weekday header visible"
            showChevron={false}
            isToggle
            checked={stickyWeekdayHeader}
            onClick={() => void setSetting(STICKY_CALENDAR_WEEKDAY_HEADER_SETTING_KEY, !stickyWeekdayHeader)}
          />
          <SettingsRow
            icon={<CalendarDays size={18} className="text-gray-400" aria-hidden="true" />}
            label="Start week on Sunday"
            showChevron={false}
            isToggle
            checked={weekStartsOnSunday}
            onClick={() =>
              void setSetting(
                WEEK_STARTS_ON_SUNDAY_SETTING_KEY,
                !weekStartsOnSunday
              )
            }
          />
          <SettingsRow
            icon={<Tag size={18} className="text-gray-400" aria-hidden="true" />}
            label="Show Today tag beside date header"
            showChevron={false}
            isToggle
            checked={showDayViewTodayTag}
            onClick={() =>
              void setSetting(
                SHOW_DAY_VIEW_TODAY_TAG_SETTING_KEY,
                !showDayViewTodayTag
              )
            }
          />
          <SettingsRow
            icon={<CalendarDays size={18} className="text-red-400" aria-hidden="true" />}
            label="Show holidays"
            showChevron={false}
            isToggle
            checked={showHolidays}
            onClick={() => void handleToggleHolidays()}
          />
          <SelectSettingRow
            id="holiday-region"
            icon={<Globe2 size={18} className="text-gray-400" aria-hidden="true" />}
            label="Holiday region"
            value={holidayRegion}
            placeholder="Choose region"
            options={holidayRegionOptions}
            onChange={(value) => void setSetting(HOLIDAY_REGION_SETTING_KEY, value)}
          />
          <SelectSettingRow
            id="holiday-types"
            icon={<ListFilter size={18} className="text-gray-400" aria-hidden="true" />}
            label="Holiday types"
            value={holidayTypes}
            options={holidayTypeOptions}
            onChange={(value) =>
              void setSetting(
                HOLIDAY_TYPES_SETTING_KEY,
                resolveHolidayTypesSetting(value)
              )
            }
          />
        </section>

        </>)}
        {section === 'diary' && (
          <section className="border-b border-[#333333] py-2" aria-label="Diary">
          <SettingsRow icon={<CalendarDays size={18} className="text-gray-400" aria-hidden="true" />}
            label="Show diary in Day View" showChevron={false} isToggle checked={showDiaryInDayView}
            onClick={() => void setSetting(SHOW_DIARY_IN_DAY_VIEW_SETTING_KEY, !showDiaryInDayView)} />
          <SettingsRow icon={<CalendarDays size={18} className="text-gray-400" aria-hidden="true" />}
            label={`Diary text: ${diaryDayViewHeight === 'compact' ? 'One line' : 'Expanded'}`}
            showChevron={false} isToggle checked={diaryDayViewHeight === 'expanded'}
            onClick={() => void setSetting(DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, diaryDayViewHeight === 'compact' ? 'expanded' : 'compact')} />
          <SettingsRow icon={<CalendarDays size={18} className="text-gray-400" aria-hidden="true" />}
            label={`Default diary position: ${diaryDayViewPosition === 'top' ? 'Top' : 'Bottom'}`}
            showChevron={false} isToggle checked={diaryDayViewPosition === 'bottom'}
            onClick={() => void setSetting(DIARY_DAY_VIEW_POSITION_SETTING_KEY, diaryDayViewPosition === 'top' ? 'bottom' : 'top')} />
          <SettingsRow icon={<CalendarDays size={18} className="text-gray-400" aria-hidden="true" />}
            label="Show Diary Today shortcut" showChevron={false} isToggle checked={showDiaryTodayShortcut}
            onClick={() => void setSetting(SHOW_DIARY_TODAY_SHORTCUT_SETTING_KEY, !showDiaryTodayShortcut)} />

          </section>
        )}
        {section === 'navigation' && (<>
        <section className="border-b border-[#333333] py-2">
          <h2 className="px-4 pb-1 pt-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Navigation</h2>
          <SettingsRow
            icon={<Keyboard size={18} className="text-gray-400" aria-hidden="true" />}
            label="Keyboard shortcuts"
            value="Single-key shortcuts for navigating Mosaic. Tab, arrows, Enter and Space remain available when off."
            showChevron={false}
            isToggle
            checked={shortcutsEnabled}
            onClick={() => void setSetting(KEYBOARD_SHORTCUTS_SETTING_KEY, !shortcutsEnabled)}
          />
          <SettingsRow
            icon={<BookOpenText size={18} className="text-gray-400" aria-hidden="true" />}
            label="View keyboard shortcut guide"
            value="See the keys for Home, Calendar, Day View and other pages."
            onClick={openGuide}
          />
          <SettingsRow
            icon={<ChevronLeft size={18} className="text-gray-400" aria-hidden="true" />}
            label="Escape navigates back"
            showChevron={false}
            isToggle
            checked={escapeAsBack}
            onClick={() => void setSetting(ESCAPE_AS_BACK_SETTING_KEY, !escapeAsBack)}
          />
        </section>

        </>)}
        {section === 'appearance' && (<>
        <ChoiceGroup
          label="Appearance"
          options={APPEARANCE_MODES}
          value={mode}
          copy={APPEARANCE_COPY}
          onChange={setAppearanceMode}
        />
        <section className="border-b border-[#333333] py-2">
          <h2 className="px-4 pb-1 pt-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Motion</h2>
          <SettingsRow
            icon={<Waves size={18} className="text-gray-400" aria-hidden="true" />}
            label="Reduce animations"
            value="Minimize nonessential motion. Also respects your device setting."
            showChevron={false}
            isToggle
            checked={reduceAnimations}
            onClick={() => void setReduceAnimations(!reduceAnimations)}
          />
          <SettingsRow
            icon={<Sticker size={18} className="text-gray-400" aria-hidden="true" />}
            label="Autoplay GIPHY stickers"
            value="Off by default; Reduce animations or device motion settings take priority."
            showChevron={false}
            isToggle
            checked={giphyAutoplay}
            onClick={() => void setSetting(GIPHY_AUTOPLAY_SETTING_KEY, !giphyAutoplay)}
          />
        </section>
        <section data-setting-label="Accent color" aria-labelledby="preferences-accent-heading" className="border-b border-[#333333] px-4 py-5">
          <h2 id="preferences-accent-heading" className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Accent color
          </h2>
          <button
            type="button"
            aria-label="Choose accent color"
            onClick={() => setIsAccentPickerOpen(true)}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[#2A2A2A] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span
                className="mosaic-settings-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2A2A2A]"
                aria-hidden="true"
              >
                <Palette size={17} className="text-emerald-500" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">
                  App accent
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-gray-400">
                  Used for interactive controls and selection highlights.
                </span>
              </span>
            </span>
            <span
              className="h-7 w-7 shrink-0 rounded-full border border-white/20"
              style={{ backgroundColor: accentColor }}
              aria-hidden="true"
            />
          </button>
          <div className="mt-2 border-t border-[#333333] pt-2">
            <UiColorSettings />
          </div>
        </section>
        <BottomSheet
          isOpen={isAccentPickerOpen}
          onClose={() => setIsAccentPickerOpen(false)}
          title="Accent color"
        >
          <div className="pb-4">
            <p className="mb-3 text-sm leading-relaxed text-gray-400">
              Changes apply immediately and sync with your Mosaic account.
            </p>
            <ColorPalettePicker
              selectedColor={accentColor}
              palettes={ACCENT_COLOR_PALETTES}
              ariaLabel="Choose app accent color"
              onSelect={(color) => void setAccentColor(color)}
            />
          </div>
        </BottomSheet>
        <ChoiceGroup
          label="Content width"
          options={CONTENT_WIDTH_MODES}
          value={contentWidthMode}
          copy={CONTENT_WIDTH_COPY}
          onChange={setContentWidthMode}
        />
        <ChoiceGroup
          label="Bottom sheets"
          options={SHEET_WIDTH_MODES}
          value={sheetWidthMode}
          copy={SHEET_WIDTH_COPY}
          onChange={setSheetWidthMode}
        />
        <p className="px-7 py-4 text-xs leading-relaxed text-gray-500">
          Width preferences apply on tablets and larger screens. Phone layouts stay full width.
        </p>

        </>)}
      </div>
    </div>
  );
};
