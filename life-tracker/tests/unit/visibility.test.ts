import { describe, it, expect } from 'vitest';
import {
  resolveVisibility,
  isInheriting,
  labelForVisibility,
} from '../../src/lib/visibility';

describe('resolveVisibility', () => {
  it('lets the task value win over the category value', () => {
    expect(resolveVisibility('public', 'private')).toBe('public');
    expect(resolveVisibility('followers', 'public')).toBe('followers');
    expect(resolveVisibility('private', 'public')).toBe('private');
  });

  it('falls back to the category when the task is empty', () => {
    expect(resolveVisibility('', 'public')).toBe('public');
    expect(resolveVisibility(undefined, 'followers')).toBe('followers');
  });

  it("falls back to 'private' when both are empty/undefined", () => {
    expect(resolveVisibility('', '')).toBe('private');
    expect(resolveVisibility(undefined, undefined)).toBe('private');
    expect(resolveVisibility('', undefined)).toBe('private');
    expect(resolveVisibility(undefined, '')).toBe('private');
  });

  it('falls through to the category when the task value is invalid', () => {
    expect(resolveVisibility('bogus', 'public')).toBe('public');
    expect(resolveVisibility('bogus', 'private')).toBe('private');
    expect(resolveVisibility('bogus', undefined)).toBe('private');
  });
});

describe('isInheriting', () => {
  it('is true for an empty string', () => {
    expect(isInheriting('')).toBe(true);
  });

  it('is true for undefined', () => {
    expect(isInheriting(undefined)).toBe(true);
  });

  it('is false for concrete values', () => {
    expect(isInheriting('private')).toBe(false);
    expect(isInheriting('followers')).toBe(false);
    expect(isInheriting('public')).toBe(false);
  });
});

describe('labelForVisibility', () => {
  it("maps 'private' to 'Private'", () => {
    expect(labelForVisibility('private')).toBe('Private');
  });

  it("maps 'followers' to 'Friends'", () => {
    expect(labelForVisibility('followers')).toBe('Friends');
  });

  it("maps 'public' to 'Public'", () => {
    expect(labelForVisibility('public')).toBe('Public');
  });
});
