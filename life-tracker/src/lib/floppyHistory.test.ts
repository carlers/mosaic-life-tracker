import { describe, expect, it } from 'vitest';
import { floppyDayQuery, isFloppyDay, parseFloppyHistoryPage } from './floppyHistory';

const day = '2026-11-23';
const movie = {
  media_type: 'movie',
  item: { source: 'tmdb', media_id: '157336', title: 'Interstellar' },
  display_title: 'Interstellar',
  played_at_local: '2026-11-23T19:45:00+08:00',
  end_date: '2026-11-23T11:45:00Z',
  instance_id: 12,
  play_count: 1,
  score: 9,
};
const episode = {
  media_type: 'episode',
  item: { source: 'tmdb', media_id: '8', title: 'Pilot', season_number: 1, episode_number: 1 },
  show: { title: 'Example TV Show' },
  display_title: 'Pilot',
  episode_code: 'S01E01',
  played_at_local: '2026-11-23T23:55:00+08:00',
  instance_id: 13,
};
function page(results: unknown[], total = results.length, offset = 0, limit = 100) {
  return { results, pagination: { total, offset, limit, next: null, previous: null } };
}
describe('Floppy history contract', () => {
  it('builds a bounded exact-date query without requesting other media', () => {
    expect(floppyDayQuery(day)).toContain('types=movie%2Cepisode');
    expect(floppyDayQuery(day)).toContain('flat=1');
    expect(floppyDayQuery(day)).toContain('start_date=2026-11-23');
    expect(() => floppyDayQuery('2026-02-30')).toThrow('Invalid day');
    expect(() => floppyDayQuery(day, -1)).toThrow('Invalid paging');
    expect(isFloppyDay('2024-02-29')).toBe(true);
    expect(isFloppyDay('2025-02-29')).toBe(false);
  });
  it('normalizes movie and episode with separate stable keys', () => {
    const parsed = parseFloppyHistoryPage(page([movie, episode]), day);
    expect(parsed.entries).toEqual([
      expect.objectContaining({ id: 'floppy:movie:12', kind: 'movie', rating: 9, needsPlayExpansion: false }),
      expect.objectContaining({ id: 'floppy:episode:13', kind: 'episode', seriesTitle: 'Example TV Show', episodeCode: 'S01E01' }),
    ]);
  });
  it('does not shift a provider-local watch at the midnight boundary', () => {
    const entry = { ...movie, played_at_local: '2026-11-23T00:15:00+08:00', end_date: '2026-11-22T16:15:00Z' };
    expect(parseFloppyHistoryPage(page([entry]), day).entries).toHaveLength(1);
    expect(parseFloppyHistoryPage(page([entry]), '2026-11-22').entries).toHaveLength(0);
  });
  it('does not invent individual viewing dates from a grouped rewatch tracker', () => {
    const result = parseFloppyHistoryPage(page([{ ...movie, play_count: 4 }]), day);
    expect(result.incompleteRewatches).toBe(true);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].playCount).toBe(4);
    expect(result.entries[0].needsPlayExpansion).toBe(true);
  });
  it('keeps two distinct episode instances; deduplicates the same entry', () => {
    const two = { ...episode, instance_id: 14 };
    const result = parseFloppyHistoryPage(page([episode, episode, two]), day);
    expect(result.entries.map(e => e.id)).toEqual(['floppy:episode:13', 'floppy:episode:14']);
  });
  it('rejects malformed rows, wrong day, unsupported media, invalid pagination', () => {
    expect(parseFloppyHistoryPage(page([{ ...movie, media_type: 'book' }, { ...episode, played_at_local: '2026-11-22T12:00:00Z' }]), day).entries).toEqual([]);
    expect(() => parseFloppyHistoryPage({}, day)).toThrow('Invalid Floppy history response');
    expect(() => parseFloppyHistoryPage(page([movie], 1, 0, 0), day)).toThrow('Invalid Floppy pagination');
    expect(() => parseFloppyHistoryPage(page([movie, movie], 2, 0, 1), day)).toThrow('Invalid Floppy pagination');
  });
  it('paginates without guessing that the first page includes the whole day', () => {
    const result = parseFloppyHistoryPage(page([movie], 2, 0, 1), day);
    expect(result.nextOffset).toBe(1);
    expect(parseFloppyHistoryPage(page([episode], 2, 1, 1), day).nextOffset).toBeNull();
  });
  it('advances by upstream scanned rows rather than sanitized result length', () => {
    const filtered = { ...page([movie], 4, 0, 3), pagination: { total: 4, offset: 0, limit: 3, scanned: 3 } };
    const result = parseFloppyHistoryPage(filtered, day);
    expect(result.entries).toHaveLength(1);
    expect(result.nextOffset).toBe(3);
    const unsupportedOnly = { ...page([], 4, 0, 3), pagination: { total: 4, offset: 0, limit: 3, scanned: 3 } };
    expect(parseFloppyHistoryPage(unsupportedOnly, day).nextOffset).toBe(3);
  });
  it('rejects forged pagination progress and stops when no upstream progress is possible', () => {
    expect(() => parseFloppyHistoryPage({
      ...page([movie], 4, 0, 3),
      pagination: { total: 4, offset: 0, limit: 3, scanned: 0 },
    }, day)).toThrow('Invalid Floppy pagination');
    expect(() => parseFloppyHistoryPage({
      ...page([movie], 4, 0, 3),
      pagination: { total: 4, offset: 0, limit: 3, scanned: 4 },
    }, day)).toThrow('Invalid Floppy pagination');
    expect(parseFloppyHistoryPage(page([], 4, 0, 3), day).nextOffset).toBeNull();
  });
});
