import { describe, expect, it, vi } from 'vitest';
import {
  readCachedReduceAnimations, cacheReduceAnimations,
  applyReducedMotionPreference, systemRequestsReducedMotion,
} from '../../src/lib/motionPreferences';

describe('accessible motion preference', () => {
  it('defaults off, scopes the fast-start cache by account, and handles denied storage', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(readCachedReduceAnimations('alice', storage)).toBe(false);
    cacheReduceAnimations('alice', true, storage);
    expect(readCachedReduceAnimations('alice', storage)).toBe(true);
    expect(readCachedReduceAnimations('bob', storage)).toBe(false);
    expect(readCachedReduceAnimations('', storage)).toBe(false);
    expect(readCachedReduceAnimations('alice', { getItem: () => { throw Error('denied'); } })).toBe(false);
    expect(() => cacheReduceAnimations('alice', true, { setItem: () => { throw Error('denied'); } })).not.toThrow();
  });

  it('enforces OS accessibility even when the in-app switch is off', () => {
    const media = { matchMedia: vi.fn(() => ({ matches: true })) };
    expect(systemRequestsReducedMotion(media as unknown as Window)).toBe(true);
    expect(systemRequestsReducedMotion(undefined)).toBeTypeOf('boolean');
    const root = { dataset: {} as DOMStringMap } as HTMLElement;
    applyReducedMotionPreference(true, root);
    expect(root.dataset.reduceMotion).toBe('true');
    applyReducedMotionPreference(false, root);
    expect(root.dataset.reduceMotion).toBe('false');
  });
});
