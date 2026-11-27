/**
 * Floppy /api/v1/history/?flat=1 contract.
 *
 * This module deliberately handles public DTO fields only. Floppy credentials,
 * origin selection and all provider fetches must remain in a trusted broker.
 * Imported media never becomes a Mosaic Task or Diary row.
 */
export type FloppyKind = 'movie' | 'episode';

export interface FloppyActivity {
  id: string;
  kind: FloppyKind;
  date: string;
  watchedAt: string | null;
  title: string;
  seriesTitle: string | null;
  episodeCode: string | null;
  rating: number | null;
  source: string;
  mediaId: string;
  /**
   * Floppy's flat history contains tracker-level movie rows. A play_count > 1
   * is NOT a list of individually dated rewatches; use the per-media play
   * history endpoint before presenting each rewatch as its own event.
   */
  needsPlayExpansion: boolean;
  playCount: number;
}

export interface FloppyActivityPage {
  entries: FloppyActivity[];
  total: number;
  nextOffset: number | null;
  incompleteRewatches: boolean;
}

type PlainObject = Record<string, unknown>;

function asObject(value: unknown): PlainObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as PlainObject : null;
}

function safeText(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

const DAY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
export function isFloppyDay(value: string): boolean {
  if (!DAY_PATTERN.test(value)) return false;
  const parts = value.split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0]
    && date.getUTCMonth() + 1 === parts[1]
    && date.getUTCDate() === parts[2];
}

function safeWatchedAt(value: unknown): { date: string; timestamp: string | null } | null {
  if (typeof value !== 'string' || value.length > 80) return null;
  const date = value.slice(0, 10);
  if (!isFloppyDay(date)) return null;
  // Date-only values carry a day, not an invented midnight timestamp.
  if (value === date) return { date, timestamp: null };
  // Upstream played_at_local is timezone-aware. Malformed/offset-free times
  // must not be displayed as provider-local viewing instants.
  if (!/^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)
    || !Number.isFinite(Date.parse(value))) return null;
  return { date, timestamp: value };
}

function safeRating(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10)
    return null;
  return value;
}

function safeInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    return null;
  return value;
}

function parseEntry(raw: unknown, selectedDay: string): FloppyActivity | null {
  const row = asObject(raw);
  if (!row || (row.media_type !== 'movie' && row.media_type !== 'episode')) return null;
  const kind = row.media_type;
  const item = asObject(row.item);
  // Floppy's played_at_local is the provider's calendar-local date. An
  // end_date serialized in UTC can differ at midnight: never regroup by it.
  const watch = safeWatchedAt(row.played_at_local);
  if (!watch || watch.date !== selectedDay) return null;

  const instanceId = typeof row.instance_id === 'number' && Number.isSafeInteger(row.instance_id)
    ? String(row.instance_id) : safeText(row.instance_id, 36);
  if (!instanceId || !/^[a-zA-Z0-9_-]{1,36}$/.test(instanceId)) return null;
  const id = `floppy:${kind}:${instanceId}`;
  const source = safeText(item?.source, 60);
  const mediaId = typeof item?.media_id === 'number'
    ? String(item.media_id) : safeText(item?.media_id, 120);
  const title = safeText(row.display_title, 240)
    || safeText(row.title, 240) || safeText(item?.title, 240);
  if (!title) return null;

  const show = asObject(row.show);
  const seriesTitle = kind === 'episode'
    ? safeText(show?.title, 240) || null : null;
  const episodeCode = kind === 'episode'
    ? safeText(row.episode_code, 20) || null : null;
  const playCount = kind === 'movie' ? Math.min(safeInteger(row.play_count) ?? 1, 100000) : 1;

  return {
    id,
    kind,
    date: watch.date,
    watchedAt: watch.timestamp,
    title,
    seriesTitle,
    episodeCode,
    rating: safeRating(row.score),
    source,
    mediaId,
    needsPlayExpansion: kind === 'movie' && playCount > 1,
    playCount,
  };
}

/** Parse one bounded history page. Reject incorrect shapes rather than guessing. */
export function parseFloppyHistoryPage(payload: unknown, selectedDay: string): FloppyActivityPage {
  if (!isFloppyDay(selectedDay)) throw new Error('Invalid day');
  const root = asObject(payload);
  const pagination = asObject(root?.pagination);
  if (!root || !Array.isArray(root.results) || !pagination)
    throw new Error('Invalid Floppy history response');
  const total = safeInteger(pagination.total);
  const limit = safeInteger(pagination.limit);
  const offset = safeInteger(pagination.offset);
  // The trusted broker strips out unsupported/private upstream records. Its
  // scanned count reflects raw provider progress, not sanitized output length.
  // A direct provider response without scanned retains its original semantics.
  const scanned = pagination.scanned === undefined
    ? root.results.length : safeInteger(pagination.scanned);
  if (total === null || limit === null || offset === null || scanned === null
    || limit < 1 || limit > 200 || offset > 2000
    || root.results.length > limit || scanned < root.results.length || scanned > limit)
    throw new Error('Invalid Floppy pagination');

  const seen = new Set<string>();
  const entries = root.results.flatMap((record): FloppyActivity[] => {
    const entry = parseEntry(record, selectedDay);
    if (!entry || seen.has(entry.id)) return [];
    seen.add(entry.id);
    return [entry];
  });
  return {
    entries,
    total,
    nextOffset: scanned > 0 && offset + scanned < total && offset + scanned <= 2000
      ? offset + scanned : null,
    incompleteRewatches: entries.some(entry => entry.needsPlayExpansion),
  };
}

/** The broker should use this query; never fetch all history for a Day View. */
export function floppyDayQuery(day: string, offset = 0, limit = 100): string {
  if (!isFloppyDay(day)) throw new Error('Invalid day');
  if (!Number.isSafeInteger(offset) || offset < 0
    || !Number.isSafeInteger(limit) || limit < 1 || limit > 200)
    throw new Error('Invalid paging');
  return new URLSearchParams({
    start_date: day,
    end_date: day,
    types: 'movie,episode',
    flat: '1',
    limit: String(limit),
    offset: String(offset),
  }).toString();
}
