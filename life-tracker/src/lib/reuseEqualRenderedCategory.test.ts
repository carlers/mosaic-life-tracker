import React from 'react';
import { describe, expect, it } from 'vitest';
import { reuseEqualRenderedCategory } from './reuseEqualRenderedCategory';

describe('safe category subtree reuse', () => {
  it('reuses only identical component type, key and every property', () => {
    const add = () => undefined;
    const first = React.createElement('div', { id: 'category', onClick: add, children: 'Work' });
    const identical = React.createElement('div', { id: 'category', onClick: add, children: 'Work' });
    expect(reuseEqualRenderedCategory(first, identical)).toBe(first);
    const changed = React.createElement('div', { id: 'category', onClick: add, children: 'Home' });
    expect(reuseEqualRenderedCategory(first, changed)).toBe(changed);
    const newHandler = React.createElement('div', { id: 'category', onClick: () => undefined, children: 'Work' });
    expect(reuseEqualRenderedCategory(first, newHandler)).toBe(newHandler);
    const differentType = React.createElement('section', { id: 'category', onClick: add, children: 'Work' });
    expect(reuseEqualRenderedCategory(first, differentType)).toBe(differentType);
    const differentKey = React.createElement('div', { key: 'changed', id: 'category', onClick: add, children: 'Work' });
    expect(reuseEqualRenderedCategory(first, differentKey)).toBe(differentKey);
  });

  it('does not treat missing/undefined extra props or ordinary text as equal elements', () => {
    const previous = React.createElement('div', { id: 'one' });
    const next = React.createElement('div', { id: 'one', title: undefined });
    expect(reuseEqualRenderedCategory(previous, next)).toBe(next);
    expect(reuseEqualRenderedCategory(previous, 'Work')).toBe('Work');
  });
});
