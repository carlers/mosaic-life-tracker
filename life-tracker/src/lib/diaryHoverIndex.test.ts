import { describe, expect, it } from 'vitest';
import type { DiaryDocument } from '../db/schema';
import type { PlacedDiaryNote } from './diaryNoteLayout';
import { buildDiaryHoverIndex, resolveDiaryHoverSlot } from './diaryHoverIndex';
import { projectDiaryMixedMove, type DiaryMixedDrop } from './diaryMixedOrder';
import type { TaskPlacement } from './taskOrder';

const note = (id: string, categoryId: string, slot: number, noteOrder = 0): PlacedDiaryNote => ({
  entry: { id, userId: 'owner', date: '2026-11-23', content: id,
    createdAt: id, updatedAt: id, visibility: 'private', isDeleted: false } as DiaryDocument,
  slot, position: { categoryId, rank: slot, noteOrder },
});

const taskDrops = (tasks: TaskPlacement, notes: readonly PlacedDiaryNote[]): DiaryMixedDrop[] => {
  const drops: DiaryMixedDrop[] = [];
  for (const [categoryId, taskIds] of Object.entries(tasks)) {
    drops.push({ categoryId, position: 'start' });
    for (let index = 0; index <= taskIds.length + 1; index++)
      drops.push({ categoryId, position: 'index', index });
    for (const taskId of taskIds) for (const position of ['before', 'after'] as const)
      drops.push({ categoryId, position, taskId });
    for (const candidate of notes.filter(item => item.position.categoryId === categoryId))
      for (const side of ['before', 'after'] as const)
        drops.push({ categoryId, position: 'note', noteId: candidate.entry.id, side });
  }
  return drops;
};

describe('indexed mixed Diary insertion parity', () => {
  const tasks = { work: ['a', 'b', 'c'], home: ['x', 'y'], empty: [] };
  const notes = [
    note('first', 'work', 0), note('sameA', 'work', 1, 0),
    note('sameB', 'work', 1, 1), note('last', 'work', 3),
    note('homeFirst', 'home', 0), note('homeLast', 'home', 2),
  ];

  it('matches complete saved projections for all task/note anchors and category edges', () => {
    const drops = taskDrops(tasks, notes);
    for (const dragged of [...notes.map(item => item.entry.id), 'grouped']) {
      const index = buildDiaryHoverIndex(tasks, notes, dragged);
      for (const drop of drops) {
        const projected = projectDiaryMixedMove(tasks, notes,
          { kind: 'note', id: dragged }, drop);
        const expected = projected?.notes[dragged];
        const actual = resolveDiaryHoverSlot(index, drop);
        if (!expected) expect(actual, JSON.stringify({ dragged, drop })).toBeNull();
        else expect(actual, JSON.stringify({ dragged, drop })).toEqual({
          categoryId: expected.categoryId,
          index: expected.rank,
          order: expected.noteOrder ?? 0,
        });
      }
    }
  });

  it('rejects stale source and invalid targets without inventing an insertion position', () => {
    const index = buildDiaryHoverIndex(tasks, notes, 'first');
    expect(resolveDiaryHoverSlot(index, {
      categoryId: 'work', position: 'note', noteId: 'first', side: 'after',
    })).toBeNull();
    expect(resolveDiaryHoverSlot(index, {
      categoryId: 'invalid', position: 'start',
    })).toBeNull();
    expect(resolveDiaryHoverSlot(index, {
      categoryId: 'work', position: 'before', taskId: 'missing',
    })).toBeNull();
    expect(resolveDiaryHoverSlot(index, {
      categoryId: 'work', position: 'index', index: -1,
    })).toBeNull();
  });

  it('avoids rebuilding the full sequence during dense 100-task/120-note hover', () => {
    const denseTasks = { work: Array.from({ length: 100 }, (_, i) => `task_${i}`), home: [] };
    const denseNotes = Array.from({ length: 120 }, (_, i) => note(`note_${i}`, 'work', 60, i));
    const index = buildDiaryHoverIndex(denseTasks, denseNotes, 'note_119');
    for (const position of [0, 60, 100]) {
      const drop = { categoryId: 'work', position: 'index' as const, index: position };
      const saved = projectDiaryMixedMove(denseTasks, denseNotes,
        { kind: 'note', id: 'note_119' }, drop)!.notes.note_119;
      expect(resolveDiaryHoverSlot(index, drop)).toEqual({
        categoryId: 'work', index: saved.rank, order: saved.noteOrder,
      });
    }
    const moveAboveFirst = resolveDiaryHoverSlot(index, {
      categoryId: 'work', position: 'note', noteId: 'note_0', side: 'before',
    });
    expect(moveAboveFirst).toEqual({ categoryId: 'work', index: 60, order: 0 });
  });
});
