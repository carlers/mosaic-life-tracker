/**
 * Source-only contract for Floppy's per-media MoviePlay history.
 * Upstream pinned at 11901654d30fd1f7881f1a45c5d97aa09a9cd88e:
 * api.views.MediaConsumptionHistoryView -> HistorySerializer.
 * Not imported by a live browser caller. The upstream end_date carries
 * an instant, not necessarily the owner's Floppy-local calendar date.
 */
export interface FloppyMoviePlay {
  id: string;
  watchedAtUtc: string;
  score: number | null;
}
export interface FloppyMoviePlayPage {
  plays: FloppyMoviePlay[];
  nextOffset: number | null;
  total: number;
  /** Rewatch-to-calendar assignment requires an independently verified timezone. */
  timezoneUnresolved: true;
}
const OFFSET_MAX = 2000;
const DATETIME = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;

function record(x: unknown): Record<string, unknown> | null {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
    ? x as Record<string, unknown> : null;
}
function nonnegative(x: unknown): number | null {
  return typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 ? x : null;
}
function sanitizedInstant(x: unknown): string | null {
  if (typeof x !== 'string' || x.length > 48 || !DATETIME.test(x)) return null;
  const parsed = Date.parse(x);
  if (!Number.isFinite(parsed)) return null;
  const year = Number(x.slice(0, 4));
  if (year < 1970 || year > 9999) return null;
  return new Date(parsed).toISOString();
}
/** Only fetch per-play records via a future trusted owner-authenticated broker. */
export function parseFloppyMoviePlayPage(
  input: unknown,
  offset: number,
  limit = 100
): FloppyMoviePlayPage {
  if (nonnegative(offset) !== offset || offset > OFFSET_MAX
    || nonnegative(limit) !== limit || limit < 1 || limit > 200) {
    throw new Error('Invalid Floppy movie play request');
  }
  const root = record(input);
  const page = record(root?.pagination);
  const total = nonnegative(page?.total);
  if (!root || !Array.isArray(root.results) || !page
    || total === null || total > 1000000
    || nonnegative(page.offset) !== offset || nonnegative(page.limit) !== limit
    || root.results.length > limit
    || (root.results.length === 0 && offset < total)) {
    throw new Error('Invalid Floppy movie play response');
  }
  const used = new Set<string>();
  const plays: FloppyMoviePlay[] = [];
  for (const original of root.results) {
    const item = record(original);
    if (!item) continue;
    const id = nonnegative(item.consumption_id);
    const when = sanitizedInstant(item.end_date);
    if (!id || !when) continue; // Untimed/in-progress records are not watches.
    const key = 'floppy:movie-play:' + String(id);
    if (used.has(key)) continue;
    used.add(key);
    const score = typeof item.score === 'number' && Number.isFinite(item.score)
      && item.score >= 0 && item.score <= 10 ? item.score : null;
    // Never copy notes, external_id, source, account identifiers or metadata.
    plays.push({ id: key, watchedAtUtc: when, score });
  }
  const consumed = root.results.length;
  return {
    plays,
    nextOffset: consumed > 0 && offset + consumed < total && offset + consumed <= OFFSET_MAX
      ? offset + consumed : null,
    total,
    timezoneUnresolved: true,
  };
}
