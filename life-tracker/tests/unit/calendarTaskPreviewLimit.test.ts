import { describe, expect, it } from 'vitest';
import {
  CALENDAR_TASK_PREVIEW_LIMITS,
  resolveCalendarTaskPreviewLimit,
} from '../../src/lib/preferences';

describe('calendar task preview limit preference', () => {
  it.each(CALENDAR_TASK_PREVIEW_LIMITS)('accepts %i as a number or select option', limit => {
    expect(resolveCalendarTaskPreviewLimit(limit)).toBe(limit);
    expect(resolveCalendarTaskPreviewLimit(String(limit))).toBe(limit);
  });

  it.each([undefined, null, '', false, true, 0, 1, -1, 4, 9, 21, 3.5, '03', '4', 'Infinity', {}, []])(
    'falls back to unlimited for invalid value %s', value => {
      expect(resolveCalendarTaskPreviewLimit(value)).toBe('unlimited');
    }
  );

  it('preserves the explicit unlimited choice', () => {
    expect(resolveCalendarTaskPreviewLimit('unlimited')).toBe('unlimited');
  });
});
