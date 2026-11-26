import React, { Suspense } from 'react';
import { useDiary } from '../../hooks/useDiary';

const DiaryEntrySheet = React.lazy(() => import('./views/DiaryEntrySheet')
  .then(m => ({ default: m.DiaryEntrySheet })));

/** Mounted only after a Diary result is selected; no Home startup Diary subscription. */
export const SearchDiaryEditor: React.FC<{
  entryId: string;
  onClose: () => void;
}> = ({ entryId, onClose }) => {
  const { getEntryById, updateEntry, deleteEntryById } = useDiary(true);
  const entry = getEntryById(entryId);
  if (!entry) return null;
  return <Suspense fallback={null}>
    <DiaryEntrySheet key={entry.id} isOpen date={entry.date} entry={entry}
      author="Me" initialEditing={false}
      onSave={async (date, content, visibility, emoji, photos, _retryId, titleOnly) => {
        await updateEntry(entry.id, date, content, visibility, emoji, photos, titleOnly);
      }}
      onDelete={async () => { await deleteEntryById(entry.id); }}
      onClose={onClose}/>
  </Suspense>;
};
