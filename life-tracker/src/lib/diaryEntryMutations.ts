import { getDatabase } from '../db/database';
import { upsertLocalDoc } from './localUpsert';
import { isAccountWorkCurrent } from './accountWorkScope';
import { parseDiaryPhotos, serializeDiaryPhotos } from './diaryPhotos';
import type { DiaryDocument } from '../db/schema';

type DiaryVisibility = DiaryDocument['visibility'];

function validDiaryDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
}

function assertOwnerWork(ownerId: string, generation: number): void {
  if (!isAccountWorkCurrent(ownerId, generation)) {
    throw new Error('Diary account changed. Reopen the entry.');
  }
}

function cleanPhotos(photos: string | undefined, existing?: DiaryDocument): string {
  const raw = photos === undefined ? existing?.photos : photos;
  const normalized = serializeDiaryPhotos(parseDiaryPhotos(raw));
  if (photos !== undefined && normalized !== photos) throw new Error('Invalid diary photo list.');
  return normalized;
}

function requireContent(content: string, emoji: string, photos: string, visibility: DiaryVisibility, allowTitleOnly = false): void {
  if (typeof content !== 'string' || typeof emoji !== 'string' || content.length > 100_000 ||
      emoji.length > 32 || !['private', 'public', 'followers'].includes(visibility)) {
    throw new Error('Invalid diary entry.');
  }
  if (!allowTitleOnly && !content.trim() && !emoji && parseDiaryPhotos(photos).length === 0) {
    throw new Error('Write a diary entry, choose an emoji, or attach a photo.');
  }
}

/** Owner-fenced lookup; a row ID from a friend or stale account is never editable. */
async function findById(id: string, ownerId: string) {
  const row = await getDatabase().diary.findOne(id).exec();
  if (!row || row.toJSON().userId !== ownerId || row.toJSON().isDeleted) {
    throw new Error('Diary entry is unavailable.');
  }
  return row;
}

export async function createDiaryEntry(
  ownerId: string, generation: number,
  date: string, content: string, visibility: DiaryVisibility = 'private', emoji = '', photos?: string,
  allowTitleOnly = false
): Promise<string> {
  assertOwnerWork(ownerId, generation);
  if (!validDiaryDate(date)) throw new Error('Invalid diary date.');
  const serialized = cleanPhotos(photos);
  requireContent(content, emoji, serialized, visibility, allowTitleOnly);
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = 'd_' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  const now = new Date().toISOString();
  assertOwnerWork(ownerId, generation);
  await upsertLocalDoc('diary', id, {
    id, date, content, emoji, photos: serialized, visibility,
    userId: ownerId, createdAt: now, updatedAt: now, isDeleted: false,
  } satisfies DiaryDocument);
  return id;
}

export async function updateDiaryEntry(
  ownerId: string, generation: number,
  entryId: string, date: string, content: string, visibility: DiaryVisibility, emoji = '', photos?: string,
  allowTitleOnly = false
): Promise<void> {
  assertOwnerWork(ownerId, generation);
  if (!validDiaryDate(date)) throw new Error('Invalid diary date.');
  const row = await findById(entryId, ownerId);
  assertOwnerWork(ownerId, generation);
  const existing = row.toJSON() as DiaryDocument;
  const serialized = cleanPhotos(photos, existing);
  requireContent(content, emoji, serialized, visibility, allowTitleOnly);
  assertOwnerWork(ownerId, generation);
  await upsertLocalDoc('diary', entryId, {
    ...existing, date, content, visibility, emoji, photos: serialized,
    updatedAt: new Date().toISOString(), isDeleted: false,
  } satisfies DiaryDocument);
}

export async function deleteDiaryEntry(
  ownerId: string, generation: number, entryId: string
): Promise<void> {
  assertOwnerWork(ownerId, generation);
  const row = await findById(entryId, ownerId);
  assertOwnerWork(ownerId, generation);
  await row.incrementalPatch({ isDeleted: true, updatedAt: new Date().toISOString() });
}
