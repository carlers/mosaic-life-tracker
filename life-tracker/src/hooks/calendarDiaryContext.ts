import { createContext } from 'react';
import type { CalendarDiaryConfig } from '../lib/calendarDiary';
import type { DiaryDocument } from '../db/schema';

/** Only the active owner Calendar receives this optional read-only projection. */
export const CalendarDiaryContext = createContext<CalendarDiaryConfig | null>(null);

/** One locally subscribed Diary snapshot shared by Day View's virtual slides. */
export const OwnerDiaryContext = createContext<{
  ownerId: string;
  entries: readonly DiaryDocument[];
  isLoading: boolean;
} | null>(null);
