import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildUnifiedHistory, DEVELOPMENT_HISTORY_URL, loadDevelopmentHistory,
  normalizeDevelopmentHistory, readCachedDevelopmentHistory, versionInChannel,
  type DevelopmentEvent,
} from '../../src/lib/developmentHistory';
import type { PublicRelease } from '../../src/lib/releaseHistory';

const shaA = 'a'.repeat(40);
const shaB = 'b'.repeat(40);
const shaC = 'c'.repeat(40);
const shaD = 'd'.repeat(40);
function event(overrides: Partial<DevelopmentEvent> = {}): DevelopmentEvent {
  return {
    id: 'preview:' + shaA, tag: 'v0.82.0', stage: 'preview',
    sha: shaA, lineageId: shaA, branch: 'feature/unified-history',
    recordedAt: '2026-11-04T00:00:00Z', title: 'Release history preview',
    notes: '- Better version browsing',
    url: 'https://github.com/carlers/mosaic-life-tracker/commit/' + shaA,
    ...overrides,
  };
}
beforeEach(() => {
  vi.unstubAllGlobals();
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  });
});

describe('verified development history', () => {
  it('validates feed identity, source, bounded entries and version syntax', () => {
    expect(normalizeDevelopmentHistory({ schema: 1, events: [event()] })).toHaveLength(1);
    expect(() => normalizeDevelopmentHistory({ schema: 2, events: [] })).toThrow();
    expect(() => normalizeDevelopmentHistory({ schema: 1, events: [event({ tag: 'latest' })] })).toThrow();
    expect(() => normalizeDevelopmentHistory({ schema: 1, events: [event({ branch: 'main' })] })).toThrow();
    expect(() => normalizeDevelopmentHistory({ schema: 1, events: [event({ url: 'javascript:alert(1)' })] })).toThrow();
    expect(() => normalizeDevelopmentHistory({ schema: 1, events: [
      event(), event({ title: 'Spoofed duplicate' }),
    ] })).toThrow();
    expect(() => normalizeDevelopmentHistory({ schema: 1, events: Array(1201).fill(event()) })).toThrow();
  });

  it('keeps lineage across Preview → Dev → Production and distinguishes a collision', () => {
    const dev = event({
      id: 'dev:' + shaB, stage: 'dev', sha: shaB, branch: 'dev', lineageId: shaA,
      recordedAt: '2026-11-05T00:00:00Z', url: 'https://github.com/carlers/mosaic-life-tracker/commit/' + shaB,
    });
    const production = event({
      id: 'production:' + shaC, stage: 'production', sha: shaC, branch: 'main',
      lineageId: shaA, recordedAt: '2026-11-06T00:00:00Z',
      url: 'https://github.com/carlers/mosaic-life-tracker/commit/' + shaC,
    });
    const unrelated = event({
      id: 'preview:' + shaD, sha: shaD, lineageId: shaD,
      branch: 'feature/unrelated', url: 'https://github.com/carlers/mosaic-life-tracker/commit/' + shaD,
    });
    const official: PublicRelease = {
      tag: 'v0.82.0', date: '2026-11-06T00:00:00Z',
      summary: 'Unified history shipped', notes: '- Full release notes',
      milestones: [], url: 'https://github.com/carlers/mosaic-life-tracker/releases/tag/v0.82.0',
    };
    const entries = buildUnifiedHistory([official], [event(), dev, production, unrelated], []);
    expect(entries).toHaveLength(2);
    const shipped = entries.find(x => !!x.productionRelease)!;
    expect(shipped.events.map(x => x.stage)).toEqual(['preview', 'dev', 'production']);
    expect(shipped.notes).toBe('- Full release notes');
    expect(versionInChannel(shipped, 'production')).toBe(true);
    expect(versionInChannel(shipped, 'dev')).toBe(true);
    expect(versionInChannel(shipped, 'preview')).toBe(true);
    expect(entries.find(x => x.key !== shipped.key)?.events).toHaveLength(1);
  });

  it('preserves historical Preview versions without inventing deployments', () => {
    const entries = buildUnifiedHistory([], [], [
      { tag: 'v0.13.0', title: 'Old experiment', notes: 'Prototype', url: 'https://github.com/carlers/mosaic-life-tracker/pull/486' },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].historicalPreview).toBe(true);
    expect(entries[0].events).toHaveLength(0);
    expect(versionInChannel(entries[0], 'preview')).toBe(true);
    expect(versionInChannel(entries[0], 'production')).toBe(false);
  });

  it('reuses cached data when offline and rejects invalid responses without overwriting it', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ schema: 1, events: [event()] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ schema: 10, events: [] }) });
    vi.stubGlobal('fetch', fetcher);
    expect((await loadDevelopmentHistory()).source).toBe('live');
    expect(fetcher).toHaveBeenCalledWith(DEVELOPMENT_HISTORY_URL, expect.any(Object));
    expect((await loadDevelopmentHistory()).source).toBe('cached');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await loadDevelopmentHistory(true)).source).toBe('cached');
    expect(readCachedDevelopmentHistory()?.events).toHaveLength(1);
  });

  it('distinguishes first-time unavailable history from a real empty feed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ schema: 1, events: [] }) }));
    expect((await loadDevelopmentHistory()).source).toBe('unavailable');
    expect((await loadDevelopmentHistory()).source).toBe('live');
  });
});
