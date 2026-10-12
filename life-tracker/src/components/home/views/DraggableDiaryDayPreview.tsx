import React from 'react';
import { useDraggable } from '@dnd-kit/react';
import { DiaryDayPreview } from './DiaryDayPreview';

export const DraggableDiaryDayPreview: React.FC<{ date: string }> = ({ date }) => {
  const { ref, handleRef } = useDraggable({ id: `diary:${date}`, type: 'diary' });
  return (
    <div className="relative">
      <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0"/>
      <DiaryDayPreview date={date} dragHandleRef={handleRef}/>
    </div>
  );
};
