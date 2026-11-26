import { createContext } from 'react';
import type { CalendarDiaryConfig } from '../lib/calendarDiary';

/** Only the active owner Calendar receives this optional read-only projection. */
export const CalendarDiaryContext = createContext<CalendarDiaryConfig | null>(null);

/**
 * Day View inherits the already subscribed owner's settings from Home.
 * Without this shared snapshot every virtual day initially uses default
 * group height/order/placement, then jumps when its own RxDB query resolves.
 * Consumers must match ownerId to the authenticated account.
 */
export const OwnerSettingsContext = createContext<{
  ownerId: string;
  settings: Readonly<Record<string, unknown>>;
  isLoading: boolean;
} | null>(null);
