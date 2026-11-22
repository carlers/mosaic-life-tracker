import type { TaskPlacement } from './taskOrder';
import type { DiaryNotePosition } from './diaryNotes';
import type { PlacedDiaryNote } from './diaryNoteLayout';

type Item = { kind: 'task' | 'note'; id: string };
export type DiaryMixedDrop =
  | { categoryId: string; position: 'start' }
  | { categoryId: string; position: 'index'; index: number }
  | { categoryId: string; position: 'before' | 'after'; taskId: string }
  | { categoryId: string; position: 'note'; noteId: string; side: 'before' | 'after' };
export type DiaryMixedSource = { kind: 'task' | 'note'; id: string };
export type DiaryMixedProjection = {
  tasks: TaskPlacement;
  notes: Record<string, DiaryNotePosition>;
};

const entryKey = (entry: Item) => `${entry.kind}:${entry.id}`;

/** One deterministic mixed sequence is the authority for both task and note drops.
 * No task row becomes a diary row in the database, and no diary row is mutated. */
export function projectDiaryMixedMove(
  tasks: TaskPlacement,
  placedNotes: readonly PlacedDiaryNote[],
  source: DiaryMixedSource,
  drop: DiaryMixedDrop,
): DiaryMixedProjection | null {
  if (!(drop.categoryId in tasks)) return null;
  const mixed: Record<string, Item[]> = {};
  for (const [category, taskIds] of Object.entries(tasks))
    mixed[category] = taskIds.map(id => ({ kind: 'task', id }));
  // Slot order includes multiple notes between the same two tasks.
  const ordered = [...placedNotes].sort((a, b) =>
    a.position.categoryId.localeCompare(b.position.categoryId) ||
    a.slot - b.slot ||
    (a.position.noteOrder ?? a.position.rank) - (b.position.noteOrder ?? b.position.rank) ||
    a.entry.id.localeCompare(b.entry.id));
  for (const note of ordered) {
    const category = note.position.categoryId;
    if (!(category in mixed)) continue;
    const row = mixed[category];
    const taskSlot = Math.max(0, Math.min(tasks[category].length, note.slot));
    let location = 0;
    let count = 0;
    // Keep notes with equal task slot in their persisted relative order.
    while (location < row.length && count < taskSlot) {
      if (row[location].kind === 'task') count++;
      location++;
    }
    while (location < row.length && row[location].kind === 'note') location++;
    row.splice(location, 0, { kind: 'note', id: note.entry.id });
  }
  const sourceKey = entryKey(source);
  let sourceFound = false;
  for (const row of Object.values(mixed)) {
    const i = row.findIndex(item => entryKey(item) === sourceKey);
    if (i >= 0) {
      row.splice(i, 1);
      sourceFound = true;
      break;
    }
  }
  // An entry still in the diary group can be dragged directly into a category.
  if (!sourceFound && source.kind !== 'note') return null;
  const dest = mixed[drop.categoryId];
  let index: number;
  if (drop.position === 'start') index = 0;
  else if (drop.position === 'index') {
    if (!Number.isInteger(drop.index) || drop.index < 0) return null;
    const at = dest.findIndex((item, i) => item.kind === 'task' &&
      dest.slice(0, i).filter(before => before.kind === 'task').length === drop.index);
    index = at < 0 ? dest.length : at;
  } else {
    const wanted = drop.position === 'note'
      ? `note:${drop.noteId}` : `task:${drop.taskId}`;
    const found = dest.findIndex(item => entryKey(item) === wanted);
    if (found < 0) return null;
    const side = drop.position === 'note' ? drop.side : drop.position;
    index = found + (side === 'after' ? 1 : 0);
  }
  dest.splice(index, 0, source);
  const taskPlacement: TaskPlacement = {};
  const notePositions: Record<string, DiaryNotePosition> = {};
  for (const [categoryId, row] of Object.entries(mixed)) {
    taskPlacement[categoryId] = row.filter(item => item.kind === 'task').map(item => item.id);
    let count = 0;
    let noteOrder = 0;
    let precedingTask = '';
    for (let i = 0; i < row.length; i++) {
      const item = row[i];
      if (item.kind === 'task') {
        count++;
        noteOrder = 0;
        precedingTask = item.id;
        continue;
      }
      const nextTask = row.slice(i + 1).find(next => next.kind === 'task');
      notePositions[item.id] = {
        categoryId, rank: count, noteOrder: noteOrder++,
        ...(nextTask ? { anchorTaskId: nextTask.id, side: 'before' as const }
          : precedingTask ? { anchorTaskId: precedingTask, side: 'after' as const } : {}),
      };
    }
  }
  return { tasks: taskPlacement, notes: notePositions };
}
