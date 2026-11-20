import { describe, expect, it } from 'vitest';
import { parseHomeTaskDate } from '../../src/lib/homeTaskDate';

describe('lazy Home linked-task date parser', () => {
  it('preserves local calendar dates for task navigation', () => {
    const parsed = parseHomeTaskDate('2026-11-21');
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(10);
    expect(parsed?.getDate()).toBe(21);
  });

  it('preserves ISO time and timezone handling for supported date links', () => {
    const value = '2026-11-21T09:30:00.000Z';
    expect(parseHomeTaskDate(value)?.getTime()).toBe(Date.parse(value));
  });

  it.each(['', 'not-a-date', '2026-02-30', '2026-13-01'])(
    'rejects invalid linked-task dates without opening Day View: %s',
    value => {
      expect(parseHomeTaskDate(value)).toBeNull();
    },
  );
});
