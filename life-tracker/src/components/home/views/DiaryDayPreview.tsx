import React, { lazy, Suspense, useState, useRef, useEffect } from 'react';
import { BookOpenText, Plus, Images } from 'lucide-react';
import { parseDiaryPhotos } from '../../../lib/diaryPhotos';
import { useDiary } from '../../../hooks/useDiary';
import { useRetainedSheetValue } from '../../../hooks/useRetainedSheetValue';
import { useSettings } from '../../../hooks/useSettings';
import type { DiaryDocument } from '../../../db/schema';
import { DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, resolveDiaryDayViewHeight } from '../../../lib/preferences';
const DiaryEntrySheet = lazy(() => import('./DiaryEntrySheet').then(m => ({ default: m.DiaryEntrySheet })));
import { diaryMarker } from '../../../lib/diaryMarker';

interface DiaryDayCardProps {
  entry?: DiaryDocument;
  onOpen: () => void;
  onEdit?: () => void;
  expanded?: boolean;
  dragHandleRef?: React.Ref<HTMLButtonElement>;
}

/** The same compact visual rhythm as a TaskBlock, without pretending to be a task. */
export const DiaryDayCard: React.FC<DiaryDayCardProps> = ({ entry, onOpen, onEdit, expanded = false, dragHandleRef }) => {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapAt = useRef(0);
  const clearPending = () => { if (pending.current) clearTimeout(pending.current); pending.current = null; };
  useEffect(() => () => { if (pending.current) clearTimeout(pending.current); }, []);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0 || !entry || !onEdit) { clearPending(); onOpen(); return; }
    const now = Date.now();
    if (pending.current && now - lastTapAt.current < 280) {
      clearPending(); lastTapAt.current = 0; onEdit(); return;
    }
    clearPending(); lastTapAt.current = now;
    pending.current = setTimeout(() => { pending.current = null; onOpen(); }, 280);
  };
  return (
  <button ref={entry ? dragHandleRef : undefined} type="button" onClick={handleClick}
    onPointerCancel={clearPending} onDragStart={clearPending} data-testid="diary-day-card"
    aria-label={entry ? (onEdit ? 'Read diary entry, double tap to edit' : 'Read diary entry') : 'Add diary entry'}
    className="flex min-w-0 w-full items-start gap-3 rounded-lg py-2 pl-0 pr-2 text-left text-white outline-offset-2 transition-colors hover:bg-surfaceHighlight focus-visible:outline focus-visible:outline-2">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-gray-400" aria-hidden="true">
      {entry ? <BookOpenText size={19}/> : <Plus size={18}/>}
    </span>
    <span className="min-w-0 flex-1">
      <span className={expanded ? 'block whitespace-pre-wrap break-words text-base' : 'block overflow-hidden whitespace-nowrap text-base'}>
        {entry?.content?.trim() || (entry ? 'Diary entry' : 'Add diary entry')}
      </span>
      {expanded && entry?.emoji && <span aria-hidden="true" className="mt-1 inline-block text-lg">{diaryMarker(entry)}</span>}
      {expanded && entry?.photos && parseDiaryPhotos(entry.photos).length > 0 && (
        <span className="mt-1 flex items-center gap-1 text-xs text-gray-400"><Images size={14}/> {parseDiaryPhotos(entry.photos).length} photos</span>
      )}
    </span>
  </button>
  );
};

/** Opt-in owner Day View card, managed by the existing local-first diary hook. */
export const DiaryDayPreview: React.FC<{
  date: string;
  dragHandleRef?: React.Ref<HTMLButtonElement>;
  entryOverride?: DiaryDocument;
}> = ({ date, dragHandleRef, entryOverride }) => {
  const { getEntryByDate, saveEntry, deleteEntry } = useDiary(entryOverride === undefined);
  const { getSetting } = useSettings();
  const [mode, setMode] = useState<'read' | 'edit' | null>(null);
  const entry = entryOverride ?? getEntryByDate(date);
  const { value: diarySession, onExitComplete: clearDiarySession } = useRetainedSheetValue(
    mode ? { id: `${date}:${mode}`, date, mode, entry } : null,
    mode !== null
  );
  const expanded = resolveDiaryDayViewHeight(getSetting(DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, 'compact')) === 'expanded';
  return (
    <>
      <div className="my-2 min-w-0">
        <DiaryDayCard entry={entry} onOpen={() => setMode('read')} onEdit={entry ? () => setMode('edit') : undefined} expanded={expanded} dragHandleRef={dragHandleRef}/>
      </div>
      {diarySession && <Suspense fallback={null}><DiaryEntrySheet key={diarySession.id}
        isOpen={mode !== null} onExitComplete={clearDiarySession}
        date={diarySession.date} entry={diarySession.entry} author="Me"
        onSave={saveEntry} onDelete={deleteEntry} initialEditing={diarySession.mode === 'edit'}
        onClose={() => setMode(null)} /></Suspense>}
    </>
  );
};
