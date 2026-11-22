import React from 'react';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';
import type { HolidayDisplayConfig } from '../../../lib/holidays';
import { LazyDayViewSheet } from './dayViewSheetModule';
import { LazyFriendDayViewSheet } from '../../friend/friendDayViewSheetModule';

interface Props {
  isFriend: boolean;
  isOpen: boolean;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onClose: () => void;
  tasks: TaskDocument[];
  categories?: CategoryDocument[];
  friendCategories?: CategoryDocument[];
  friendName?: string;
  currentUserId: string;
  onReplyToTask?: (task: TaskDocument, color: string) => void;
  onReactToTask?: (task: TaskDocument, emoji: string) => void;
  holidayConfig: HolidayDisplayConfig;
}

/** Only load the Day View sheet UI when a date is opened; keep Calendar Home static lean. */
export const CalendarDaySheetLayer: React.FC<Props> = ({
  isFriend, isOpen, selectedDate, onDateChange, onClose, tasks,
  categories, friendCategories, friendName, currentUserId,
  onReplyToTask, onReactToTask, holidayConfig,
}) => {
  const shared = { isOpen, onClose, onDateChange, tasks, holidayConfig };
  return isFriend ? (
    <LazyFriendDayViewSheet {...shared} date={selectedDate}
      categories={friendCategories ?? []} friendName={friendName ?? ''}
      currentUserId={currentUserId} onReplyToTask={onReplyToTask}
      onReactToTask={onReactToTask} />
  ) : (
    <LazyDayViewSheet {...shared} selectedDate={selectedDate}
      categories={categories ?? []} />
  );
};
