import { describe, expect, it } from 'vitest';
import { parseFloppyMoviePlayPage } from './floppyMoviePlays';

function page(results: unknown[], total = results.length, offset = 0, limit = 100) {
  return { results, pagination: { total, offset, limit, next: null, previous: null } };
}
describe('Floppy pinned per-media MoviePlay contract', () => {
  it('converts a synthetic consumption into a UTC instant without inventing a local day', () => {
    // Pinned upstream HistorySerializer for MoviePlay: id, end_date, score,
    // source, notes, external_id. None of those private fields escape.
    const result = parseFloppyMoviePlayPage(page([
      { consumption_id: 123, end_date: '2026-11-22T16:15:00Z', score: 8.5,
        notes: 'PRIVATE_NOTES', external_id: 'PRIVATE_EXTERNAL', source: 'PRIVATE_SOURCE' },
    ]), 0);
    expect(result).toEqual({
      total: 1, nextOffset: null, timezoneUnresolved: true,
      plays: [{
        id: 'floppy:movie-play:123',
        watchedAtUtc: '2026-11-22T16:15:00.000Z',
        score: 8.5,
      }],
    });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(result).not.toHaveProperty('date');
  });
  it('rejects forged pagination while advancing by upstream rows, not dropped records', () => {
    const result = parseFloppyMoviePlayPage(page([
      { consumption_id: 1, end_date: null },
      { consumption_id: 2, end_date: '2026-11-23T19:00:00+08:00' },
    ], 3, 0, 2), 0, 2);
    expect(result.plays.map(x => x.id)).toEqual(['floppy:movie-play:2']);
    expect(result.nextOffset).toBe(2);
    expect(result.plays[0].watchedAtUtc).toBe('2026-11-23T11:00:00.000Z');
    expect(() => parseFloppyMoviePlayPage(page([], 1, 0, 2), 0, 2))
      .toThrow('Invalid Floppy movie play response');
    expect(() => parseFloppyMoviePlayPage(page([], 0, 0, 2), 1, 2))
      .toThrow('Invalid Floppy movie play response');
    expect(() => parseFloppyMoviePlayPage(page([], 0, 0, 2), 0, 201))
      .toThrow('Invalid Floppy movie play request');
  });
  it('deduplicates malformed and repeated play ids without exposing invalid timestamps', () => {
    const rows = [
      { consumption_id: 31, end_date: '2026-11-23T10:00:00Z', score: 9 },
      { consumption_id: 31, end_date: '2026-11-23T10:00:00Z', notes: 'PRIVATE' },
      { consumption_id: -1, end_date: '2026-11-23T10:00:00Z' },
      { consumption_id: 5, end_date: '2026-11-23T99:99:00Z' },
      { consumption_id: 4, end_date: 'not-a-date' },
    ];
    const result = parseFloppyMoviePlayPage(page(rows, 5, 0, 5), 0, 5);
    expect(result.plays).toEqual([{ id: 'floppy:movie-play:31',
      watchedAtUtc: '2026-11-23T10:00:00.000Z', score: 9 }]);
    expect(result.nextOffset).toBeNull();
  });
});
