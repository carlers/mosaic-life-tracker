import { describe, expect, it } from 'vitest';
import { moveCategoryId, sameCategoryIds } from '../../src/lib/categoryReorder';

describe('account-wide category order', () => {
  it('moves exactly one category without losing any IDs', () => {
    const ids = ['work', 'health', 'personal'];
    expect(moveCategoryId(ids, 'health', -1)).toEqual(['health', 'work', 'personal']);
    expect(moveCategoryId(ids, 'health', 1)).toEqual(['work', 'personal', 'health']);
    expect(ids).toEqual(['work', 'health', 'personal']);
  });

  it('does nothing for missing categories and list edges', () => {
    const ids = ['work', 'health'];
    expect(moveCategoryId(ids, 'missing', 1)).toEqual(ids);
    expect(moveCategoryId(ids, 'work', -1)).toEqual(ids);
    expect(moveCategoryId(ids, 'health', 1)).toEqual(ids);
  });

  it('distinguishes matching category membership from matching order', () => {
    expect(sameCategoryIds(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameCategoryIds(['a', 'b'], ['b', 'a'], true)).toBe(false);
    expect(sameCategoryIds(['a', 'a'], ['a', 'b'])).toBe(false);
    expect(sameCategoryIds(['a'], ['a', 'b'])).toBe(false);
  });
});
