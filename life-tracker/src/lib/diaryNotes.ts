import type { CategoryDocument, DiaryDocument } from '../db/schema';

/** Private owner-scoped synced settings; the remote Diary record is unchanged.
 * Entries are keyed by immutable IDs rather than date so multiple entries coexist. */
export const diaryNoteTitleKey = (id: string) => `diaryNoteTitle:${id}`;
export const diaryNoteCategoryKey = (id: string) => `diaryNoteCategory:${id}`;
export const diaryNotePositionKey = (id: string) => `diaryNotePosition:${id}`;
export const diaryDayLayoutKey = (date: string) => `diaryDayLayout:${date}`;

export const MAX_DIARY_NOTE_TITLE = 120;

export function normalizeDiaryNoteTitle(value: unknown): string {
  return typeof value === 'string'
    ? Array.from(value.trim()).slice(0, MAX_DIARY_NOTE_TITLE).join('')
    : '';
}

export function noteTitleFor(entry: DiaryDocument, getSetting?: (key: string) => unknown): string {
  return getSetting ? normalizeDiaryNoteTitle(getSetting(diaryNoteTitleKey(entry.id))) : '';
}

export function noteDisplayTitle(entry: DiaryDocument, getSetting?: (key: string) => unknown): string {
  return noteTitleFor(entry, getSetting) ||
    entry.content?.split('\n').map(line => line.trim()).find(Boolean) || 'Diary entry';
}

/** Unknown or deleted categories must never remove a diary entry from the UI. */
export function noteCategoryId(
  entryId: string,
  getSetting: (key: string) => unknown,
  categories: readonly Pick<CategoryDocument, 'id' | 'isDeleted'>[],
): string {
  const candidate = getSetting(diaryNoteCategoryKey(entryId));
  return typeof candidate === 'string' &&
    categories.some(cat => !cat.isDeleted && cat.id === candidate) ? candidate : '';
}

/** A position is a display-only anchor, never an entry's category or date. */
export type DiaryNotePosition = {
  categoryId: string;
  anchorTaskId?: string;
  side?: 'before' | 'after';
  rank: number;
};

export function resolveDiaryNotePosition(value: unknown): DiaryNotePosition | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (typeof data.categoryId !== 'string' || !data.categoryId ||
      typeof data.rank !== 'number' || !Number.isFinite(data.rank) ||
      Math.abs(data.rank) > 1_000_000) return null;
  const anchorTaskId = typeof data.anchorTaskId === 'string' &&
    /^[a-zA-Z0-9_.-]{1,36}$/.test(data.anchorTaskId) ? data.anchorTaskId : undefined;
  const side = data.side === 'before' || data.side === 'after' ? data.side : undefined;
  return { categoryId: data.categoryId, rank: data.rank,
    ...(anchorTaskId && side ? { anchorTaskId, side } : {}) };
}

export type DiaryDayLayout = 'grouped' | 'distributed';
export function resolveDiaryDayLayout(value: unknown): DiaryDayLayout {
  return value === 'distributed' ? 'distributed' : 'grouped';
}
