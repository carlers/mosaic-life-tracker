import { describe, it, expect } from 'vitest';
import { makeSettingsRowId } from '../../src/hooks/useSettings';

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
