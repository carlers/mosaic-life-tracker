// Layer 1 — pure functions (settingsRowId)
import { describe, it, expect } from 'vitest';
import { makeSettingsRowId, makeDiaryRowId } from '../../src/lib/settingsRowId';

describe('makeSettingsRowId', () => {
  // Regression: §11 — short composite ids stay human-readable
  it('uses ${userId}_${key} when the total fits in <= 36 chars', () => {
    expect(makeSettingsRowId('u', 'k')).toBe('u_k');
    expect(makeSettingsRowId('user1', 'displayName')).toBe('user1_displayName');
  });

  it('hashes long keys into s_<hash> ids of length <= 36', () => {
    const id = makeSettingsRowId('u', 'x'.repeat(35));
    expect(id.startsWith('s_')).toBe(true);
    expect(id.length).toBeLessThanOrEqual(36);
  });

  it('is deterministic for the same inputs (long key path)', () => {
    const a = makeSettingsRowId('u', 'x'.repeat(35));
    const b = makeSettingsRowId('u', 'x'.repeat(35));
    expect(a).toBe(b);
  });

  it('produces different hashes for different long keys', () => {
    const a = makeSettingsRowId('u', 'x'.repeat(35));
    const b = makeSettingsRowId('u', 'y'.repeat(35));
    expect(a).not.toBe(b);
  });

  it('only emits [a-zA-Z0-9_] and never starts with an underscore', () => {
    const ids = [
      makeSettingsRowId('u', 'k'),
      makeSettingsRowId('user1', 'displayName'),
      makeSettingsRowId('u', 'x'.repeat(35)),
      makeSettingsRowId('user_0123456789abcdef', 'friend_carousel_prefs'),
    ];
    for (const id of ids) {
      expect(id).toMatch(/^[a-zA-Z0-9_]+$/);
      expect(id.startsWith('_')).toBe(false);
    }
  });

  // Known-vector: pins the exact output of the dual-djb2 hash for a fixed
  // input so any future change to hashString (or the <=36 short-circuit) is
  // caught. Value captured from the shipped implementation on 2026-09-16.
  it('produces the exact expected id for a pinned long-key input', () => {
    expect(makeSettingsRowId('u', 'x'.repeat(35))).toBe('s_kc18ch1gy1y7f');
  });
});

describe('makeDiaryRowId', () => {
  // Regression: §6 row-id cap (HB-7) — short uid stays literal, and the
  // date is sanitized to `yyyyMMdd` because Appwrite rowIds forbid `-`.
  it('uses ${uid}_${yyyyMMdd} when the total fits in <= 36 chars', () => {
    expect(makeDiaryRowId('u', '2026-09-17')).toBe('u_20260917');
    expect(makeDiaryRowId('user1234567890', '2026-09-17')).toBe(
      'user1234567890_20260917'
    );
  });

  // Regression: §6 row-id cap (HB-7) — long uid falls back to a hashed id
  it('hashes when the total exceeds 36 chars', () => {
    const longUid = 'u'.repeat(30);
    const id = makeDiaryRowId(longUid, '2026-09-17');
    expect(id.startsWith('d_')).toBe(true);
    expect(id.length).toBeLessThanOrEqual(36);
  });

  it('is deterministic for the same inputs', () => {
    const a = makeDiaryRowId('u'.repeat(30), '2026-09-17');
    const b = makeDiaryRowId('u'.repeat(30), '2026-09-17');
    expect(a).toBe(b);
  });

  // Regression: §0 item 3 — rowId must match [a-zA-Z0-9_]+ with no
  // leading underscore. The date contains hyphens, which must be stripped.
  it('only emits [a-zA-Z0-9_] and never starts with an underscore', () => {
    const ids = [
      makeDiaryRowId('u', '2026-09-17'),
      makeDiaryRowId('u'.repeat(30), '2026-09-17'),
    ];
    for (const id of ids) {
      expect(id).toMatch(/^[a-zA-Z0-9_]+$/);
      expect(id.startsWith('_')).toBe(false);
    }
  });
});
