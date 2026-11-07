import React, { useEffect } from 'react';
import { useCalendarDiaryPreviews } from '../../../hooks/useCalendarDiaryPreviews';
import type { CalendarDiaryPreview } from '../../../lib/calendarDiary';
import type { CalendarViewMode } from './useCalendarState';
import type { WeekStartsOn } from '../../../lib/preferences';

interface CalendarDiarySubscriberProps {
  userId: string;
  slides: Date[];
  renderStart: number;
  renderEnd: number;
  viewMode: CalendarViewMode;
  weekStartsOn: WeekStartsOn;
  onPreviews: (ownerId: string, previews: ReadonlyMap<string, CalendarDiaryPreview> | null) => void;
}

/** Optional local data subscription; CalendarBody stays mounted as this module loads. */
export const CalendarDiarySubscriber: React.FC<CalendarDiarySubscriberProps> = ({
  userId, slides, renderStart, renderEnd, viewMode, weekStartsOn, onPreviews,
}) => {
  const previews = useCalendarDiaryPreviews({
    enabled: true, userId, slides, renderStart, renderEnd, viewMode, weekStartsOn,
  });
  useEffect(() => { onPreviews(userId, previews); }, [userId, previews, onPreviews]);
  useEffect(() => () => onPreviews('', null), [onPreviews]);
  return null;
};
