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
    // The overlay is the single visual feedback. Keep the default Feedback
    // plugin enabled so dnd-kit positions and promotes that overlay; only
    // disable its independent drop animation.
    plugins: [Feedback.configure({ feedback: 'default', dropAnimation: null })],
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
