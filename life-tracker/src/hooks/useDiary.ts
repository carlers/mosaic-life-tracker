import { useCallback } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import { upsertLocalDoc } from '../lib/localUpsert';
import type { DiaryDocument } from '../db/schema';
import { parseDiaryPhotos, serializeDiaryPhotos } from '../lib/diaryPhotos';

export type DiaryVisibility = DiaryDocument['visibility'];

function validDiaryDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
}

/** Stable ordering even for offline entries created in the same millisecond. */
export function sortDiaryEntries<T extends Pick<DiaryDocument, 'id' | 'createdAt'>>(entries: readonly T[], newestFirst = false): T[] {
  return [...entries].sort((left, right) =>
    (newestFirst ? -1 : 1) *
    ((left.createdAt || '').localeCompare(right.createdAt || '') || left.id.localeCompare(right.id)));
}

function cleanPhotos(photos: string | undefined, existing?: DiaryDocument): string {
  const raw = photos === undefined ? existing?.photos : photos;
  const normalized = serializeDiaryPhotos(parseDiaryPhotos(raw));
  if (photos !== undefined && normalized !== photos) throw new Error('Invalid diary photo list.');
  return normalized;
}
function requireContent(content: string, emoji: string, photos: string): void {
  if (typeof content !== 'string' || content.length > 100_000 || emoji.length > 32) {
    throw new Error('Invalid diary entry.');
  }
  if (!content.trim() && !emoji && parseDiaryPhotos(photos).length === 0) {
    throw new Error('Write a diary entry, choose an emoji, or attach a photo.');
  }
}

export function useDiary(enabled = true) {
  const { user } = useAuth();
  const { data: entries, isLoading } = useRxCollection<DiaryDocument>({
    collection: 'diary',
    selector: { userId: user?.$id ?? '', isDeleted: false },
    sort: [{ date: 'desc' }],
    logPrefix: '[useDiary]',
    enabled,
  });

  const getEntriesByDate = useCallback((date: string): DiaryDocument[] =>
    sortDiaryEntries(entries.filter(item => item.date === date && !item.isDeleted)), [entries]);
  const getEntryByDate = useCallback((date: string): DiaryDocument | undefined =>
    getEntriesByDate(date)[0], [getEntriesByDate]);
  const getEntryById = useCallback((id: string): DiaryDocument | undefined =>
    entries.find(item => item.id === id && !item.isDeleted), [entries]);

  /** Owner-fenced lookup; a row ID received from a friend or stale account cannot be edited. */
  const findById = useCallback(async (id: string, ownerId: string) => {
    const row = await getDatabase().diary.findOne(id).exec();
    if (!row || row.get('userId') !== ownerId || row.get('isDeleted')) {
      throw new Error('Diary entry is unavailable.');
    }
    return row;
  }, []);

  const createEntry = useCallback(async (
    date: string, content: string, visibility: DiaryVisibility = 'private', emoji = '', photos?: string
  ): Promise<string> => {
    const ownerId = user?.$id;
    if (!ownerId) throw new Error('You must be signed in to save a diary entry.');
    if (!validDiaryDate(date)) throw new Error('Invalid diary date.');
    const serialized = cleanPhotos(photos);
    requireContent(content, emoji, serialized);
    // Prefix + UUID hex is 34 Appwrite-safe characters, with no date-derived collisions.
    const id = 'd_' + crypto.randomUUID().replace(/-/g, '');
    const now = new Date().toISOString();
    await upsertLocalDoc('diary', id, {
      id, date, content, emoji, photos: serialized, visibility,
      userId: ownerId, createdAt: now, updatedAt: now, isDeleted: false,
    } satisfies DiaryDocument);
    return id;
  }, [user?.$id]);

  const updateEntry = useCallback(async (
    entryId: string, date: string, content: string, visibility: DiaryVisibility, emoji = '', photos?: string
  ): Promise<void> => {
    const ownerId = user?.$id;
    if (!ownerId) throw new Error('You must be signed in to save a diary entry.');
    if (!validDiaryDate(date)) throw new Error('Invalid diary date.');
    const row = await findById(entryId, ownerId);
    const existing = row.toJSON() as DiaryDocument;
    const serialized = cleanPhotos(photos, existing);
    requireContent(content, emoji, serialized);
    await upsertLocalDoc('diary', entryId, {
      ...existing, date, content, visibility, emoji, photos: serialized,
      updatedAt: new Date().toISOString(), isDeleted: false,
    } satisfies DiaryDocument);
  }, [findById, user?.$id]);

  const deleteEntryById = useCallback(async (entryId: string): Promise<void> => {
    const ownerId = user?.$id;
    if (!ownerId) throw new Error('You must be signed in to delete a diary entry.');
    const row = await findById(entryId, ownerId);
    await row.incrementalPatch({ isDeleted: true, updatedAt: new Date().toISOString() });
  }, [findById, user?.$id]);

  /** Legacy date API remains safe for exactly one entry; never choose an arbitrary sibling. */
  const findSingleByDate = useCallback(async (date: string): Promise<DiaryDocument | undefined> => {
    const ownerId = user?.$id;
    if (!ownerId) throw new Error('You must be signed in to use diary.');
    if (!validDiaryDate(date)) throw new Error('Invalid diary date.');
    const rows = await getDatabase().diary.find({ selector: { userId: ownerId, date } }).exec();
    const active = rows.map(item => item.toJSON() as DiaryDocument).filter(item => !item.isDeleted);
    if (active.length > 1) throw new Error('Select the diary entry to edit; this day contains multiple entries.');
    return active[0];
  }, [user?.$id]);

  const saveEntry = useCallback(async (
    date: string, content: string, visibility?: DiaryVisibility, emoji = '', photos?: string
  ) => {
    const existing = await findSingleByDate(date);
    if (existing) {
      await updateEntry(existing.id, date, content, visibility ?? existing.visibility, emoji, photos);
    } else {
      await createEntry(date, content, visibility ?? 'private', emoji, photos);
    }
  }, [findSingleByDate, updateEntry, createEntry]);

  const deleteEntry = useCallback(async (date: string) => {
    const existing = await findSingleByDate(date);
    if (existing) await deleteEntryById(existing.id);
  }, [findSingleByDate, deleteEntryById]);

  return {
    entries, isLoading, getEntriesByDate, getEntryByDate, getEntryById,
    createEntry, updateEntry, deleteEntryById,
    saveEntry, deleteEntry,
  };
}
