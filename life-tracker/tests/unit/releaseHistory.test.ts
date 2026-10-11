import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadReleaseHistory, normalizeReleases, readCachedReleaseHistory, splitReleaseMilestones, RELEASES_URL } from '../../src/lib/releaseHistory';

const entry = (tag: string, date: string, other: Record<string, unknown> = {}) => ({
  tag_name: tag, name: tag + ' changes', body: '- Feature update',
  published_at: date, draft: false, prerelease: false, ...other,
});
beforeEach(() => {
  vi.unstubAllGlobals();
  const memory = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    clear: () => memory.clear(),
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
  });
});

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
    expect(readCachedReleaseHistory()?.releases[0].tag).toBe('v0.6.2');
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

  it('extracts ordered verified version sections without showing Markdown markers as notes', () => {
    const body = '- **Shipped update**\n\n<!-- mosaic:milestones:v1 -->\n## Version milestones\n' +
      '### v0.16.5 — Sticker improvements\n- **Static** stickers\n\n' +
      '### v0.15.0 — Shared tasks\n- Better collaboration\n\n' +
      '### v0.99.0 — Unshipped\n- Reject this\n' +
      '<!-- /mosaic:milestones:v1 -->';
    const item = normalizeReleases([entry('v0.16.6', '2026-10-11T00:00:00Z', { body })])[0];
    expect(item.milestones.map(x => x.tag)).toEqual(['v0.16.5', 'v0.15.0']);
    expect(item.milestones[0].notes).toContain('**Static**');
    expect(item.notes).toBe('- **Shipped update**');
    expect(splitReleaseMilestones('- Normal release', 'v0.16.6').milestones).toEqual([]);
  });

  it('keeps stale saved notes offline and only revalidates when expired', async () => {
    const oldTime = Date.now() - 60 * 60 * 1000;
    localStorage.setItem('mosaic:public-releases:v1', JSON.stringify({
      fetchedAt: oldTime, items: [entry('v0.6.2', '2026-10-08T00:00:00Z')],
    }));
    expect(readCachedReleaseHistory()?.source).toBe('cached');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const saved = await loadReleaseHistory();
    expect(saved).toMatchObject({ source: 'cached', fetchedAt: oldTime });
  });

  it('ignores corrupted cache and never trusts arbitrary release URLs', async () => {
    localStorage.setItem('mosaic:public-releases:v1', 'not-json');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => [entry('v1.0.0', '2026-09-01T00:00:00Z', { html_url: 'javascript:alert(1)' })],
    }));
    expect((await loadReleaseHistory()).releases[0].url).toContain('/releases/tag/v1.0.0');
  });
});
