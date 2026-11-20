import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import { captureAccountWorkGeneration } from '../lib/accountWorkScope';
import type { DiaryDocument } from '../db/schema';

export type DiaryVisibility = DiaryDocument['visibility'];

/** Stable ordering even for offline entries created in the same millisecond. */
export function sortDiaryEntries<T extends Pick<DiaryDocument, 'id' | 'createdAt'>>(entries: readonly T[], newestFirst = false): T[] {
  return [...entries].sort((left, right) =>
    (newestFirst ? -1 : 1) *
    ((left.createdAt || '').localeCompare(right.createdAt || '') || left.id.localeCompare(right.id)));
}

/** Capture before loading the lazy writer, so an intervening account switch fails closed. */
function captureOwnerWork(ownerId: string): number {
  const generation = captureAccountWorkGeneration(ownerId);
  if (generation === null) throw new Error('Diary account changed. Reopen the entry.');
  return generation;
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
  const getEntryById = useCallback((id: string): DiaryDocument | undefined =>
    entries.find(item => item.id === id && !item.isDeleted), [entries]);

  // Editing is uncommon on the initial Home paint. Load mutation validation,
  // database lookup and write logic on demand, not in Home's static closure.
  const createEntry = useCallback(async (
    date: string, content: string, visibility: DiaryVisibility = 'private', emoji = '', photos?: string
  ): Promise<string> => {
    const ownerId = user?.$id;
    if (!ownerId) throw new Error('You must be signed in to save a diary entry.');
    const generation = captureOwnerWork(ownerId);
    const { createDiaryEntry } = await import('../lib/diaryEntryMutations');
    return createDiaryEntry(ownerId, generation, date, content, visibility, emoji, photos);
  }, [user?.$id]);

  const updateEntry = useCallback(async (
    entryId: string, date: string, content: string, visibility: DiaryVisibility, emoji = '', photos?: string
  ): Promise<void> => {
    const ownerId = user?.$id;
    if (!ownerId) throw new Error('You must be signed in to save a diary entry.');
    const generation = captureOwnerWork(ownerId);
    const { updateDiaryEntry } = await import('../lib/diaryEntryMutations');
    await updateDiaryEntry(ownerId, generation, entryId, date, content, visibility, emoji, photos);
  }, [user?.$id]);

  const deleteEntryById = useCallback(async (entryId: string): Promise<void> => {
    const ownerId = user?.$id;
    if (!ownerId) throw new Error('You must be signed in to delete a diary entry.');
    const generation = captureOwnerWork(ownerId);
    const { deleteDiaryEntry } = await import('../lib/diaryEntryMutations');
    await deleteDiaryEntry(ownerId, generation, entryId);
  }, [user?.$id]);

  return {
    entries, isLoading, getEntriesByDate, getEntryById,
    createEntry, updateEntry, deleteEntryById,
  };
}
