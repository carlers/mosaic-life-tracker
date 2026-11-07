import type { CalendarTaskPreviewLimit } from './preferences';

export interface CalendarDiaryPreview {
  entryCount: number;
  excerpt: string;
  emoji: string;
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
