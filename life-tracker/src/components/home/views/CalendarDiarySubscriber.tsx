import React, { useEffect } from 'react';
import { useCalendarDiaryPreviews } from '../../../hooks/useCalendarDiaryPreviews';
import type { CalendarDiarySnapshot } from '../../../lib/calendarDiary';
import { useSettings } from '../../../hooks/useSettings';
import { useFeatureEnabled } from '../../../hooks/useFeatureEnabled';
import {
  CALENDAR_DIARY_COUNTS_TOWARD_LIMIT_SETTING_KEY,
  CALENDAR_DIARY_POSITION_SETTING_KEY,
  resolveCalendarDiaryPosition,
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
  const counted = getSetting(CALENDAR_DIARY_COUNTS_TOWARD_LIMIT_SETTING_KEY, false) === true;
  const position = resolveCalendarDiaryPosition(getSetting(CALENDAR_DIARY_POSITION_SETTING_KEY, 'top'));
  const previews = useCalendarDiaryPreviews({
    enabled: previewsEnabled, userId, slides, renderStart, renderEnd, viewMode, weekStartsOn,
  });
  useEffect(() => {
    onPreviews({ ownerId: userId, previews, counted, position });
  }, [userId, previews, counted, position, onPreviews]);
  useEffect(() => () => onPreviews(null), [onPreviews]);
  return null;
};
