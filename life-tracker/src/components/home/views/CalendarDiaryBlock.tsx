import React from 'react';
import { BookOpenText } from 'lucide-react';
import type { CalendarDiaryPreview } from '../../../lib/calendarDiary';

/** Decorative read-only block: DayCell keeps sole ownership of navigation. */
export const CalendarDiaryBlock: React.FC<{ preview: CalendarDiaryPreview }> = ({ preview }) => (
  <div className="flex min-w-0 w-full items-center gap-1 overflow-hidden rounded-[4.5px] bg-surfaceHighlight px-[0.3rem] pb-0.5 text-[10.5px] text-gray-300">
    <BookOpenText size={10} className="shrink-0" aria-hidden="true" />
    <span className="min-w-0 block overflow-hidden whitespace-nowrap">
      {preview.entryCount > 1
        ? `Diary · ${preview.entryCount} entries`
        : <>{preview.emoji && <span>{preview.emoji} </span>}{preview.excerpt}</>}
    </span>
  </div>
);
