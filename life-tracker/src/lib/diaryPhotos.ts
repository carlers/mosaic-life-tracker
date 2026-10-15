/** Only owned, storage-backed file IDs may be persisted. Never store data URLs in diary rows. */
const MAX_PHOTOS = 5;
const MAX_FILE_ID_LENGTH = 36;
const FILE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
export function parseDiaryPhotos(raw: unknown): string[] {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const ids: unknown = JSON.parse(raw);
    if (!Array.isArray(ids)) return [];
    return ids.filter((id): id is string => typeof id === 'string' &&
      id.length <= MAX_FILE_ID_LENGTH && FILE_ID.test(id)).slice(0, MAX_PHOTOS);
  } catch { return []; }
}
export function serializeDiaryPhotos(ids: readonly string[]): string {
  if (ids.length > MAX_PHOTOS || new Set(ids).size !== ids.length ||
    ids.some(id => id.length > MAX_FILE_ID_LENGTH || !FILE_ID.test(id))) {
    throw new Error('Diary supports up to five distinct photos.');
  }
  return JSON.stringify(ids);
}
