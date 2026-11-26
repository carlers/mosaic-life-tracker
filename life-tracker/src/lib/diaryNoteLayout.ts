import type { CategoryDocument, DiaryDocument, TaskDocument } from '../db/schema';
import { diaryDayLayoutKey, diaryNotePositionKey, resolveDiaryDayLayout,
  resolveDiaryNotePosition, type DiaryNotePosition } from './diaryNotes';

export interface PlacedDiaryNote {
  entry: DiaryDocument;
  position: DiaryNotePosition;
  slot: number;
}

/** Display projection only; owner-private settings never change a Diary record. */
export function projectDiaryNoteLayout(
  date: string,
  entries: readonly DiaryDocument[],
  categories: readonly CategoryDocument[],
  tasksByCategory: ReadonlyMap<string, readonly TaskDocument[]>,
  getSetting: (key: string) => unknown,
) {
  const mode = resolveDiaryDayLayout(getSetting(diaryDayLayoutKey(date)));
  const valid = new Set(categories.filter(cat => !cat.isDeleted).map(cat => cat.id));
  // Anchor lookups must not rescan every task for every note during a drag.
  const indexes = new Map<string, Map<string, number>>();
  for (const [categoryId, tasks] of tasksByCategory) {
    indexes.set(categoryId, new Map(tasks.map((task, index) => [task.id, index])));
  }
  const grouped: DiaryDocument[] = [];
  const placed: PlacedDiaryNote[] = [];
  let savedCount = 0;
  for (const entry of entries) {
    if (entry.date !== date || entry.isDeleted) continue;
    const position = resolveDiaryNotePosition(getSetting(diaryNotePositionKey(entry.id)));
    if (!position || !valid.has(position.categoryId)) {
      grouped.push(entry);
      continue;
    }
    savedCount++;
    if (mode === 'grouped') { grouped.push(entry); continue; }
    const tasks = tasksByCategory.get(position.categoryId) ?? [];
    const index = position.anchorTaskId
      ? indexes.get(position.categoryId)?.get(position.anchorTaskId) ?? -1
      : -1;
    const slot = index >= 0
      ? index + (position.side === 'after' ? 1 : 0)
      : Math.max(0, Math.min(tasks.length, Math.trunc(position.rank)));
    placed.push({ entry, position, slot });
  }
  placed.sort((a, b) =>
    a.position.categoryId.localeCompare(b.position.categoryId) ||
    a.slot - b.slot ||
    (a.position.noteOrder ?? a.position.rank) - (b.position.noteOrder ?? b.position.rank) ||
    a.entry.createdAt.localeCompare(b.entry.createdAt) ||
    a.entry.id.localeCompare(b.entry.id));
  return { mode, grouped, placed, savedCount, total: grouped.length + placed.length };
}
