import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadReleaseHistory, normalizeReleases, RELEASES_URL } from '../../src/lib/releaseHistory';

const entry = (tag: string, date: string, other: Record<string, unknown> = {}) => ({
  tag_name: tag, name: tag + ' changes', body: '- Feature update',
  published_at: date, draft: false, prerelease: false, ...other,
});
beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

describe('public production release history', () => {
  it('accepts published stable releases, sorts dates and rejects invalid/preview entries', () => {
    const records = normalizeReleases([
      entry('v0.2.0', '2026-05-01T00:00:00Z'),
      entry('v0.3.0', '2026-06-01T00:00:00Z', { prerelease: true }),
      entry('v0.1.0', '2026-01-01T00:00:00Z'),
      entry('v0.4.0', '2026-07-01T00:00:00Z', { draft: true }),
      entry('v0.2.0', '2026-05-01T00:00:00Z'),
      entry('evil', '2026-02-01T00:00:00Z'),
      entry('v0.5.0', 'not-a-date'),
    ]);
    expect(records.map(x => x.tag)).toEqual(['v0.2.0', 'v0.1.0']);
    expect(records[0].url).toBe('https://github.com/carlers/mosaic-life-tracker/releases/tag/v0.2.0');
    expect(() => normalizeReleases({})).toThrow('Invalid releases response');
  });

  it('fetches once, caches safely and preserves history on later network failure', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({
      ok: true, json: async () => [entry('v0.6.2', '2026-10-08T00:00:00Z')],
    }).mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetcher);
    const first = await loadReleaseHistory();
    expect(first.source).toBe('live');
    expect(first.releases).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledWith(RELEASES_URL, expect.any(Object));
    expect((await loadReleaseHistory()).source).toBe('cached');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const offline = await loadReleaseHistory(true);
    expect(offline.source).toBe('cached');
    expect(offline.releases[0].tag).toBe('v0.6.2');
  });

  it('distinguishes the published-empty state from unavailable first-use history', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true, json: async () => [],
    }).mockResolvedValueOnce({ ok: false, status: 403 }));
    const empty = await loadReleaseHistory();
    expect(empty).toMatchObject({ source: 'live', releases: [] });
    localStorage.clear();
    const unavailable = await loadReleaseHistory();
    expect(unavailable).toMatchObject({ source: 'unavailable', releases: [] });
  });

  it('ignores corrupted cache and never trusts arbitrary release URLs', async () => {
    localStorage.setItem('mosaic:public-releases:v1', 'not-json');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => [entry('v1.0.0', '2026-09-01T00:00:00Z', { html_url: 'javascript:alert(1)' })],
    }));
    expect((await loadReleaseHistory()).releases[0].url).toContain('/releases/tag/v1.0.0');
  });
});
