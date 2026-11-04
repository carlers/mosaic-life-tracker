import { describe, expect, it } from 'vitest';
import {
  appendVerifiedHistory, chooseLineage, parseHistoryManifest,
  releaseNotesFromCommit, validateHistoryEvent,
} from '../../scripts/lib/development-history-publisher.mjs';

const a = 'a'.repeat(40);
const b = 'b'.repeat(40);
const c = 'c'.repeat(40);
const d = 'd'.repeat(40);
const preview = {
  id: 'preview:' + a, tag: 'v0.82.0', stage: 'preview',
  sha: a, lineageId: a, branch: 'feature/release-history',
  recordedAt: '2026-11-04T00:00:00Z', title: 'Release history',
  notes: '- Development versions',
  url: 'https://github.com/carlers/mosaic-life-tracker/commit/' + a,
};

describe('trusted development history publication', () => {
  it('pins version, branch, SHA, URL, note lengths and rejects spoofed events', () => {
    expect(validateHistoryEvent(preview)).toEqual(preview);
    expect(() => validateHistoryEvent({ ...preview, branch: 'main' })).toThrow();
    expect(() => validateHistoryEvent({ ...preview, tag: 'v0.82.0-rc1' })).toThrow();
    expect(() => validateHistoryEvent({ ...preview, url: 'https://evil.example/commit/' + a })).toThrow();
    expect(() => validateHistoryEvent({ ...preview, id: 'dev:' + a })).toThrow();
  });

  it('derives lineage only from the exact promoted second parent, never version alone', () => {
    const existing = [preview];
    expect(chooseLineage(existing, 'preview', c, [], 'v0.82.0')).toBe(c);
    expect(chooseLineage(existing, 'dev', b,
      [{ sha: d }, { sha: a }], 'v0.82.0')).toBe(a);
    expect(chooseLineage(existing, 'dev', b,
      [{ sha: d }, { sha: a }], 'v0.83.0')).toBe(b);
    expect(chooseLineage(existing, 'dev', b, [{ sha: a }], 'v0.82.0')).toBe(b);
    expect(chooseLineage([...existing, {
      ...preview, id: 'dev:' + b, stage: 'dev', sha: b, branch: 'dev',
    }], 'production', c, [{ sha: d }, { sha: b }], 'v0.82.0')).toBe(a);
  });

  it('maintains immutable append-only history without duplicate retries', () => {
    const empty = { schema: 1, events: [] };
    const first = appendVerifiedHistory(empty, preview);
    expect(first.changed).toBe(true);
    const retry = appendVerifiedHistory(first.value, { ...preview });
    expect(retry.changed).toBe(false);
    expect(retry.value.events).toHaveLength(1);
    expect(() => appendVerifiedHistory(first.value, { ...preview, title: 'Changed' })).toThrow();
    expect(() => parseHistoryManifest({
      schema: 1, events: [preview, preview],
    })).toThrow();
    expect(() => appendVerifiedHistory({
      schema: 1, events: Array(1200).fill(preview).map((entry, i) => ({
        ...entry, id: 'preview:' + String(i).padStart(40, '0'),
        sha: String(i).padStart(40, '0'),
        lineageId: String(i).padStart(40, '0'),
        url: 'https://github.com/carlers/mosaic-life-tracker/commit/' + String(i).padStart(40, '0'),
      })),
    }, preview)).toThrow();
  });

  it('extracts bounded public notes without shipping raw secret-looking bullets', () => {
    const notes = releaseNotesFromCommit(
      'feat: v0.82.0 — Unified history\n\n- Add Preview and Dev filters\n- Preserve history offline\n- password: SHOULD_NOT_LEAK',
    );
    expect(notes.title).toContain('Unified history');
    expect(notes.notes).toContain('Preview and Dev');
    expect(notes.notes).not.toContain('SHOULD_NOT_LEAK');
  });
});
