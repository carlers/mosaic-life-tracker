import { describe, it, expect } from 'vitest';
import {
  parseReactions,
  stringifyReactions,
  applyReactionDelta,
  hasUserReacted,
  type Reaction,
} from '../../src/lib/reactionUtils';

describe('parseReactions', () => {
  it('returns [] for empty string', () => {
    expect(parseReactions('')).toEqual([]);
  });

  it('returns [] for undefined', () => {
    expect(parseReactions(undefined)).toEqual([]);
  });

  it('returns [] for null-ish inputs', () => {
    expect(parseReactions(null as any)).toEqual([]);
  });

  // Regression: parseReactions must never throw on malformed data
  it('returns [] for invalid JSON', () => {
    expect(parseReactions('{not json')).toEqual([]);
  });

  it('returns [] for non-array JSON', () => {
    expect(parseReactions('{"emoji":"x"}')).toEqual([]);
  });

  it('filters entries with missing emoji', () => {
    const raw = JSON.stringify([
      { userIds: ['u1'] },
      { emoji: '👍', userIds: ['u1'] },
    ]);
    expect(parseReactions(raw)).toEqual([{ emoji: '👍', userIds: ['u1'] }]);
  });

  it('filters entries with non-array userIds', () => {
    const raw = JSON.stringify([
      { emoji: '👍', userIds: 'u1' },
      { emoji: '❤️', userIds: ['u1'] },
    ]);
    expect(parseReactions(raw)).toEqual([{ emoji: '❤️', userIds: ['u1'] }]);
  });

  it('filters entries whose userIds are empty after dropping non-strings', () => {
    const raw = JSON.stringify([
      { emoji: '👍', userIds: [1, 2, null] },
      { emoji: '❤️', userIds: ['u1', 2] },
    ]);
    expect(parseReactions(raw)).toEqual([{ emoji: '❤️', userIds: ['u1'] }]);
  });
});

describe('stringifyReactions', () => {
  it('serializes empty array as "" (not "[]")', () => {
    expect(stringifyReactions([])).toBe('');
  });

  it('dedupes userIds', () => {
    const out = stringifyReactions([
      { emoji: '👍', userIds: ['u1', 'u1', 'u2'] },
    ]);
    expect(JSON.parse(out)).toEqual([{ emoji: '👍', userIds: ['u1', 'u2'] }]);
  });

  it('drops entries with empty userIds', () => {
    const out = stringifyReactions([
      { emoji: '👍', userIds: [] },
      { emoji: '❤️', userIds: ['u1'] },
    ]);
    expect(JSON.parse(out)).toEqual([{ emoji: '❤️', userIds: ['u1'] }]);
  });

  it('returns "" when all entries are dropped', () => {
    expect(stringifyReactions([{ emoji: '👍', userIds: [] }])).toBe('');
  });
});

describe('applyReactionDelta', () => {
  it('adds a new emoji entry', () => {
    const out = applyReactionDelta([], '👍', 'u1', 'add');
    expect(out).toEqual([{ emoji: '👍', userIds: ['u1'] }]);
  });

  it('appends a new user to an existing emoji', () => {
    const out = applyReactionDelta(
      [{ emoji: '👍', userIds: ['u1'] }],
      '👍',
      'u2',
      'add'
    );
    expect(out).toEqual([{ emoji: '👍', userIds: ['u1', 'u2'] }]);
  });

  it('is idempotent for duplicate add (same user twice → no duplicate)', () => {
    const out = applyReactionDelta(
      [{ emoji: '👍', userIds: ['u1'] }],
      '👍',
      'u1',
      'add'
    );
    expect(out).toEqual([{ emoji: '👍', userIds: ['u1'] }]);
  });

  it('removes a user from an existing emoji', () => {
    const out = applyReactionDelta(
      [{ emoji: '👍', userIds: ['u1', 'u2'] }],
      '👍',
      'u1',
      'remove'
    );
    expect(out).toEqual([{ emoji: '👍', userIds: ['u2'] }]);
  });

  it('removes the emoji entry when the last user is removed', () => {
    const out = applyReactionDelta(
      [{ emoji: '👍', userIds: ['u1'] }],
      '👍',
      'u1',
      'remove'
    );
    expect(out).toEqual([]);
  });

  it('is a no-op when removing a non-existent emoji', () => {
    const out = applyReactionDelta(
      [{ emoji: '👍', userIds: ['u1'] }],
      '❤️',
      'u1',
      'remove'
    );
    expect(out).toEqual([{ emoji: '👍', userIds: ['u1'] }]);
  });

  it('does not mutate the input array or its entries', () => {
    const input: Reaction[] = [{ emoji: '👍', userIds: ['u1'] }];
    const snapshot: Reaction[] = JSON.parse(JSON.stringify(input));
    applyReactionDelta(input, '👍', 'u2', 'add');
    expect(input).toEqual(snapshot);
    expect(input[0].userIds).toEqual(['u1']);
  });
});

describe('hasUserReacted', () => {
  it('returns true when the user is present', () => {
    expect(
      hasUserReacted([{ emoji: '👍', userIds: ['u1'] }], '👍', 'u1')
    ).toBe(true);
  });

  it('returns false when the user is absent', () => {
    expect(
      hasUserReacted([{ emoji: '👍', userIds: ['u1'] }], '👍', 'u2')
    ).toBe(false);
    expect(hasUserReacted([], '👍', 'u1')).toBe(false);
  });
});

describe('round-trip', () => {
  it('parse(stringify(x)) deep-equals x for valid inputs', () => {
    const cases: Reaction[][] = [
      [],
      [{ emoji: '👍', userIds: ['u1'] }],
      [
        { emoji: '👍', userIds: ['u1', 'u2'] },
        { emoji: '❤️', userIds: ['u3'] },
      ],
    ];
    for (const c of cases) {
      expect(parseReactions(stringifyReactions(c))).toEqual(c);
    }
  });
});
