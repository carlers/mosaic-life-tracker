import React from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronsUpDown,
  ListPlus,
  Tag,
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
import { useSettings } from '../hooks/useSettings';
import {
  CONTINUE_ADDING_TASKS_SETTING_KEY,
  SHOW_CATEGORY_COLLAPSE_SETTING_KEY,
  SHOW_DAY_VIEW_TODAY_TAG_SETTING_KEY,
  WEEK_STARTS_ON_SUNDAY_SETTING_KEY,
} from '../lib/preferences';
import { hasExpectedRouteParent } from '../lib/primarySwipeNavigation';

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
  const {
    mode,
    setAppearanceMode,
    contentWidthMode,
    sheetWidthMode,
    setContentWidthMode,
    setSheetWidthMode,
  } = useAppearance();
  const { getSetting, setSetting } = useSettings();

  const continueAddingTasks =
    getSetting(CONTINUE_ADDING_TASKS_SETTING_KEY, false) === true;
  const weekStartsOnSunday =
    getSetting(WEEK_STARTS_ON_SUNDAY_SETTING_KEY, true) === true;
  const showCategoryCollapse =
    getSetting(SHOW_CATEGORY_COLLAPSE_SETTING_KEY, false) === true;
  const showDayViewTodayTag =
    getSetting(SHOW_DAY_VIEW_TODAY_TAG_SETTING_KEY, false) === true;

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
        </section>
        <ChoiceGroup
          label="Appearance"
          options={APPEARANCE_MODES}
          value={mode}
          copy={APPEARANCE_COPY}
          onChange={setAppearanceMode}
        />
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
