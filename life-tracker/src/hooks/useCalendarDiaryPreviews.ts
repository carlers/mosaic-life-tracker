import { useMemo, useRef } from 'react';
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { useRxCollection } from './useRxCollection';
import { groupCalendarDiaryPreviews, type CalendarDiaryPreview } from '../lib/calendarDiary';
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
  // Reuse same-day preview identity when only an unrelated date changes.
  const prior = useRef<{ owner: string; map: ReadonlyMap<string, CalendarDiaryPreview> }>({
    owner: '', map: EMPTY_PREVIEWS,
  });
  return useMemo(() => {
    if (!queryEnabled) {
      prior.current = { owner: '', map: EMPTY_PREVIEWS };
      return EMPTY_PREVIEWS;
    }
    const projected = groupCalendarDiaryPreviews(entries);
    const before = prior.current.owner === userId ? prior.current.map : EMPTY_PREVIEWS;
    for (const [date, item] of projected) {
      const old = before.get(date);
      if (old && old.entryCount === item.entryCount &&
        old.excerpt === item.excerpt && old.emoji === item.emoji) {
        projected.set(date, old);
      }
    }
    prior.current = { owner: userId, map: projected };
    return projected;
  }, [queryEnabled, entries, userId]);
}
