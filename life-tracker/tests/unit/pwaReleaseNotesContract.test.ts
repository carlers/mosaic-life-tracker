import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../../src/lib/appVersion';
import releases from '../../src/data/pwaUpdateNotes.json';
import { validatePwaReleaseNotes } from '../../scripts/lib/pwa-release-notes.mjs';

const clone = () => JSON.parse(JSON.stringify(releases));

describe('mandatory PWA release-note contract (#2459)', () => {
  it('the actual waiting-worker catalog describes the current app release', () => {
    const current = validatePwaReleaseNotes(APP_VERSION, releases);
    expect(current.version).toBe(APP_VERSION);
    expect(current.changes.length).toBeGreaterThan(0);
    expect(readFileSync(new URL('../../src/sw.js', import.meta.url), 'utf8'))
      .toContain("releases: releaseNotes");
  });

  it('fails when a new candidate has no specific current-version notes', () => {
    expect(() => validatePwaReleaseNotes('9.0.0', clone()))
      .toThrow(/Missing required PWA release notes/);
    expect(() => validatePwaReleaseNotes(APP_VERSION, clone().filter(
      (entry: { version: string }) => entry.version !== APP_VERSION)))
      .toThrow(/Missing required PWA release notes/);
  });

  it('rejects blank, generic or unfinished descriptions and duplicate versions', () => {
    const blank = clone();
    blank[0].changes = [];
    expect(() => validatePwaReleaseNotes(APP_VERSION, blank)).toThrow(/specific, bounded/);
    const generic = clone();
    generic[0].headline = 'Mosaic update ready';
    expect(() => validatePwaReleaseNotes(APP_VERSION, generic)).toThrow(/concrete change/);
    const todo = clone();
    todo[0].changes = ['TODO replace this with actual release details'];
    expect(() => validatePwaReleaseNotes(APP_VERSION, todo)).toThrow(/specific, bounded/);
    const duplicate = clone();
    duplicate.splice(1, 0, { ...duplicate[0] });
    expect(() => validatePwaReleaseNotes(APP_VERSION, duplicate)).toThrow(/Duplicate/);
  });

  it('rejects future, out-of-order, oversize and malformed release metadata', () => {
    const future = clone();
    future.unshift({ ...future[0], version: '9.0.0' });
    expect(() => validatePwaReleaseNotes(APP_VERSION, future)).toThrow(/future/);
    const wrongOrder = clone();
    [wrongOrder[1], wrongOrder[2]] = [wrongOrder[2], wrongOrder[1]];
    expect(() => validatePwaReleaseNotes(APP_VERSION, wrongOrder)).toThrow(/newest first/);
    const long = clone();
    long[0].changes = ['x'.repeat(181)];
    expect(() => validatePwaReleaseNotes(APP_VERSION, long)).toThrow(/specific, bounded/);
    expect(() => validatePwaReleaseNotes('not-a-version', clone())).toThrow(/Invalid application version/);
  });
});
