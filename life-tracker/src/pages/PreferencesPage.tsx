import React, { useEffect, useState } from 'react';
import {
  ArrowUp,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronsUpDown,
  Globe2,
  ListFilter,
  ListPlus,
  BellRing,
  Palette,
  Tag,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppearance } from '../hooks/useAppearance';
import { useAuth } from '../hooks/useAuth';
import { APPEARANCE_MODES, type AppearanceMode } from '../lib/appearance';
import {
  CONTENT_WIDTH_MODES,
  SHEET_WIDTH_MODES,
  type ContentWidthMode,
  type SheetWidthMode,
} from '../lib/screenLayout';
import { SettingsRow } from '../components/ui/SettingsRow';
import { BottomSheet } from '../components/ui/BottomSheet';
import { ColorPalettePicker } from '../components/ui/ColorPalettePicker';
import { ACCENT_COLOR_PALETTES } from '../constants/colors';
import { useSettings } from '../hooks/useSettings';
import {
  ADD_TASKS_TO_TOP_SETTING_KEY,
  CONTINUE_ADDING_TASKS_SETTING_KEY,
  SHOW_CATEGORY_COLLAPSE_SETTING_KEY,
  HOLIDAY_REGION_SETTING_KEY,
  HOLIDAY_TYPES_SETTING_KEY,
  SHOW_DAY_VIEW_TODAY_TAG_SETTING_KEY,
  SHOW_HOLIDAYS_SETTING_KEY,
  WEEK_STARTS_ON_SUNDAY_SETTING_KEY,
} from '../lib/preferences';
import {
  inferHolidayRegion,
  normalizeHolidayRegion,
  resolveHolidayTypesSetting,
  type HolidayTypesSetting,
} from '../lib/holidays';
import { useHolidayCountries } from '../hooks/useHolidays';
import { hasExpectedRouteParent } from '../lib/primarySwipeNavigation';
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushNotificationState,
  type PushNotificationState,
} from '../lib/pushNotifications';

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
    <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2A2A2A]" aria-hidden="true">
          {icon}
        </div>
        <label htmlFor={id} className="text-base font-medium text-white">{label}</label>
      </div>
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onPointerDown={(event) => event.stopPropagation()}
        className="min-w-0 max-w-[12rem] rounded-lg border border-[#444444] bg-[#1E1E1E] px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
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
    <section className="border-b border-[#333333] px-4 py-5">
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
                <span className="block text-sm font-semibold text-white">
                  {optionCopy.label}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-gray-400">
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
  const { user } = useAuth();
  const {
    mode,
    setAppearanceMode,
    accentColor,
    setAccentColor,
    contentWidthMode,
    sheetWidthMode,
    setContentWidthMode,
    setSheetWidthMode,
  } = useAppearance();
  const { getSetting, setSetting } = useSettings();
  const holidayCountries = useHolidayCountries();
  const [isAccentPickerOpen, setIsAccentPickerOpen] = useState(false);
  const [pushState, setPushState] = useState<PushNotificationState>({
    status: 'checking',
    enabled: false,
    label: 'Checking this device…',
  });
  const [isChangingPush, setIsChangingPush] = useState(false);

  useEffect(() => {
    let active = true;
    void getPushNotificationState(user?.$id ?? '')
      .then((next) => {
        if (active) setPushState(next);
      })
      .catch((pushError) => {
        console.warn('[PreferencesPage] push state check failed:', pushError);
        if (active) {
          setPushState({
            status: 'available',
            enabled: false,
            label: 'Could not check push on this device',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [user?.$id]);

  const pushUnavailable =
    !pushState.enabled && pushState.status !== 'available';

  const handleTogglePush = async () => {
    const userId = user?.$id;
    if (!userId || isChangingPush || pushUnavailable) return;
    setIsChangingPush(true);
    try {
      const next = pushState.enabled
        ? await disablePushNotifications(userId)
        : await enablePushNotifications(userId);
      setPushState(next);
    } catch (error) {
      console.error('[PreferencesPage] push toggle failed:', error);
      setPushState(await getPushNotificationState(userId));
    } finally {
      setIsChangingPush(false);
    }
  };

  const continueAddingTasks =
    getSetting(CONTINUE_ADDING_TASKS_SETTING_KEY, false) === true;
  const addTasksToTop =
    getSetting(ADD_TASKS_TO_TOP_SETTING_KEY, false) === true;
  const weekStartsOnSunday =
    getSetting(WEEK_STARTS_ON_SUNDAY_SETTING_KEY, true) === true;
  const showCategoryCollapse =
    getSetting(SHOW_CATEGORY_COLLAPSE_SETTING_KEY, false) === true;
  const showDayViewTodayTag =
    getSetting(SHOW_DAY_VIEW_TODAY_TAG_SETTING_KEY, false) === true;
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
    const parent = '/settings';
    if (hasExpectedRouteParent(location.key, location.state, parent)) {
      navigate(-1);
    } else {
      navigate(parent, { replace: true });
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-20 flex items-center justify-center border-b border-[#333333] bg-[#111111] px-4 py-3">
        <button
          type="button"
          onClick={handleBack}
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute left-4 rounded-lg p-2 text-gray-400 transition-colors hover:bg-[#2A2A2A] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label="Back"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="text-lg font-bold text-white">Preferences</h1>
      </div>

      <div className="flex-1 pb-24">
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
        <section className="border-b border-[#333333] py-2">
          <h2 className="px-4 pb-1 pt-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Calendar
          </h2>
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
        <section className="border-b border-[#333333] py-2">
          <h2 className="px-4 pb-1 pt-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Notifications
          </h2>
          <SettingsRow
            icon={
              <BellRing
                size={18}
                className="text-gray-400"
                aria-hidden="true"
              />
            }
            label="Push friend completions"
            value={isChangingPush ? 'Updating…' : pushState.label}
            showChevron={false}
            isToggle
            checked={pushState.enabled}
            disabled={isChangingPush || pushUnavailable}
            onClick={() => void handleTogglePush()}
          />
          <p className="px-7 pb-3 text-xs leading-relaxed text-gray-500">
            Permission is requested only when you turn this on. Alerts still
            appear in Mosaic when push is unavailable or disabled.
          </p>
        </section>
        <ChoiceGroup
          label="Appearance"
          options={APPEARANCE_MODES}
          value={mode}
          copy={APPEARANCE_COPY}
          onChange={setAppearanceMode}
        />
        <section className="border-b border-[#333333] px-4 py-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
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
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2A2A2A]"
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
      </div>
    </div>
  );
};
