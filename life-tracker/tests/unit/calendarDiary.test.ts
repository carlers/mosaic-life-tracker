import { describe, expect, it } from 'vitest';
import { allocateCalendarPreviewSlots } from '../../src/lib/preferences';
import { groupCalendarDiaryPreviews } from '../../src/lib/calendarDiaryProjection';
import type { DiaryDocument } from '../../src/db/schema';

const entry = (date: string, content: string, emoji = '', photos = '[]'):
  Pick<DiaryDocument, 'date' | 'content' | 'emoji' | 'photos'> =>
  ({ date, content, emoji, photos });

describe('Calendar diary display projection', () => {
  it('groups multiple same-date entries and preserves the first content line for individual days', () => {
    const previews = groupCalendarDiaryPreviews([
      entry('2026-11-08', 'Morning\nThoughts', '☀️'),
      entry('2026-11-08', 'Evening note'),
      entry('2026-11-09', '  First line  \nrest'),
    ]);
    expect(previews.get('2026-11-08')).toEqual({ entryCount: 2, excerpt: '', emoji: '' });
    expect(previews.get('2026-11-09')).toEqual({ entryCount: 1, excerpt: 'First line', emoji: '' });
    expect(previews.size).toBe(2);
  });

  it('uses a generic label for photo-only diaries and does not need to load any photo bytes', () => {
    const previews = groupCalendarDiaryPreviews([
      entry('2026-11-08', '', '', '["photo_123"]'),
      entry('2026-11-09', '', '🌸'),
    ]);
    expect(previews.get('2026-11-08')?.excerpt).toBe('Photo diary entry');
    expect(previews.get('2026-11-09')).toEqual({ entryCount: 1, excerpt: 'Diary entry', emoji: '🌸' });
  });

  it.each([3, 5, 8, 10, 15, 20, 'unlimited'] as const)(
    'reserves one diary slot only when counted at preview limit %s', limit => {
      const counted = allocateCalendarPreviewSlots(limit, 30, 2, true, true);
      const excluded = allocateCalendarPreviewSlots(limit, 30, 2, true, false);
      const slots = limit === 'unlimited' ? 32 : limit;
      expect(counted.ownedVisibleCount + counted.sharedVisibleCount).toBe(
        limit === 'unlimited' ? 32 : slots - 1);
      expect(excluded.ownedVisibleCount + excluded.sharedVisibleCount).toBe(slots);
    });

  it('respects task priority and does not reserve for a missing diary', () => {
    expect(allocateCalendarPreviewSlots(3, 2, 3, false, true)).toEqual({
      ownedVisibleCount: 2, sharedVisibleCount: 1, hiddenTaskCount: 2,
    });
    expect(allocateCalendarPreviewSlots(3, 2, 3, true, true)).toEqual({
      ownedVisibleCount: 2, sharedVisibleCount: 0, hiddenTaskCount: 3,
    });
    expect(allocateCalendarPreviewSlots(0, 2, 3, false, false)).toEqual({
      ownedVisibleCount: 0, sharedVisibleCount: 0, hiddenTaskCount: 5,
    });
  });
});
