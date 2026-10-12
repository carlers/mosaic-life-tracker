import React, { useState } from 'react';
import { useDiary } from '../../../hooks/useDiary';
import { DiaryEntrySheet } from './DiaryEntrySheet';
import { diaryMarker } from '../../../lib/diaryMarker';

/** Opt-in extension of the ordinary owner Calendar Day View. */
export const DiaryDayPreview: React.FC<{ date: string }> = ({ date }) => {
  const { getEntryByDate, saveEntry, deleteEntry } = useDiary();
  const [open, setOpen] = useState(false);
  const entry = getEntryByDate(date);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="mx-4 my-2 flex min-h-11 items-center gap-3 rounded-xl bg-surfaceHighlight px-4 py-3 text-left focus-visible:outline focus-visible:outline-2"
        aria-label={entry ? 'Read diary entry' : 'Add diary entry'}>
        <span aria-hidden="true" className="text-2xl">{entry ? diaryMarker(entry) || '📝' : '＋'}</span>
        <span className="min-w-0 flex-1 truncate">{entry?.content || (entry ? 'Diary entry' : 'Add diary entry')}</span>
      </button>
      {open && <DiaryEntrySheet key={date} date={date} entry={entry} author="Me"
        onSave={saveEntry} onDelete={deleteEntry} onClose={() => setOpen(false)} />}
    </>
  );
};
