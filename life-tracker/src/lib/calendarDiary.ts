import type { DiaryDocument } from '../db/schema';
import type { CalendarTaskPreviewLimit } from './preferences';
import { parseDiaryPhotos } from './diaryPhotos';

export interface CalendarDiaryPreview {
  entryCount: number;
  excerpt: string;
  emoji: string;
}

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

/** Task priority and hidden-task count are unchanged; diary only optionally reserves a slot. */
export function allocateCalendarPreviewSlots(
  limit: CalendarTaskPreviewLimit | 0,
  ownedCount: number,
  sharedCount: number,
  diaryVisible: boolean,
  diaryCountsTowardLimit: boolean,
): { ownedVisibleCount: number; sharedVisibleCount: number; hiddenTaskCount: number } {
  const slots = limit === 'unlimited'
    ? Infinity : Math.max(0, limit - (diaryVisible && diaryCountsTowardLimit ? 1 : 0));
  const ownedVisibleCount = Math.min(ownedCount, slots);
  const sharedVisibleCount = Math.min(sharedCount, Math.max(0, slots - ownedVisibleCount));
  return {
    ownedVisibleCount,
    sharedVisibleCount,
    hiddenTaskCount: ownedCount + sharedCount - ownedVisibleCount - sharedVisibleCount,
  };
}
