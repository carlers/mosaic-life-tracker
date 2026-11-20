import { isValid, parseISO } from 'date-fns';

// Explicit link/search navigation, not Calendar startup. Preserve date-fns
// local ISO parsing (including invalid-date rejection) without making these
// helpers part of the Home route's synchronous static import closure.
export function parseHomeTaskDate(value: string): Date | null {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}
