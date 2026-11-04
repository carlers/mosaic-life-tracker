import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildUnifiedHistory, DEVELOPMENT_HISTORY_URL, includeInstalledBuild, loadDevelopmentHistory,
  normalizeDevelopmentHistory, readCachedDevelopmentHistory, versionInChannel,
  type DevelopmentEvent, type InstalledBuildSnapshot,
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

const installedPreview: InstalledBuildSnapshot = {
  version: '0.82.0',
  channel: 'Preview',
  branch: 'feature/unified-history',
  commit: shaA,
  builtAt: '2026-11-04T01:00:00Z',
  commitMessage: 'feat(releases): v0.82.0 — Installed timeline entry\n\n- Show local build even before feed publication',
};

describe('installed build history entry', () => {
  it('shows an installed Preview in the timeline without inventing deployment events', () => {
    const versions = includeInstalledBuild(buildUnifiedHistory([], [], []), installedPreview);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      key: 'installed:preview:' + shaA,
      tag: 'v0.82.0',
      installedBuild: { sha: shaA, stage: 'preview', branch: 'feature/unified-history' },
    });
    expect(versions[0].title).toContain('Installed timeline entry');
    expect(versions[0].notes).toContain('Show local build');
    expect(versions[0].events).toEqual([]);
    expect(versions[0].productionRelease).toBeUndefined();
    expect(versionInChannel(versions[0], 'preview')).toBe(true);
    expect(versionInChannel(versions[0], 'production')).toBe(false);
    expect(versionInChannel(versions[0], 'dev')).toBe(false);
  });

  it('annotates the matching exact-SHA feed event once, keeping its published notes', () => {
    const originalEntries = buildUnifiedHistory([], [event()], []);
    const versions = includeInstalledBuild(originalEntries, installedPreview);
    expect(versions).toHaveLength(1);
    expect(versions[0].events).toHaveLength(1);
    expect(versions[0].notes).toBe('- Better version browsing');
    expect(versions[0].installedBuild?.sha).toBe(shaA);
    expect(originalEntries[0].installedBuild).toBeUndefined();
  });

  it('never collapses an unrelated Preview with the same version tag', () => {
    const versions = includeInstalledBuild(
      buildUnifiedHistory([], [event()], []),
      { ...installedPreview, commit: shaB, branch: 'feature/different' },
    );
    expect(versions).toHaveLength(2);
    expect(versions.filter(entry => entry.installedBuild)).toHaveLength(1);
    expect(versions.find(entry => entry.events.length > 0)?.installedBuild).toBeUndefined();
    expect(versions.find(entry => entry.installedBuild)?.events).toEqual([]);
  });

  it('keeps Dev and Production channel membership accurate', () => {
    const dev = includeInstalledBuild([], {
      ...installedPreview, channel: 'Preview', branch: 'dev', commit: shaB,
    });
    expect(dev[0].installedBuild?.stage).toBe('dev');
    expect(versionInChannel(dev[0], 'dev')).toBe(true);
    expect(versionInChannel(dev[0], 'preview')).toBe(false);

    const release: PublicRelease = {
      tag: 'v0.82.0', date: '2026-11-04T00:00:00Z',
      summary: 'Official release', notes: '- Official notes',
      milestones: [], url: 'https://github.com/carlers/mosaic-life-tracker/releases/tag/v0.82.0',
    };
    const production = includeInstalledBuild(buildUnifiedHistory([release], [], []), {
      ...installedPreview, channel: 'Production', branch: 'main', commit: shaC,
    });
    expect(production).toHaveLength(1);
    expect(production[0].installedBuild?.stage).toBe('production');
    expect(production[0].notes).toBe('- Official notes');
    expect(versionInChannel(production[0], 'production')).toBe(true);
  });

  it('does not create false history for a local, unknown, or invalid embedded build', () => {
    const versions = buildUnifiedHistory([], [], []);
    for (const invalid of [
      { ...installedPreview, channel: 'Local' as const },
      { ...installedPreview, branch: 'chatgpt/not-delivered' },
      { ...installedPreview, version: '0.82.0-rc1' },
      { ...installedPreview, commit: 'short' },
      { ...installedPreview, commit: null },
      { ...installedPreview, branch: null },
    ]) {
      expect(includeInstalledBuild(versions, invalid)).toBe(versions);
    }
  });
});
