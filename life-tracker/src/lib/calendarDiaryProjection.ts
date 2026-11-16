import type { DiaryDocument } from '../db/schema';
import { parseDiaryPhotos } from './diaryPhotos';
import type { CalendarDiaryPreview } from './calendarDiary';
import {
  resolveCalendarDiaryEntryDisplay,
  type CalendarDiaryBlockStyle,
} from './calendarDiaryDisplay';

type ProjectionEntry = Pick<DiaryDocument, 'date' | 'content' | 'emoji' | 'photos'> &
  Partial<Pick<DiaryDocument, 'id'>>;

/** Read-only owner projection. Hidden entries are excluded even from the aggregate count. */
export function groupCalendarDiaryPreviews(
  entries: readonly ProjectionEntry[],
  defaultStyle: CalendarDiaryBlockStyle = 'text',
  getEntryDisplay?: (entryId: string) => unknown,
): Map<string, CalendarDiaryPreview> {
  const result = new Map<string, CalendarDiaryPreview>();
  for (const entry of entries) {
    const preference = entry.id ? resolveCalendarDiaryEntryDisplay(getEntryDisplay?.(entry.id)) : 'default';
    if (preference === 'hidden') continue;
    const style = preference === 'default' ? defaultStyle : preference;
    const previous = result.get(entry.date);
    if (previous) {
      // Multiple entries share one block; never expose a selected entry's excerpt.
      const iconOnly = previous.style === 'icon' && style === 'icon';
      result.set(entry.date, {
        entryCount: previous.entryCount + 1, excerpt: '', emoji: '',
        ...(iconOnly ? { style: 'icon' as const } : {}),
      });
      continue;
    }
    if (style === 'icon') {
      result.set(entry.date, { entryCount: 1, excerpt: '', emoji: '', style: 'icon' });
      continue;
    }
    const firstLine = (entry.content ?? '').split(/\r?\n/).map(line => line.trim()).find(Boolean);
    const fallback = !firstLine && parseDiaryPhotos(entry.photos).length > 0 ? 'Photo diary entry' : 'Diary entry';
    result.set(entry.date, {
      entryCount: 1,
      excerpt: (firstLine || fallback).slice(0, 120),
      emoji: entry.emoji || '',
    });
  }
  return result;
}
