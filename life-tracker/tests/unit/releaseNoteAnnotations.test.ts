import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enrichDevelopmentEvents, loadReleaseNoteAnnotations, normalizeReleaseNoteAnnotations,
  readCachedReleaseNoteAnnotations, RELEASE_NOTE_ANNOTATIONS_URL,
} from '../../src/lib/releaseNoteAnnotations';
import type { DevelopmentEvent } from '../../src/lib/developmentHistory';

const a = 'a'.repeat(40), b = 'b'.repeat(40);
const source = 'https://github.com/carlers/mosaic-life-tracker/commit/';
const original: DevelopmentEvent = {
  id: 'preview:' + a, tag: 'v0.82.0', stage: 'preview', sha: a, lineageId: a,
  branch: 'feature/accepted', recordedAt: '2026-11-04T00:00:00Z',
  title: 'Accepted Preview', notes: '', url: source + a,
};
const annotation = { id: 'preview:' + a, source: source + a,
  notes: '- Show verified release descriptions' };
beforeEach(() => {
  vi.unstubAllGlobals();
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
  });
});
describe('verified release-note annotations', () => {
  it('validates exact commit provenance and bounded, unique Preview/Dev annotations', () => {
    expect(normalizeReleaseNoteAnnotations({ schema: 1, annotations: [annotation] }))
      .toEqual([annotation]);
    for (const bad of [
      { ...annotation, id: 'production:' + a },
      { ...annotation, id: 'preview:' + b },
      { ...annotation, notes: '' },
      { ...annotation, notes: 'x'.repeat(2401) },
      { ...annotation, source: 'https://evil.example/commit/' + a },
    ]) expect(() => normalizeReleaseNoteAnnotations({ schema: 1, annotations: [bad] })).toThrow();
    expect(() => normalizeReleaseNoteAnnotations({ schema: 1,
      annotations: [annotation, annotation] })).toThrow();
    expect(() => normalizeReleaseNoteAnnotations({ schema: 2, annotations: [] })).toThrow();
    expect(() => normalizeReleaseNoteAnnotations({ schema: 1,
      annotations: Array(1201).fill(annotation) })).toThrow();
  });

  it('only enriches matching verified events with missing notes, preserving original records', () => {
    const filled = { ...original, id: 'dev:' + b, stage: 'dev' as const,
      sha: b, branch: 'dev', url: source + b, notes: '- Original official developer notes' };
    const result = enrichDevelopmentEvents([original, filled], [
      annotation, { id: 'dev:' + b, source: source + b, notes: '- Cannot replace' },
      { id: 'preview:' + b, source: source + b, notes: '- Unverified' },
    ]);
    expect(result[0].notes).toBe(annotation.notes);
    expect(result[1].notes).toBe(filled.notes);
    expect(original.notes).toBe('');
    expect(enrichDevelopmentEvents([], [annotation])).toEqual([]);
  });

  it('caches verified annotations independently and retains them when offline or malformed', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        schema: 1, annotations: [annotation],
      }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        schema: 1, annotations: [{ ...annotation, source: 'https://example.com/' }],
      }) });
    vi.stubGlobal('fetch', fetcher);
    expect((await loadReleaseNoteAnnotations()).source).toBe('live');
    expect(fetcher).toHaveBeenCalledWith(RELEASE_NOTE_ANNOTATIONS_URL, expect.any(Object));
    expect((await loadReleaseNoteAnnotations()).source).toBe('cached');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await loadReleaseNoteAnnotations(true)).source).toBe('cached');
    expect(readCachedReleaseNoteAnnotations()?.annotations).toEqual([annotation]);
  });

  it('does not invent notes before a trusted publisher creates the feed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    expect(await loadReleaseNoteAnnotations()).toMatchObject({
      annotations: [], source: 'unavailable',
    });
  });
});
