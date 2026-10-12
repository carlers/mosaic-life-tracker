import React, { lazy, Suspense } from 'react';
import { useDraggable } from '@dnd-kit/react';
import { Feedback } from '@dnd-kit/dom';
import { useDiary } from '../../../hooks/useDiary';
import { useSettings } from '../../../hooks/useSettings';
import type { DiaryDocument } from '../../../db/schema';
import { DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, resolveDiaryDayViewHeight } from '../../../lib/preferences';

const DiaryDayPreview = lazy(() => import('./DiaryDayPreview').then(m => ({default: m.DiaryDayPreview})));

export const DraggableDiaryDayPreview: React.FC<{
  date: string;
  entryOverride?: DiaryDocument;
}> = ({ date, entryOverride }) => {
  const { getEntryByDate } = useDiary(entryOverride === undefined);
  const { getSetting } = useSettings();
  const entry = entryOverride ?? getEntryByDate(date);
  const expanded = resolveDiaryDayViewHeight(
    getSetting(DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, 'compact')
  ) === 'expanded';
  const { ref, handleRef } = useDraggable({
    id: `diary:${date}`,
    type: 'diary',
    disabled: !entry,
    data: { entry, expanded },
    // Exactly like tasks: an invisible geometry source and one full-height
    // React DragOverlay. dnd-kit's automatic feedback must never move the
    // original card while React animates its list position.
    plugins: [Feedback.configure({ feedback: 'none', dropAnimation: null })],
  });
  return (
    <div className="relative" data-diary-drag-source="true">
      <div ref={ref} aria-hidden="true" style={{
        position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none',
      }}/>
      <Suspense fallback={null}>
        <DiaryDayPreview date={date} dragHandleRef={handleRef} entryOverride={entryOverride}/>
      </Suspense>
    </div>
  );
};
