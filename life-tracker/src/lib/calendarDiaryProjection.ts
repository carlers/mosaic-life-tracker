import type { DiaryDocument } from '../db/schema';
import { parseDiaryPhotos } from './diaryPhotos';
import type { CalendarDiaryPreview } from './calendarDiary';

/** Display-only projection. Even multiple diary entries consume at most one calendar slot. */
export function groupCalendarDiaryPreviews(
  entries: readonly Pick<DiaryDocument, 'date' | 'content' | 'emoji' | 'photos'>[],
): Map<string, CalendarDiaryPreview> {
  const result = new Map<string, CalendarDiaryPreview>();
  for (const entry of entries) {
    const previous = result.get(entry.date);
    if (previous) {
      result.set(entry.date, { entryCount: previous.entryCount + 1, excerpt: '', emoji: '' });
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

