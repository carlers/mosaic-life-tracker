import { createContext } from 'react';
import type { CalendarDiaryConfig } from '../lib/calendarDiary';

/** Only the active owner Calendar receives this optional read-only projection. */
export const CalendarDiaryContext = createContext<CalendarDiaryConfig | null>(null);
