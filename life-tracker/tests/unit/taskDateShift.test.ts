import { describe, expect, it } from 'vitest';
import { shiftTaskDate } from '../../src/lib/taskDateShift';

describe('shiftTaskDate', () => {
  it('moves relative to the scheduled date, not today', () => {
    expect(shiftTaskDate('2026-11-12', -1)).toBe('2026-11-11');
    expect(shiftTaskDate('2026-11-12', 1)).toBe('2026-11-13');
  });

  it('respects month, year, and leap-day boundaries', () => {
    expect(shiftTaskDate('2026-11-30', 1)).toBe('2026-12-01');
    expect(shiftTaskDate('2027-01-01', -1)).toBe('2026-12-31');
    expect(shiftTaskDate('2028-02-28', 1)).toBe('2028-02-29');
    expect(shiftTaskDate('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('rejects undated and invalid calendar dates', () => {
    for (const invalid of ['', '2026-02-30', '2026-11-2', '2026-11-12T00:00:00Z']) {
      expect(() => shiftTaskDate(invalid, 1)).toThrow('Task needs a valid scheduled date');
    }
  });
});
