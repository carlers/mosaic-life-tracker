import { describe, expect, it } from 'vitest';
import {
  appendVerifiedHistory, chooseLineage, parseHistoryManifest,
  appendNoteAnnotation, parseNoteAnnotationManifest, releaseNotesFromPullRequest,
  releaseNotesFromCommit, shouldRecordDevHistoryEvent, validateHistoryEvent, validateNoteAnnotation,
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

  it('seeds the latest verified Dev version once after an empty-feed recovery', () => {
    const dev = { ...preview, id: 'dev:' + b, stage: 'dev', branch: 'dev',
      sha: b, lineageId: b, tag: 'v0.97.3',
      url: 'https://github.com/carlers/mosaic-life-tracker/commit/' + b };
    expect(shouldRecordDevHistoryEvent('v0.97.3', 'v0.97.3', [])).toBe(true);
    expect(shouldRecordDevHistoryEvent('v0.97.3', 'v0.97.3', [dev])).toBe(false);
    expect(shouldRecordDevHistoryEvent('v0.97.3', 'v0.97.2', [dev])).toBe(true);
    expect(shouldRecordDevHistoryEvent('v0.97.3', 'v0.97.3', [preview])).toBe(true);
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


describe('release-note extraction and immutable historical enrichment', () => {
  it('extracts descriptive prose when release merge commits lack bullets', () => {
    const notes = releaseNotesFromCommit(
      'fix(auth): v0.109.1 recovery code compatibility\n\n' +
      'Correct the Oracle recovery-code case mismatch and add browser verification.\n\n' +
      'Accepted Preview 270ef72417a5f1fcf5d4a9d9d2392ff36bf1e695; full Quality Gate PASS.');
    expect(notes.notes).toContain('Correct the Oracle recovery-code case mismatch');
    expect(notes.notes).not.toContain('Accepted Preview');
  });
  it('prefers explicit user-facing notes and filters key material without dropping privacy UX', () => {
    const notes = releaseNotesFromCommit(
      'feat(auth): secure accounts\n\n## User-facing release notes\n' +
      '* Make password recovery easier to use\n' +
      '- token: SHOULD_NOT_LEAK\n' +
      '- Show clear retry instructions\n## Verification\n- Some CI status');
    expect(notes.notes).toContain('Make password recovery easier');
    expect(notes.notes).toContain('Show clear retry instructions');
    expect(notes.notes).not.toContain('SHOULD_NOT_LEAK');
    expect(notes.notes).not.toContain('Some CI status');
    expect(releaseNotesFromPullRequest('## User-facing release notes\n- Show optional notes\n## CI')).toBe(
      '- Show optional notes');
    expect(releaseNotesFromPullRequest('## Test plan\n- PASS')).toBe('');
  });
  it('retains honest empty notes and rejects conflicting or mismatched annotations', () => {
    expect(releaseNotesFromCommit('fix: notes absent').notes).toBe('');
    const note = { id: 'preview:' + a, notes: '- Add verified history notes',
      source: 'https://github.com/carlers/mosaic-life-tracker/commit/' + a };
    const empty = { schema: 1, annotations: [] };
    const first = appendNoteAnnotation(empty, note);
    expect(first.changed).toBe(true);
    expect(appendNoteAnnotation(first.value, note).changed).toBe(false);
    expect(() => appendNoteAnnotation(first.value, { ...note, notes: 'Modified' })).toThrow();
    expect(() => parseNoteAnnotationManifest({ schema: 1, annotations: [note, note] })).toThrow();
    expect(() => validateNoteAnnotation({ ...note, source: 'https://example.com' })).toThrow();
    expect(() => validateNoteAnnotation({ ...note, id: 'dev:' + b })).toThrow();
    expect(() => validateNoteAnnotation({ ...note, notes: '- password: SHOULD_NOT_LEAK' })).toThrow();
  });
});
