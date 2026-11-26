import React from 'react';
import type { DiaryDocument } from '../../db/schema';
import { useDiary } from '../../hooks/useDiary';
import { DiaryEntrySheet } from './views/DiaryEntrySheet';

interface OwnerDiarySession {
  id: string;
  date: string;
  entryId: string | null;
  entry?: DiaryDocument;
}

export const OwnerDiaryEditor: React.FC<{
  session: OwnerDiarySession;
  isOpen: boolean;
  author: string;
  onExitComplete: () => void;
  onClose: () => void;
}> = ({ session, isOpen, author, onExitComplete, onClose }) => {
  // Editor-only write closures: never add writer UI or imports to Home paint.
  // useDiary(false) retains owner/account generation guards but opens no second
  // diary collection subscription while the editor is active.
  const { createEntry, updateEntry, deleteEntryById } = useDiary(false);
  return <DiaryEntrySheet
    isOpen={isOpen} date={session.date} entry={session.entry} author={author}
    onExitComplete={onExitComplete}
    onSave={(date, content, visibility, emoji, photos, savedEntryId, titleOnly) => {
      const args = [date, content, visibility, emoji, photos, titleOnly] as const;
      const id = session.entryId || savedEntryId;
      return id ? updateEntry(id, ...args) : createEntry(...args);
    }}
    onDelete={session.entryId ? () => deleteEntryById(session.entryId!) : undefined}
    onClose={onClose}
  />;
};
