import { createContext } from 'react';
import type { DiaryDayLayout } from '../../../lib/diaryNotes';

export interface DiaryNoteDayInteraction {
  layout: DiaryDayLayout;
  groupedEntryIds: ReadonlySet<string>;
  savedCount: number;
  totalEntries: number;
  floatingEntryId: string | null;
  floatingExternal: boolean;
  toggleLayout: () => void;
  onDragStart: (id: string, rect: DOMRect, x: number, y: number, source: 'group' | 'inline') => void;
  /** True when the pointer has left the group, disabling its sibling reflow. */
  onDragMove: (id: string, x: number, y: number, height: number) => boolean;
  onDragRelease: (id: string, x: number, y: number) => boolean;
  onDragEnd: () => void;
}

/** Present only in owner Categories/Diary Day View, never in friend/Timeline. */
export const DiaryNoteDayContext = createContext<DiaryNoteDayInteraction | null>(null);
