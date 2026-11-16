import { useMemo } from 'react';
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { useRxCollection } from './useRxCollection';
import { groupCalendarDiaryPreviews } from '../lib/calendarDiaryProjection';
import type { CalendarDiaryPreview } from '../lib/calendarDiary';
import type { DiaryDocument } from '../db/schema';
import type { CalendarViewMode } from '../components/home/views/useCalendarState';
import type { WeekStartsOn } from '../lib/preferences';

const EMPTY_PREVIEWS: ReadonlyMap<string, CalendarDiaryPreview> = new Map();

interface CalendarDiaryOptions {
  enabled: boolean;
  userId: string;
  slides: Date[];
  renderStart: number;
  renderEnd: number;
  viewMode: CalendarViewMode;
  weekStartsOn: WeekStartsOn;
}

export function useCalendarDiaryPreviews({
  enabled, userId, slides, renderStart, renderEnd, viewMode, weekStartsOn,
}: CalendarDiaryOptions): ReadonlyMap<string, CalendarDiaryPreview> {
  const bounds = useMemo(() => {
    const first = slides[renderStart];
    const last = slides[renderEnd];
    if (!first || !last) return null;
    const weekOptions = { weekStartsOn };
    const start = viewMode === 'month'
      ? startOfWeek(startOfMonth(first), weekOptions)
      : startOfWeek(first, weekOptions);
    const end = viewMode === 'month'
      ? endOfWeek(endOfMonth(last), weekOptions)
      : endOfWeek(last, weekOptions);
    return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
  }, [slides, renderStart, renderEnd, viewMode, weekStartsOn]);

  const queryEnabled = enabled && Boolean(userId) && bounds !== null;
  const { data: entries } = useRxCollection<DiaryDocument>({
    collection: 'diary',
    selector: {
      userId,
      isDeleted: false,
      date: { $gte: bounds?.start ?? '', $lte: bounds?.end ?? '' },
    },
    logPrefix: '[useCalendarDiaryPreviews]',
    enabled: queryEnabled,
  });
  return useMemo(
    () => queryEnabled ? groupCalendarDiaryPreviews(entries) : EMPTY_PREVIEWS,
    [queryEnabled, entries],
  );
}
