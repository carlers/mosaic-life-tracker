import React, { useCallback, useEffect } from 'react';
import { useCalendarDiaryPreviews } from '../../../hooks/useCalendarDiaryPreviews';
import { useDiary } from '../../../hooks/useDiary';
import type { CalendarDiarySnapshot } from '../../../lib/calendarDiary';
import { useSettings } from '../../../hooks/useSettings';
import { useFeatureEnabled } from '../../../hooks/useFeatureEnabled';
import {
  CALENDAR_DIARY_DEFAULT_STYLE_SETTING_KEY,
  calendarDiaryEntryDisplayKey,
  resolveCalendarDiaryDefaultStyle,
} from '../../../lib/calendarDiaryDisplay';
import {
  CALENDAR_DIARY_COUNTS_TOWARD_LIMIT_SETTING_KEY,
  CALENDAR_DIARY_POSITION_SETTING_KEY,
  resolveCalendarDiaryPosition,
  SHOW_DIARY_IN_DAY_VIEW_SETTING_KEY,
  SHOW_DIARY_IN_CALENDAR_SETTING_KEY,
} from '../../../lib/preferences';
import type { CalendarViewMode } from './useCalendarState';
import type { WeekStartsOn } from '../../../lib/preferences';

interface CalendarDiarySubscriberProps {
  userId: string;
  slides: Date[];
  renderStart: number;
  renderEnd: number;
  viewMode: CalendarViewMode;
  weekStartsOn: WeekStartsOn;
  onPreviews: (snapshot: CalendarDiarySnapshot | null) => void;
}

/** Optional local data subscription; CalendarBody stays mounted as this module loads. */
export const CalendarDiarySubscriber: React.FC<CalendarDiarySubscriberProps> = ({
  userId, slides, renderStart, renderEnd, viewMode, weekStartsOn, onPreviews,
}) => {
  const { getSetting } = useSettings();
  const previewsEnabled = useFeatureEnabled('mosaic_disable_calendar_task_previews');
  const diaryCardsEnabled = getSetting(SHOW_DIARY_IN_DAY_VIEW_SETTING_KEY, false) === true;
  const diaryMarkersEnabled = getSetting(SHOW_DIARY_IN_CALENDAR_SETTING_KEY, false) === true;
  const { entries, isLoading } = useDiary(diaryCardsEnabled);
  const counted = getSetting(CALENDAR_DIARY_COUNTS_TOWARD_LIMIT_SETTING_KEY, false) === true;
  const defaultStyle = resolveCalendarDiaryDefaultStyle(getSetting(CALENDAR_DIARY_DEFAULT_STYLE_SETTING_KEY, 'text'));
  const getEntryDisplay = useCallback((entryId: string) =>
    getSetting(calendarDiaryEntryDisplayKey(entryId), 'default'), [getSetting]);
  const position = resolveCalendarDiaryPosition(getSetting(CALENDAR_DIARY_POSITION_SETTING_KEY, 'top'));
  const previews = useCalendarDiaryPreviews({
    enabled: diaryMarkersEnabled && previewsEnabled, userId, slides, renderStart, renderEnd, viewMode, weekStartsOn,
    defaultStyle, getEntryDisplay,
  });
  useEffect(() => {
    onPreviews({ ownerId: userId, previews, counted, position,
      ...(diaryCardsEnabled ? { entries, isLoading } : {}) });
  }, [userId, previews, counted, position, entries, isLoading, diaryCardsEnabled, onPreviews]);
  useEffect(() => () => onPreviews(null), [onPreviews]);
  return null;
};

export default CalendarDiarySubscriber;
