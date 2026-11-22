import { describe, expect, it } from 'vitest';
import { diaryDayLayoutKey, diaryNotePositionKey } from './diaryNotes';
import { projectDiaryNoteLayout } from './diaryNoteLayout';
import type { DiaryDocument, CategoryDocument, TaskDocument } from '../db/schema';
const meta = { userId: 'u', visibility: 'private', isDeleted: false,
  createdAt: '2026-11-22T00:00:00Z', updatedAt: '2026-11-22T00:00:00Z' } as const;
const entries: DiaryDocument[] = [
  { ...meta, id: 'a', date: '2026-11-22', content: 'A' },
  { ...meta, id: 'b', date: '2026-11-22', content: 'B' },
  { ...meta, id: 'c', date: '2026-11-22', content: 'C' },
];
const cat = { id: 'school', name: 'School', color: '#fff', order: 0, ...meta } as CategoryDocument;
const tasks = new Map<string, TaskDocument[]>([['school',
  [{ ...meta, id: 'one', categoryId: 'school', title: 'Task one', completed: false, order: 0, date: '2026-11-22' } as TaskDocument]]]);
describe('reversible private Diary layout', () => {
  const base: Record<string, unknown> = {
    [diaryNotePositionKey('a')]: { categoryId: 'school', anchorTaskId: 'one', side: 'before', rank: 0 },
    [diaryNotePositionKey('b')]: { categoryId: 'school', anchorTaskId: 'one', side: 'after', rank: 1 },
  };
  it('defaults to one group and does not lose positions', () => {
    const plan = projectDiaryNoteLayout('2026-11-22', entries, [cat], tasks, key => base[key]);
    expect(plan.grouped).toHaveLength(3);
    expect(plan.placed).toHaveLength(0);
    expect(plan.savedCount).toBe(2);
  });
  it('restores only saved positions and keeps other entries grouped', () => {
    const plan = projectDiaryNoteLayout('2026-11-22', entries, [cat], tasks,
      key => key === diaryDayLayoutKey('2026-11-22') ? 'distributed' : base[key]);
    expect(plan.grouped.map(entry => entry.id)).toEqual(['c']);
    expect(plan.placed.map(value => [value.entry.id, value.slot]))
      .toEqual([['a', 0], ['b', 1]]);
  });
  it('never hides an entry when its category disappears', () => {
    const plan = projectDiaryNoteLayout('2026-11-22', entries, [], tasks,
      key => key === diaryDayLayoutKey('2026-11-22') ? 'distributed' : base[key]);
    expect(plan.grouped).toHaveLength(3);
    expect(plan.placed).toHaveLength(0);
  });
});
