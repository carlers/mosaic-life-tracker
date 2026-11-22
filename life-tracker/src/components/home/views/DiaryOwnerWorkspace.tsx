import React, { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useDiary } from '../../../hooks/useDiary';
import { useRetainedSheetValue } from '../../../hooks/useRetainedSheetValue';
import { createPreloadedLazy } from '../../../lib/createPreloadedLazy';
import { LazyTodoListView } from './todoListViewModule';

// Keeping Diary's subscription, selection state and editor within the Diary
// lazy boundary avoids loading Diary-only code during Calendar/Home startup.
const { Component: LazyDiaryEntrySheet, preload: preloadDiaryEntrySheet } = createPreloadedLazy(() =>
  import('./DiaryEntrySheet').then(m => m.DiaryEntrySheet));

type Props = Omit<React.ComponentProps<typeof LazyTodoListView>,
  'markerMode' | 'diaryEntries' | 'onOpenDiary'> & {
    userId: string;
    author: string;
    isActive: boolean;
    diaryTodayRequest: number;
  };

export const DiaryOwnerWorkspace: React.FC<Props> = ({
  userId, author, isActive, diaryTodayRequest, ...todoProps
}) => {
  const [diaryDate, setDiaryDate] = useState<string | null>(null);
  const [diaryEntryId, setDiaryEntryId] = useState<string | null>(null);
  const { entries, getEntriesByDate, createEntry, updateEntry, deleteEntryById } =
    useDiary(isActive && Boolean(userId));
  const diaryOpen = Boolean(isActive && userId && diaryDate);
  const { value: diarySession, onExitComplete: clearDiarySession } = useRetainedSheetValue(
    diaryOpen && diaryDate && userId
      ? { id: `${userId}:${diaryDate}:${diaryEntryId || 'new'}`,
          userId, date: diaryDate, entryId: diaryEntryId,
          entry: diaryEntryId ? getEntriesByDate(diaryDate).find(item => item.id === diaryEntryId) : undefined }
      : null,
    diaryOpen
  );
  const openDiary = useCallback((date: Date, entryId?: string) => {
    const key = format(date, 'yyyy-MM-dd');
    const entriesOnDay = getEntriesByDate(key);
    if (!entryId && entriesOnDay.length > 1) {
      setDiaryDate(null);
      return;
    }
    setDiaryEntryId(entryId ?? entriesOnDay[0]?.id ?? null);
    setDiaryDate(key);
  }, [getEntriesByDate]);

  const handledShortcut = useRef(diaryTodayRequest);
  useEffect(() => {
    if (!isActive || !userId || diaryTodayRequest === handledShortcut.current) return;
    handledShortcut.current = diaryTodayRequest;
    openDiary(new Date());
  }, [isActive, userId, diaryTodayRequest, openDiary]);

  useEffect(() => {
    if (isActive && userId) void preloadDiaryEntrySheet().catch(() => {});
  }, [isActive, userId]);

  return <>
    <LazyTodoListView {...todoProps} markerMode="diary"
      diaryEntries={entries} onOpenDiary={openDiary} />
    {isActive && userId && diarySession?.userId === userId && (
      <React.Suspense fallback={null}>
        <LazyDiaryEntrySheet key={diarySession.id} isOpen={diaryOpen}
          onExitComplete={clearDiarySession} date={diarySession.date}
          entry={diarySession.entry} author={author}
          onSave={async (date, content, visibility, emoji, photos, savedEntryId) => {
            const targetId = diarySession.entryId || savedEntryId;
            if (targetId) {
              await updateEntry(targetId, date, content, visibility, emoji, photos);
            } else return createEntry(date, content, visibility, emoji, photos);
          }}
          onDelete={diarySession.entryId ? async () => deleteEntryById(diarySession.entryId!) : undefined}
          onClose={() => { setDiaryDate(null); setDiaryEntryId(null); }} />
      </React.Suspense>
    )}
  </>;
};
