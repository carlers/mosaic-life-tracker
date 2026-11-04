import { addDays, format, isValid, parseISO } from 'date-fns';

/** Shift a YYYY-MM-DD task date by a local calendar day (not 24 hours in UTC). */
export function shiftTaskDate(date: string, days: -1 | 1): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Task needs a valid scheduled date');
  }
  const parsed = parseISO(date);
  if (!isValid(parsed) || format(parsed, 'yyyy-MM-dd') !== date) {
    throw new Error('Task needs a valid scheduled date');
  }
  return format(addDays(parsed, days), 'yyyy-MM-dd');
}
