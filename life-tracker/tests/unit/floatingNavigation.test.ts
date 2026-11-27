import { describe, expect, it } from 'vitest';
import { resolveFloatingNavigation, dockGestureIntent, dockTravel, shouldSettleDock } from '../../src/lib/floatingNavigation';

describe('optional floating navigation', () => {
  it('preserves Classic for absent or invalid preferences', () => {
    for (const value of [undefined, null, false, 'true', 1, {}]) expect(resolveFloatingNavigation(value)).toBe(false);
    expect(resolveFloatingNavigation(true)).toBe(true);
  });
  it('only owns the intended vertical gesture', () => {
    expect(dockGestureIntent('hide', 2, 4)).toBe('pending');
    expect(dockGestureIntent('hide', 5, 30)).toBe('owned');
    expect(dockGestureIntent('hide', 5, -30)).toBe('rejected');
    expect(dockGestureIntent('hide', 30, 10)).toBe('rejected');
    expect(dockGestureIntent('restore', 5, -30)).toBe('owned');
    expect(dockTravel('restore', 100, 50)).toBe(50);
  });
  it('settles a long pull or deliberate flick, not a short or reversed pull', () => {
    expect(shouldSettleDock(54, 400)).toBe(true);
    expect(shouldSettleDock(30, 45)).toBe(true);
    expect(shouldSettleDock(30, 400)).toBe(false);
    expect(shouldSettleDock(10, 10)).toBe(false);
    expect(shouldSettleDock(-20, 50)).toBe(false);
  });
});
