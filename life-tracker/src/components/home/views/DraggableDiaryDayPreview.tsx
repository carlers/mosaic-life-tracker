import React from 'react';
import { useDraggable } from '@dnd-kit/react';
import { DiaryDayPreview } from './DiaryDayPreview';
import { useDiary } from '../../../hooks/useDiary';

export const DraggableDiaryDayPreview: React.FC<{ date: string }> = ({ date }) => {
  const { getEntryByDate } = useDiary();
  const { ref, handleRef } = useDraggable({ id: `diary:${date}`, type: 'diary', disabled: !getEntryByDate(date) });
  return (
    <div className="relative">
      <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0"/>
      <DiaryDayPreview date={date} dragHandleRef={handleRef}/>
    </div>
  );
};
