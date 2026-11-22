import { createContext } from 'react';
import type { DiaryDayLayout } from '../../../lib/diaryNotes';

export interface DiaryNoteDayInteraction {
  layout: DiaryDayLayout;
  groupedEntryIds: ReadonlySet<string>;
  savedCount: number;
  totalEntries: number;
  toggleLayout: () => void;
  onDragMove: (id: string, x: number, y: number, height: number) => void;
  onDragRelease: (id: string, x: number, y: number) => boolean;
  onDragEnd: () => void;
}

/** Present only in owner Categories/Diary Day View, never in friend/Timeline. */
export const DiaryNoteDayContext = createContext<DiaryNoteDayInteraction | null>(null);
