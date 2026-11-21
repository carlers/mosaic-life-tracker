import type { DiaryDocument } from '../db/schema';
import { diaryMarker } from './diaryMarker';

export type DiaryEntryOrderMode = 'oldest' | 'newest' | 'manual';
export type DiaryOrderEntry = Pick<DiaryDocument, 'id' | 'date' | 'createdAt' | 'emoji' | 'content'> &
  Partial<Pick<DiaryDocument, 'isDeleted'>>;
export const diaryEntryOrderModeKey = (date: string) => `diaryEntryOrderMode:${date}`;
export const diaryManualOrderKey = (date: string) => `diaryManualOrder:${date}`;
export const diaryMonthEmojiKey = (date: string) => `diaryMonthEmoji:${date}`;
export const AUTO_DIARY_MONTH_EMOJI = 'auto';

export function resolveDiaryEntryOrderMode(value: unknown): DiaryEntryOrderMode {
  return value === 'newest' || value === 'manual' ? value : 'oldest';
}
const VALID_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,35}$/;
export function sanitizeDiaryManualOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [], seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || !VALID_ID.test(item) || seen.has(item)) continue;
    seen.add(item); ids.push(item);
  }
  return ids;
}
/** Revision-tagged fixed-size slots retain arbitrarily long manual orders in
 * the existing owner-scoped settings collection, never new backend columns. */
const IDS_PER_CHUNK = 100;
export function readDiaryManualOrder(date: string, getSetting: (key: string) => unknown): string[] {
  const key = diaryManualOrderKey(date), value = getSetting(key);
  if (Array.isArray(value)) return sanitizeDiaryManualOrder(value);
  if (!value || typeof value !== 'object') return [];
  const manifest = value as Record<string, unknown>;
  if (typeof manifest.version !== 'string' ||
    !/^[a-z0-9]+_[a-z0-9]{6,12}$/.test(manifest.version) ||
    (manifest.slot !== 0 && manifest.slot !== 1) ||
    !Number.isInteger(manifest.parts) || (manifest.parts as number) < 1 ||
    (manifest.parts as number) > 2000) return [];
  const combined: string[] = [];
  for (let i = 0; i < (manifest.parts as number); i++) {
    const value = getSetting(`${key}:${manifest.slot}:${i}`);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const chunk = value as Record<string, unknown>;
    if (chunk.version !== manifest.version || !Array.isArray(chunk.ids) ||
      chunk.ids.length === 0 || chunk.ids.length > IDS_PER_CHUNK) return [];
    const ids = sanitizeDiaryManualOrder(chunk.ids);
    if (ids.length !== chunk.ids.length) return [];
    combined.push(...ids);
  }
  return sanitizeDiaryManualOrder(combined);
}
export async function saveDiaryManualOrder(
  date: string, ids: readonly string[], getSetting: (key: string) => unknown,
  setSetting: (key: string, value: unknown) => Promise<void>,
): Promise<void> {
  const key = diaryManualOrderKey(date), safeIds = sanitizeDiaryManualOrder(ids);
  if (safeIds.length !== ids.length) throw new Error('Invalid diary entry order');
  if (JSON.stringify(safeIds).length <= 8500) { await setSetting(key, safeIds); return; }
  const parts = Math.ceil(safeIds.length / IDS_PER_CHUNK);
  if (parts > 2000) throw new Error('Too many diary entries to reorder together');
  const current = getSetting(key);
  const oldSlot = current && typeof current === 'object' && !Array.isArray(current)
    ? (current as Record<string, unknown>).slot : undefined;
  const slot = oldSlot === 0 ? 1 : 0;
  const version = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10).padEnd(8, '0')}`;
  for (let i = 0; i < parts; i++) {
    await setSetting(`${key}:${slot}:${i}`, {
      version, ids: safeIds.slice(i * IDS_PER_CHUNK, (i + 1) * IDS_PER_CHUNK),
    });
  }
  // Double-buffer slots: a failed write cannot overwrite the active manual order.
  // The previous manifest remains readable until the new revision is committed.
  await setSetting(key, { version, slot, parts });
}
export function orderDiaryDayEntries<T extends Pick<DiaryOrderEntry, 'id' | 'createdAt'>>(
  entries: readonly T[], mode: DiaryEntryOrderMode, manualIds: readonly string[] = [],
): T[] {
  const oldest = [...entries].sort((a, b) =>
    (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
  if (mode === 'newest') return oldest.reverse();
  if (mode !== 'manual' || !manualIds.length) return oldest;
  const positions = new Map(manualIds.map((id, index) => [id, index]));
  return oldest.sort((a, b) => {
    const left = positions.get(a.id), right = positions.get(b.id);
    if (left !== undefined && right !== undefined) return left - right;
    return left !== undefined ? -1 : right !== undefined ? 1 : 0;
  });
}
export function moveDiaryEntry(ids: readonly string[], sourceId: string, targetId: string): string[] {
  const from = ids.indexOf(sourceId), to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return [...ids];
  const next = [...ids]; next.splice(from, 1); next.splice(to, 0, sourceId);
  return next;
}
export function resolveDiaryMonthEmoji<T extends Pick<DiaryOrderEntry, 'id' | 'emoji' | 'content'>>(
  entries: readonly T[], selectedEntryId: unknown,
): string {
  const selected = typeof selectedEntryId === 'string' && selectedEntryId !== AUTO_DIARY_MONTH_EMOJI
    ? entries.find(entry => entry.id === selectedEntryId) : undefined;
  return (selected ? diaryMarker(selected) : '') || entries.map(diaryMarker).find(Boolean) || '';
}
export interface DiaryMonthMarker { count: number; emoji: string }
export function groupDiaryMonthMarkers(
  entries: readonly DiaryOrderEntry[], getSetting?: (key: string) => unknown,
): Map<string, DiaryMonthMarker> {
  const days = new Map<string, DiaryOrderEntry[]>();
  for (const entry of entries) {
    if (entry.isDeleted) continue;
    const day = days.get(entry.date);
    if (day) day.push(entry); else days.set(entry.date, [entry]);
  }
  const result = new Map<string, DiaryMonthMarker>();
  for (const [date, day] of days) {
    const mode = resolveDiaryEntryOrderMode(getSetting?.(diaryEntryOrderModeKey(date)));
    const manualIds = getSetting ? readDiaryManualOrder(date, getSetting) : [];
    const ordered = orderDiaryDayEntries(day, mode, manualIds);
    result.set(date, {
      count: ordered.length,
      emoji: resolveDiaryMonthEmoji(ordered, getSetting?.(diaryMonthEmojiKey(date))),
    });
  }
  return result;
}
