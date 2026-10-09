import { describe, expect, it } from 'vitest';
import { readRouterHistoryIndex, resolveRouteTransition as motion } from '../../src/lib/routeTransitions';

describe('shared route transition policy', () => {
  it('uses tab order regardless of the control that initiated navigation', () => {
    expect(motion('/home', '/explore', 'PUSH', 1)).toBe('forward');
    expect(motion('/account', '/home', 'PUSH', 1)).toBe('backward');
    expect(motion('/notifications', '/messages', 'PUSH', 1)).toBe('forward');
  });

  it('navigates into details and out of parents spatially', () => {
    expect(motion('/messages', '/messages/alice', 'PUSH', 1)).toBe('forward');
    expect(motion('/messages/alice', '/messages', 'REPLACE', null, true)).toBe('backward');
    expect(motion('/settings', '/settings/preferences', 'PUSH', 1)).toBe('forward');
    expect(motion('/profile', '/settings', 'POP', null)).toBe('backward');
  });

  it('distinguishes native browser Forward from Back even though both are POP', () => {
    expect(motion('/messages', '/home', 'POP', -1)).toBe('backward');
    expect(motion('/home', '/messages', 'POP', 1)).toBe('forward');
    expect(motion('/messages/alice', '/messages', 'POP', 1)).toBe('forward');
    expect(motion('/messages', '/messages/alice', 'POP', -1)).toBe('backward');
  });

  it('does not animate initial, same-page, or unsupported auth/redirect transitions', () => {
    expect(motion(null, '/home', 'POP', null)).toBe('none');
    expect(motion('/home', '/home', 'PUSH', 1)).toBe('none');
    expect(motion('/login', '/home', 'REPLACE', null)).toBe('none');
    expect(motion('/home', '/reset-password', 'PUSH', 1)).toBe('none');
  });

  it('parses history entries only when the router supplied a valid index', () => {
    expect(readRouterHistoryIndex({ idx: 0 })).toBe(0);
    expect(readRouterHistoryIndex({ idx: 3 })).toBe(3);
    for (const value of [null, undefined, { idx: -1 }, { idx: '1' }, { idx: 2.4 }, {}]) {
      expect(readRouterHistoryIndex(value)).toBeNull();
    }
  });
});
