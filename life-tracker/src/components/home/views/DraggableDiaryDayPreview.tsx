import React, { lazy, Suspense } from 'react';
import { useDraggable } from '@dnd-kit/react';
import { Feedback } from '@dnd-kit/dom';
const DiaryDayPreview = lazy(() => import('./DiaryDayPreview').then(m => ({default: m.DiaryDayPreview})));
import { useDiary } from '../../../hooks/useDiary';

export const DraggableDiaryDayPreview: React.FC<{ date: string }> = ({ date }) => {
  const { getEntryByDate } = useDiary();
  const { ref, handleRef } = useDraggable({ id: `diary:${date}`, type: 'diary', disabled: !getEntryByDate(date),
    // Move the actual, fully measured card; never substitute a small overlay.
    plugins: [Feedback.configure({ feedback: 'default', dropAnimation: null })],
  });
  return (
    <div ref={ref} className="relative" data-diary-drag-source="true">
      <Suspense fallback={null}><DiaryDayPreview date={date} dragHandleRef={handleRef}/></Suspense>
    </div>
  );
};
