import { describe, expect, it, beforeEach } from 'vitest';
import {
  __resetAccountWorkScopeForTests,
  captureAccountWorkGeneration,
  getAccountWorkScope,
  isAccountWorkCurrent,
  scopeAccountWork,
} from '../../src/lib/accountWorkScope';

describe('account work scope', () => {
  beforeEach(() => {
    __resetAccountWorkScopeForTests();
  });

  it('invalidates captured work when the authenticated owner changes', () => {
    const generationA = scopeAccountWork('user_A');
    expect(captureAccountWorkGeneration('user_A')).toBe(generationA);
    expect(isAccountWorkCurrent('user_A', generationA)).toBe(true);

    const generationB = scopeAccountWork('user_B');

    expect(generationB).toBeGreaterThan(generationA);
    expect(isAccountWorkCurrent('user_A', generationA)).toBe(false);
    expect(getAccountWorkScope()).toEqual({
      userId: 'user_B',
      generation: generationB,
    });
  });

  it('does not advance the generation when re-scoping the same owner', () => {
    const first = scopeAccountWork('user_A');
    const second = scopeAccountWork('user_A');

    expect(second).toBe(first);
  });
});
