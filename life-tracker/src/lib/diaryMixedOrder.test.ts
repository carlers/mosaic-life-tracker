import { describe, expect, it } from 'vitest';
import { projectDiaryMixedMove } from './diaryMixedOrder';
import type { DiaryDocument } from '../db/schema';
import type { PlacedDiaryNote } from './diaryNoteLayout';
const makeNote = (id: string, slot: number, categoryId = 'school', noteOrder = 0): PlacedDiaryNote => ({
  entry: { id, content: id, date: '2026-11-22', createdAt: id,
    visibility: 'private', userId: 'u', updatedAt: id, isDeleted: false } as DiaryDocument,
  position: { categoryId, rank: slot, noteOrder }, slot,
});
describe('interleaved task and diary reorder', () => {
  const tasks = { school: ['a', 'b'], personal: ['p'] };
  it('moving a task across a note keeps the note physically in place', () => {
    const moved = projectDiaryMixedMove(tasks, [makeNote('n', 1)],
      { kind: 'task', id: 'b' }, { categoryId: 'school', position: 'note', noteId: 'n', side: 'before' });
    expect(moved?.tasks.school).toEqual(['a', 'b']);
    expect(moved?.notes.n).toMatchObject({ categoryId: 'school', anchorTaskId: 'b', side: 'after', rank: 2 });
  });
  it('moving a task after a note changes note anchoring even when task order is unchanged', () => {
    const moved = projectDiaryMixedMove(tasks, [makeNote('n', 1)],
      { kind: 'task', id: 'a' }, { categoryId: 'school', position: 'note', noteId: 'n', side: 'after' });
    expect(moved?.tasks.school).toEqual(['a', 'b']);
    expect(moved?.notes.n).toMatchObject({ anchorTaskId: 'a', side: 'before', rank: 0 });
  });
  it('reorders two diary entries within the same task gap', () => {
    const notes = [makeNote('n1', 1, 'school', 0), makeNote('n2', 1, 'school', 1)];
    const moved = projectDiaryMixedMove(tasks, notes, { kind: 'note', id: 'n2' },
      { categoryId: 'school', position: 'note', noteId: 'n1', side: 'before' });
    expect(moved?.notes.n2.noteOrder).toBe(0);
    expect(moved?.notes.n1.noteOrder).toBe(1);
    expect(moved?.notes.n2.rank).toBe(1);
    expect(moved?.tasks.school).toEqual(['a', 'b']);
  });
  it('allows inserting a task between two notes', () => {
    const notes = [makeNote('n1', 1, 'school', 0), makeNote('n2', 1, 'school', 1)];
    const moved = projectDiaryMixedMove(tasks, notes, { kind: 'task', id: 'b' },
      { categoryId: 'school', position: 'note', noteId: 'n2', side: 'before' });
    expect(moved?.notes.n1).toMatchObject({ anchorTaskId: 'b', side: 'before' });
    expect(moved?.notes.n2).toMatchObject({ anchorTaskId: 'b', side: 'after' });
  });
  it('moves a grouped diary entry into an empty category without changing any task IDs', () => {
    const moved = projectDiaryMixedMove(tasks, [], { kind: 'note', id: 'new' },
      { categoryId: 'personal', position: 'start' });
    expect(moved?.notes.new).toMatchObject({ categoryId: 'personal', rank: 0, noteOrder: 0 });
    expect(moved?.tasks).toEqual(tasks);
  });
  it('moves a first-row diary note below the final note after the last task', () => {
    const notes = [makeNote('first', 0, 'school'), makeNote('last', 2, 'school')];
    const moved = projectDiaryMixedMove(tasks, notes,
      { kind: 'note', id: 'first' },
      { categoryId: 'school', position: 'note', noteId: 'last', side: 'after' });
    expect(moved?.tasks.school).toEqual(['a', 'b']);
    expect(moved?.notes.last).toMatchObject({
      categoryId: 'school', anchorTaskId: 'b', side: 'after', rank: 2, noteOrder: 0,
    });
    expect(moved?.notes.first).toMatchObject({
      categoryId: 'school', anchorTaskId: 'b', side: 'after', rank: 2, noteOrder: 1,
    });
    expect(Object.keys(moved?.notes ?? {}).sort()).toEqual(['first', 'last']);
  });
  it('moves a last-row diary note above the first note before the first task', () => {
    const notes = [makeNote('first', 0, 'school'), makeNote('last', 2, 'school')];
    const moved = projectDiaryMixedMove(tasks, notes,
      { kind: 'note', id: 'last' },
      { categoryId: 'school', position: 'note', noteId: 'first', side: 'before' });
    expect(moved?.tasks.school).toEqual(['a', 'b']);
    expect(moved?.notes.last).toMatchObject({
      categoryId: 'school', anchorTaskId: 'a', side: 'before', rank: 0, noteOrder: 0,
    });
    expect(moved?.notes.first).toMatchObject({
      categoryId: 'school', anchorTaskId: 'a', side: 'before', rank: 0, noteOrder: 1,
    });
    expect(Object.keys(moved?.notes ?? {}).sort()).toEqual(['first', 'last']);
  });
  it('preserves 120 same-slot diary entries and exact task identities on a dense reorder', () => {
    const longTasks = { school: Array.from({ length: 80 }, (_, i) => `task_${i}`), personal: [] };
    const longNotes = Array.from({ length: 120 }, (_, i) =>
      makeNote(`note_${i}`, 40, 'school', i));
    const moved = projectDiaryMixedMove(longTasks, longNotes,
      { kind: 'note', id: 'note_119' },
      { categoryId: 'school', position: 'note', noteId: 'note_0', side: 'before' });
    expect(moved?.tasks).toEqual(longTasks);
    expect(Object.keys(moved?.notes ?? {})).toHaveLength(120);
    expect(moved?.notes.note_119).toMatchObject({ rank: 40, noteOrder: 0 });
    expect(moved?.notes.note_0).toMatchObject({ rank: 40, noteOrder: 1 });
    expect(moved?.notes.note_118.noteOrder).toBe(119);
  });
  it('preserves notes on both sides of a task moved between categories', () => {
    const moved = projectDiaryMixedMove(
      { first: ['a', 'b'], second: ['c'] },
      [makeNote('n1', 1, 'first'), makeNote('n2', 1, 'second')],
      { kind: 'task', id: 'b' },
      { categoryId: 'second', position: 'note', noteId: 'n2', side: 'before' });
    expect(moved?.tasks.first).toEqual(['a']);
    expect(moved?.tasks.second).toEqual(['c', 'b']);
    expect(moved?.notes.n1).toMatchObject({ categoryId: 'first', rank: 1 });
    expect(moved?.notes.n2).toMatchObject({ categoryId: 'second', rank: 2 });
  });
    it('rejects invalid category and task targets, preserving source state', () => {
    expect(projectDiaryMixedMove(tasks, [], { kind: 'task', id: 'b' },
      { categoryId: 'missing', position: 'start' })).toBeNull();
    expect(projectDiaryMixedMove(tasks, [], { kind: 'task', id: 'b' },
      { categoryId: 'school', position: 'note', noteId: 'gone', side: 'before' })).toBeNull();
  });
});
