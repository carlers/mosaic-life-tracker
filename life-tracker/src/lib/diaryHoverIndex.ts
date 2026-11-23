import type { TaskPlacement } from './taskOrder';
import type { PlacedDiaryNote } from './diaryNoteLayout';
import type { DiaryMixedDrop } from './diaryMixedOrder';

type Item = { kind: 'task' | 'note'; id: string };
interface CategoryHoverIndex {
  positions: ReadonlyMap<string, number>;
  taskOffsets: readonly number[];
  taskCountBefore: readonly number[];
  noteOrderBefore: readonly number[];
  length: number;
}
export type DiaryHoverIndex = ReadonlyMap<string, CategoryHoverIndex>;

const itemKey = (item: Item) => `${item.kind}:${item.id}`;

/**
 * Build one insertion index per drag rather than rebuilding the complete mixed
 * task/Diary projection for every hovered target. Each category is indexed
 * with the dragged source absent, matching projectDiaryMixedMove semantics.
 */
export function buildDiaryHoverIndex(
  tasks: TaskPlacement,
  notes: readonly PlacedDiaryNote[],
  draggedNoteId: string,
): DiaryHoverIndex {
  const buckets = new Map<string, Map<number, Item[]>>();
  const ordered = [...notes].sort((a, b) =>
    a.position.categoryId.localeCompare(b.position.categoryId) ||
    a.slot - b.slot ||
    (a.position.noteOrder ?? a.position.rank) - (b.position.noteOrder ?? b.position.rank) ||
    a.entry.id.localeCompare(b.entry.id));
  for (const note of ordered) {
    const categoryId = note.position.categoryId;
    if (note.entry.id === draggedNoteId || !(categoryId in tasks)) continue;
    const slot = Math.max(0, Math.min(tasks[categoryId].length, note.slot));
    let category = buckets.get(categoryId);
    if (!category) { category = new Map(); buckets.set(categoryId, category); }
    const slotNotes = category.get(slot) ?? [];
    slotNotes.push({ kind: 'note', id: note.entry.id });
    category.set(slot, slotNotes);
  }

  const result = new Map<string, CategoryHoverIndex>();
  for (const [categoryId, taskIds] of Object.entries(tasks)) {
    const items: Item[] = [];
    for (let index = 0; index <= taskIds.length; index++) {
      items.push(...(buckets.get(categoryId)?.get(index) ?? []));
      if (index < taskIds.length) items.push({ kind: 'task', id: taskIds[index] });
    }
    const positions = new Map<string, number>();
    const taskOffsets: number[] = [];
    const taskCountBefore = [0];
    const noteOrderBefore = [0];
    let taskCount = 0, noteOrder = 0;
    items.forEach((item, index) => {
      positions.set(itemKey(item), index);
      if (item.kind === 'task') {
        taskOffsets.push(index);
        taskCount++;
        noteOrder = 0;
      } else noteOrder++;
      taskCountBefore.push(taskCount);
      noteOrderBefore.push(noteOrder);
    });
    result.set(categoryId, {
      positions, taskOffsets, taskCountBefore, noteOrderBefore, length: items.length,
    });
  }
  return result;
}

/** Pure O(1) candidate lookup (plus one map access) after pickup indexing. */
export function resolveDiaryHoverSlot(
  index: DiaryHoverIndex,
  drop: DiaryMixedDrop,
): { categoryId: string; index: number; order: number } | null {
  const category = index.get(drop.categoryId);
  if (!category) return null;
  let insertion: number;
  if (drop.position === 'start') insertion = 0;
  else if (drop.position === 'index') {
    if (!Number.isInteger(drop.index) || drop.index < 0) return null;
    insertion = category.taskOffsets[drop.index] ?? category.length;
  } else {
    const rowKey = drop.position === 'note'
      ? `note:${drop.noteId}` : `task:${drop.taskId}`;
    const row = category.positions.get(rowKey);
    if (row === undefined) return null;
    const side = drop.position === 'note' ? drop.side : drop.position;
    insertion = row + (side === 'after' ? 1 : 0);
  }
  return {
    categoryId: drop.categoryId,
    index: category.taskCountBefore[insertion],
    order: category.noteOrderBefore[insertion],
  };
}
