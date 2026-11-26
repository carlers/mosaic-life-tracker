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
  // Build the interleaved rows in one pass. The previous loop spliced every
  // note into a growing array and scanned earlier tasks for every note (O(N²)
  // on dense Diary days). Grouped slots also remain stable for equal ranks.
  const buckets = new Map<string, Map<number, Item[]>>();
  const ordered = [...placedNotes].sort((a, b) =>
    a.position.categoryId.localeCompare(b.position.categoryId) ||
    a.slot - b.slot ||
    (a.position.noteOrder ?? a.position.rank) - (b.position.noteOrder ?? b.position.rank) ||
    a.entry.id.localeCompare(b.entry.id));
  for (const note of ordered) {
    const categoryId = note.position.categoryId;
    if (!(categoryId in tasks)) continue;
    const slot = Math.max(0, Math.min(tasks[categoryId].length, note.slot));
    let category = buckets.get(categoryId);
    if (!category) { category = new Map(); buckets.set(categoryId, category); }
    const notes = category.get(slot) ?? [];
    notes.push({ kind: 'note', id: note.entry.id });
    category.set(slot, notes);
  }
  const mixed: Record<string, Item[]> = {};
  for (const [categoryId, taskIds] of Object.entries(tasks)) {
    const row: Item[] = [];
    const slots = buckets.get(categoryId);
    for (let index = 0; index <= taskIds.length; index++) {
      const notes = slots?.get(index);
      if (notes) row.push(...notes);
      if (index < taskIds.length) row.push({ kind: 'task', id: taskIds[index] });
    }
    mixed[categoryId] = row;
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
    let count = 0;
    index = dest.length;
    for (let i = 0; i < dest.length; i++) {
      if (dest[i].kind !== 'task') continue;
      if (count === drop.index) { index = i; break; }
      count++;
    }
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
    const followingTask = new Array<string>(row.length);
    let nearestTask = '';
    for (let i = row.length - 1; i >= 0; i--) {
      followingTask[i] = nearestTask;
      if (row[i].kind === 'task') nearestTask = row[i].id;
    }
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
      const nextTaskId = followingTask[i];
      notePositions[item.id] = {
        categoryId, rank: count, noteOrder: noteOrder++,
        ...(nextTaskId ? { anchorTaskId: nextTaskId, side: 'before' as const }
          : precedingTask ? { anchorTaskId: precedingTask, side: 'after' as const } : {}),
      };
    }
  }
  return { tasks: taskPlacement, notes: notePositions };
}
