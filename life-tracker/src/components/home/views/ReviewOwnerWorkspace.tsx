import React, { useCallback, useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';
import { useDiary } from '../../../hooks/useDiary';
import { useRetainedSheetValue } from '../../../hooks/useRetainedSheetValue';
import { createPreloadedLazy } from '../../../lib/createPreloadedLazy';
import { DailyReviewView } from './DailyReviewView';
import { CalendarHeader } from './CalendarHeader';
import type { ViewType } from '../ViewSwitcher';

// The Review-only Diary subscription/editor and route task adapter are loaded
// only when Review is selected. The Calendar/Home startup closure stays small.
const { Component: LazyDiaryEntrySheet } = createPreloadedLazy(() =>
  import('./DiaryEntrySheet').then(m => m.DiaryEntrySheet));

interface Props {
  date: Date;
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  userId: string;
  author: string;
  isActive: boolean;
  onDateChange: (date: Date) => void;
  onViewChange: (view: ViewType) => void;
}

export const ReviewOwnerWorkspace: React.FC<Props> = ({
  date, tasks, categories, userId, author, isActive, onDateChange, onViewChange,
}) => {
  const navigate = useNavigate();
  const [diaryDate, setDiaryDate] = useState<string | null>(null);
  const [diaryEntryId, setDiaryEntryId] = useState<string | null>(null);
  const { getEntriesByDate, createEntry, updateEntry, deleteEntryById } =
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
  const openDiary = useCallback((targetDate: Date, entryId?: string) => {
    const key = format(targetDate, 'yyyy-MM-dd');
    const entries = getEntriesByDate(key);
    if (!entryId && entries.length > 1) return;
    setDiaryEntryId(entryId ?? entries[0]?.id ?? null);
    setDiaryDate(key);
  }, [getEntriesByDate]);
  const createDiary = useCallback((targetDate: Date) => {
    setDiaryEntryId(null);
    setDiaryDate(format(targetDate, 'yyyy-MM-dd'));
  }, []);
  const openTask = useCallback((task: TaskDocument) => {
    if (!task.date || task.userId !== userId) return;
    // HomePage already handles this same-route focus intent and opens the
    // canonical DayViewSheet/TaskActionSheet without duplicating task UI.
    navigate('/home', { state: { focusTaskId: task.id, focusTaskDate: task.date } });
  }, [navigate, userId]);

  const stepDay = (step: number) => {
    const shifted = new Date(date);
    shifted.setDate(shifted.getDate() + step);
    onDateChange(shifted);
  };
  return <>
    <CalendarHeader title={format(date, 'EEE, MMM d, yyyy')} viewMode="month"
      onToggleMode={() => {}} activeView="review" onViewChange={onViewChange}
      onPrev={() => stepDay(-1)} onNext={() => stepDay(1)}
      onTitleClick={() => onDateChange(new Date())} />
    <DailyReviewView date={date} tasks={tasks} categories={categories}
      diaryEntries={getEntriesByDate(format(date, 'yyyy-MM-dd'))}
      onSaveDiary={(id, entryDate, content, visibility, emoji, photos) =>
        updateEntry(id, entryDate, content, visibility, emoji, photos)}
      onOpenDiary={openDiary} onCreateDiary={createDiary}
      onOpenTask={openTask} userId={userId} />
    {isActive && userId && diarySession?.userId === userId && (
      <React.Suspense fallback={null}>
        <LazyDiaryEntrySheet key={diarySession.id} isOpen={diaryOpen}
          onExitComplete={clearDiarySession} date={diarySession.date}
          entry={diarySession.entry} author={author}
          onSave={async (entryDate, content, visibility, emoji, photos, savedEntryId) => {
            const targetId = diarySession.entryId || savedEntryId;
            if (targetId) {
              await updateEntry(targetId, entryDate, content, visibility, emoji, photos);
            } else return createEntry(entryDate, content, visibility, emoji, photos);
          }}
          onDelete={diarySession.entryId ? async () => deleteEntryById(diarySession.entryId!) : undefined}
          onClose={() => { setDiaryDate(null); setDiaryEntryId(null); }} />
      </React.Suspense>
    )}
  </>;
};
