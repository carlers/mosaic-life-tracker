import React, { useState } from 'react';
import { BookOpenText, Plus, Images } from 'lucide-react';
import { parseDiaryPhotos } from '../../../lib/diaryPhotos';
import { useDiary } from '../../../hooks/useDiary';
import { useSettings } from '../../../hooks/useSettings';
import type { DiaryDocument } from '../../../db/schema';
import { DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, resolveDiaryDayViewHeight } from '../../../lib/preferences';
import { DiaryEntrySheet } from './DiaryEntrySheet';
import { diaryMarker } from '../../../lib/diaryMarker';

interface DiaryDayCardProps {
  entry?: DiaryDocument;
  onOpen: () => void;
  expanded?: boolean;
}

/** The same compact visual rhythm as a TaskBlock, without pretending to be a task. */
export const DiaryDayCard: React.FC<DiaryDayCardProps> = ({ entry, onOpen, expanded = false }) => (
  <button type="button" onClick={onOpen} data-testid="diary-day-card"
    aria-label={entry ? 'Read diary entry' : 'Add diary entry'}
    className="flex min-w-0 w-full items-start gap-3 rounded-xl bg-surfaceHighlight px-4 py-3 text-left text-white outline-offset-2 transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-gray-400" aria-hidden="true">
      {entry ? <BookOpenText size={19}/> : <Plus size={18}/>}
    </span>
    <span className="min-w-0 flex-1">
      <span className={expanded ? 'block whitespace-pre-wrap break-words text-sm' : 'block truncate text-sm'}>
        {entry?.content?.trim() || (entry ? 'Diary entry' : 'Add diary entry')}
      </span>
      {expanded && entry?.emoji && <span aria-hidden="true" className="mt-1 inline-block text-lg">{diaryMarker(entry)}</span>}
      {expanded && entry?.photos && parseDiaryPhotos(entry.photos).length > 0 && (
        <span className="mt-1 flex items-center gap-1 text-xs text-gray-400"><Images size={14}/> {parseDiaryPhotos(entry.photos).length} photos</span>
      )}
    </span>
  </button>
);

/** Opt-in owner Day View card, managed by the existing local-first diary hook. */
export const DiaryDayPreview: React.FC<{ date: string }> = ({ date }) => {
  const { getEntryByDate, saveEntry, deleteEntry } = useDiary();
  const { getSetting } = useSettings();
  const [open, setOpen] = useState(false);
  const entry = getEntryByDate(date);
  const expanded = resolveDiaryDayViewHeight(getSetting(DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, 'compact')) === 'expanded';
  return (
    <>
      <div className="mx-4 my-2 min-w-0">
        <DiaryDayCard entry={entry} onOpen={() => setOpen(true)} expanded={expanded}/>
      </div>
      {open && <DiaryEntrySheet key={date} date={date} entry={entry} author="Me"
        onSave={saveEntry} onDelete={deleteEntry} onClose={() => setOpen(false)} />}
    </>
  );
};
