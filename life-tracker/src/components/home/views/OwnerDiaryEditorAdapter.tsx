import React from 'react';
import type { DiaryDocument } from '../../../db/schema';
import type { useDiary } from '../../../hooks/useDiary';
import { DiaryEntrySheet } from './DiaryEntrySheet';

type DiaryActions = ReturnType<typeof useDiary>;
interface OwnerDiarySession {
  id: string;
  date: string;
  entryId: string | null;
  entry?: DiaryDocument;
}

interface Props {
  session: OwnerDiarySession;
  isOpen: boolean;
  author: string;
  onClose: () => void;
  onExitComplete: () => void;
  createEntry: DiaryActions['createEntry'];
  updateEntry: DiaryActions['updateEntry'];
  deleteEntryById: DiaryActions['deleteEntryById'];
}

/** Owner editor wiring stays out of Home's initial Calendar bundle. */
export const OwnerDiaryEditorAdapter: React.FC<Props> = ({
  session, isOpen, author, onClose, onExitComplete, createEntry, updateEntry, deleteEntryById,
}) => (
  <DiaryEntrySheet
    isOpen={isOpen} onExitComplete={onExitComplete} date={session.date}
    entry={session.entry} author={author} onClose={onClose}
    onSave={(date, content, visibility, emoji, photos, savedEntryId) => {
      const targetId = session.entryId || savedEntryId;
      return targetId
        ? updateEntry(targetId, date, content, visibility, emoji, photos)
        : createEntry(date, content, visibility, emoji, photos);
    }}
    onDelete={session.entryId ? () => deleteEntryById(session.entryId!) : undefined}
  />
);
