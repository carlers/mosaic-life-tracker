import { describe, expect, it } from 'vitest';
import { filterAndRankDiary } from './diarySearch';
import { diaryNoteTitleKey, diaryNoteCategoryKey, diaryNotePositionKey,
  normalizeDiaryNoteTitle, resolveDiaryNotePosition } from './diaryNotes';
import type { DiaryDocument, CategoryDocument } from '../db/schema';

const base = { visibility: 'private', userId: 'owner', updatedAt: '2026-11-22T00:00:00Z',
  isDeleted: false } as const;
const entries: DiaryDocument[] = [
  { ...base, id: 'd_a', date: '2026-11-20', content: 'A lecture about neural networks',
    createdAt: '2026-11-20T01:00:00Z' },
  { ...base, id: 'd_b', date: '2026-11-20', content: 'Other thoughts',
    createdAt: '2026-11-20T02:00:00Z' },
];
const categories: CategoryDocument[] = [
  { id: 'school', name: 'School', color: '#fff', order: 0, visibility: 'private',
    userId: 'owner', isDeleted: false, updatedAt: base.updatedAt },
];
const values: Record<string, unknown> = {
  [diaryNoteTitleKey('d_b')]: 'Neural notes',
  [diaryNoteCategoryKey('d_b')]: 'school',
};
const getSetting = (key: string) => values[key];
const options = { query: 'neural', categoryIds: [], dateFilter: 'any' as const };

describe('Diary as Notes owner-only selectors', () => {
  it('ranks explicit title over matching body and retains exact entry IDs', () => {
    const result = filterAndRankDiary(entries, options, categories, getSetting);
    expect(result.results.map(hit => hit.entry.id)).toEqual(['d_b', 'd_a']);
    expect(result.results[1].excerpt).toContain('neural');
  });
  it('filters by linked category without including unassigned notes', () => {
    expect(filterAndRankDiary(entries, { ...options, categoryIds: ['school'] },
      categories, getSetting).results.map(hit => hit.entry.id)).toEqual(['d_b']);
  });
  it('keeps same-day independent entries and paginates', () => {
    expect(filterAndRankDiary(entries, { ...options, query: '', limit: 1 },
      categories, getSetting).total).toBe(2);
  });
  it('ignores a missing category and invalid placement', () => {
    expect(filterAndRankDiary(entries, { ...options, categoryIds: ['deleted'] },
      categories, getSetting).total).toBe(0);
    expect(resolveDiaryNotePosition({ categoryId: 'school', rank: Infinity })).toBeNull();
    expect(resolveDiaryNotePosition({ categoryId: 'school', rank: 1,
      anchorTaskId: 'invalid id', side: 'before' })?.anchorTaskId).toBeUndefined();
    expect(diaryNotePositionKey('d_a')).toBe('diaryNotePosition:d_a');
  });
  it('bounds title length by Unicode codepoint', () => {
    expect(Array.from(normalizeDiaryNoteTitle('🙂'.repeat(125)))).toHaveLength(120);
  });
});
